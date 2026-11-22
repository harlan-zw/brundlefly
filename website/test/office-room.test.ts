import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { URL } from 'node:url'
import { Miniflare } from 'miniflare'
import type { Command, RoomMessage } from '../shared/office-experiment.ts'

test('a participant cooldown survives reconnects and unverified identity changes', { timeout: 30000 }, async () => {
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
      const tap = async (run: string, id: string) => {
        send({ op: 'tap', run, id, kind: 'beetle' })
        send({ op: 'host', key: 'invalid-fixture-key' })
        await receive('error')
      }
      return { close, snapshot, send, receive, tap }
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
    guest.close()
    const reconnected = await connect('first-device')
    await reconnected.tap(run, 'reconnect-vote')
    const changed = await connect('invented-device', '203.0.113.7', {
      Cookie: 'brundlefly-office-device=invented', 'X-Forwarded-For': '198.51.100.2',
      'X-Real-IP': '198.51.100.3',
    })
    await changed.tap(run, 'changed-vote')
    await runtime.unsafeEvictDurableObject('office-test', 'OfficeRoom', { name: 'presentation', webSockets: 'hibernate' })
    const restarted = await connect('another-invented-device')
    await restarted.tap(run, 'restart-vote')
    const observer = await connect('observer', '192.0.2.2')
    assert.equal(observer.snapshot.op, 'snapshot')
    if (observer.snapshot.op !== 'snapshot') throw new Error('Missing snapshot')
    assert.equal(observer.snapshot.run?.drops.length, 2, 'Only calibration and the first vote count')
    for (const drop of observer.snapshot.run!.drops)
      assert.equal(drop.id.includes('203.0.113.7'), false, 'Public drop IDs do not disclose network addresses')
    // Independent networks keep voting. The original participant can vote after two seconds.
    await observer.tap(run, 'independent-vote')
    await runtime.dispatchFetch('https://office.test/clock?advance=2000')
    await changed.tap(run, 'after-cooldown')
    const final = await connect('final', '192.0.2.3')
    if (final.snapshot.op !== 'snapshot') throw new Error('Missing snapshot')
    assert.equal(final.snapshot.run?.drops.length, 4)
  } finally {
    for (const socket of sockets) socket.close()
    await runtime.dispose()
  }
})
