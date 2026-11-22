import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { URL } from 'node:url'
import { Miniflare } from 'miniflare'
import { specimenCount } from '../shared/office-experiment.ts'
import type { Command, RoomMessage } from '../shared/office-experiment.ts'

test('enrolled phones share Wi-Fi without sharing a cooldown, including after reconnect', { timeout: 30000 }, async () => {
  const modules = Object.fromEntries(await Promise.all(['worker/office-room.ts', 'shared/office-experiment.ts'].map(async path => [path, {
    type: 'esm' as const,
    contents: stripTypeScriptTypes(await readFile(new URL(`../${path}`, import.meta.url), 'utf8')),
  }])))
  const runtime = new Miniflare({ workers: [{ config: {
    name: 'office-test', compatibilityDate: '2026-10-04',
    exports: { OfficeRoom: { type: 'durable-object', storage: 'sqlite' } },
    manifest: { mainModule: 'fixture.mjs', modules: { ...modules, 'fixture.mjs': { type: 'esm', contents: `
      export { OfficeRoom } from './worker/office-room.ts'
      const realNow = Date.now
      let now = 0
      Date.now = () => now
      export default { fetch(request, env) {
        now ||= realNow()
        const url = new URL(request.url)
        if (url.pathname === '/clock') { now += Number(url.searchParams.get('advance')); return new Response('OK') }
        if (url.pathname === '/unverified') {
          request = new Request(request)
          request.headers.delete('CF-Connecting-IP')
        }
        return env.OFFICE_ROOM.getByName('presentation').fetch(request)
      } }
    ` } } },
    env: {
      OFFICE_ROOM: { type: 'durable-object', worker: 'office-test', exportName: 'OfficeRoom' },
      OFFICE_PRESENTER_KEY: { type: 'text', value: 'fixture-presenter' },
    },
  } }] })
  const sockets: { close: () => void }[] = []
  try {
    const unverified = await runtime.dispatchFetch('https://office.test/unverified?device=unverified', {
      headers: { Upgrade: 'websocket', 'X-Forwarded-For': '203.0.113.7' },
    })
    assert.equal(unverified.status, 400, 'Forwarded addresses cannot replace the ingress identity')
    const connect = async (device: string, address = '203.0.113.7', extra: Record<string, string> = {}) => {
      const response = await runtime.dispatchFetch(`https://office.test/api/office?device=${device}`, {
        headers: { Upgrade: 'websocket', 'CF-Connecting-IP': address, ...extra },
      })
      assert.equal(response.status, 101)
      const socket = response.webSocket!
      let closed = false
      const close = () => { if (!closed) { closed = true; socket.close() } }
      sockets.push({ close })
      const messages: RoomMessage[] = []
      let notify = () => {}
      socket.addEventListener('message', event => { messages.push(JSON.parse(String(event.data))); notify() })
      const receive = async (op: RoomMessage['op']) => {
        while (!messages.some(message => message.op === op)) await new Promise<void>(resolve => { notify = resolve })
        return messages.splice(messages.findIndex(message => message.op === op), 1)[0]!
      }
      socket.accept()
      const snapshot = await receive('snapshot')
      const send = (command: Command) => socket.send(JSON.stringify(command))
      // A rejected authentication command acknowledges preceding taps without granting host access.
      const tap = async (run: string, id: string, kind: 'beetle' | 'snail' = 'beetle') => {
        send({ op: 'tap', run, id, kind })
        send({ op: 'host', key: 'invalid-fixture-key' })
        await receive('error')
      }
      const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? ''
      return { close, snapshot, send, receive, tap, cookie }
    }
    const host = await connect('host', '192.0.2.1')
    host.send({ op: 'host', key: 'fixture-presenter' })
    await host.receive('host')
    host.send({ op: 'open' })
    const opened = await host.receive('snapshot')
    assert.equal(opened.op, 'snapshot')
    if (opened.op !== 'snapshot' || !opened.run) throw new Error('Missing run')
    const run = opened.run.id
    host.send({ op: 'tap', run, id: 'calibration', kind: 'snail' })
    await host.receive('drop')
    await runtime.dispatchFetch('https://office.test/clock?advance=4000')
    const guest = await connect('first-device')
    await guest.tap(run, 'first-vote')
    const second = await connect('second-device')
    await second.tap(run, 'second-vote')
    const simultaneous = await connect('observer', '192.0.2.2')
    if (simultaneous.snapshot.op !== 'snapshot') throw new Error('Missing snapshot')
    assert.equal(simultaneous.snapshot.run?.drops.length, 3, 'Both phones can vote on the same Wi-Fi within two seconds')
    guest.close()
    assert.ok(guest.cookie, 'The server enrolls the phone with a cookie')
    const reconnected = await connect('first-device', '203.0.113.7', { Cookie: guest.cookie })
    await reconnected.tap(run, 'reconnect-vote')
    const changed = await connect('invented-device', '203.0.113.7', {
      Cookie: guest.cookie + '; brundlefly-office-device=invented', 'X-Forwarded-For': '198.51.100.2',
      'X-Real-IP': '198.51.100.3',
    })
    await changed.tap(run, 'changed-vote')
    await runtime.unsafeEvictDurableObject('office-test', 'OfficeRoom', { name: 'presentation', webSockets: 'hibernate' })
    const restarted = await connect('another-invented-device', '203.0.113.7', { Cookie: guest.cookie })
    await restarted.tap(run, 'restart-vote')
    const observer = await connect('observer', '192.0.2.2')
    assert.equal(observer.snapshot.op, 'snapshot')
    if (observer.snapshot.op !== 'snapshot') throw new Error('Missing snapshot')
    assert.equal(observer.snapshot.run?.drops.length, 3, 'Reconnects, device changes, and hibernation preserve the participant cooldown')
    for (const drop of observer.snapshot.run!.drops)
      assert.equal(drop.id.includes('203.0.113.7'), false, 'Public drop IDs do not disclose network addresses')
    // Independent networks keep voting. The original participant can vote after two seconds.
    await observer.tap(run, 'independent-vote')
    await runtime.dispatchFetch('https://office.test/clock?advance=2000')
    await changed.tap(run, 'after-cooldown')
    const final = await connect('final', '192.0.2.3')
    if (final.snapshot.op !== 'snapshot') throw new Error('Missing snapshot')
    assert.equal(final.snapshot.run?.drops.length, 5)
    assert.equal(JSON.stringify(final.snapshot).includes(guest.cookie.split('=')[1]!), false, 'Public snapshots never contain the enrollment credential')

    // Twenty phones on one router can finish the audience experiment within thirty seconds.
    const audience = []
    for (let index = 0; index < 20; index++) audience.push(await connect('phone-' + index, '203.0.113.20'))
    for (let turn = 0; turn < 15; turn++) {
      for (const phone of audience) await phone.tap(run, 'turn-' + turn)
      if (turn < 14) await runtime.dispatchFetch('https://office.test/clock?advance=2000')
    }
    const completed = await connect('completed', '192.0.2.4')
    if (completed.snapshot.op !== 'snapshot') throw new Error('Missing snapshot')
    assert.equal(specimenCount(completed.snapshot.run), 800, 'Twenty phones complete the experiment in twenty-eight seconds')

    host.send({ op: 'close', run })
    await host.receive('snapshot')
    host.send({ op: 'open' })
    const reopened = await host.receive('snapshot')
    if (reopened.op !== 'snapshot' || !reopened.run) throw new Error('Missing run')
    const nextRun = reopened.run.id
    await host.tap(nextRun, 'calibration', 'snail')
    await runtime.dispatchFetch('https://office.test/clock?advance=4000')
    const cohort = []
    for (let index = 0; index < 100; index++) cohort.push(await connect('cohort-' + index, '203.0.113.9'))
    const excess = await runtime.dispatchFetch('https://office.test/api/office?device=excess', {
      headers: { Upgrade: 'websocket', 'CF-Connecting-IP': '203.0.113.9',
        Cookie: 'brundlefly-office-participant=invented', 'X-Forwarded-For': '198.51.100.4' },
    })
    assert.equal(excess.status, 429, 'Discarded cookies and forwarding headers cannot bypass network enrollment limits')
    for (const phone of cohort) await phone.tap(nextRun, 'first')
    await runtime.dispatchFetch('https://office.test/clock?advance=60000')
    const later = []
    for (let index = 0; index < 100; index++) later.push(await connect('later-' + index, '203.0.113.9'))
    for (const phone of cohort) await phone.tap(nextRun, 'second')
    await runtime.unsafeEvictDurableObject('office-test', 'OfficeRoom', { name: 'presentation', webSockets: 'hibernate' })
    for (const phone of later) await phone.tap(nextRun, 'excess')
    const limited = await connect('limited', '192.0.2.5')
    if (limited.snapshot.op !== 'snapshot') throw new Error('Missing snapshot')
    assert.equal(limited.snapshot.run?.drops.length, 201, 'A network accepts at most one hundred votes per two seconds, across hibernation')
    await limited.tap(nextRun, 'independent')
    await runtime.dispatchFetch('https://office.test/clock?advance=2000')
    await later[0]!.tap(nextRun, 'after-network-cooldown')
    const recovered = await connect('recovered', '192.0.2.6')
    if (recovered.snapshot.op !== 'snapshot') throw new Error('Missing snapshot')
    assert.equal(recovered.snapshot.run?.drops.length, 203, 'Independent networks and recovered quotas keep voting')
  } finally {
    for (const socket of sockets) socket.close()
    await runtime.dispose()
  }
})
