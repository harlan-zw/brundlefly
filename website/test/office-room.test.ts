import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { after, before, test } from 'node:test'
import { URL } from 'node:url'
import { Miniflare } from 'miniflare'
import { criticalSceneSeconds, defaultParty as emptyMessageParty, emptyExperiment, readRoomMessage, revealSwellSeconds, specimenCount, tapsPerSecond, targetLimits } from '../shared/office-experiment.ts'
import type { Command, Creature, RoomMessage, Tally } from '../shared/office-experiment.ts'

// The fixture extends the real room with test hooks and owns the clock.
// `sync` answers after the room handled every earlier message of that socket.
// `fireAlarm` runs the armed alarm only when it is due, and removes it first, as the runtime does.
const fixture = `
  import { OfficeRoom as Room } from './worker/office-room.ts'
  const realNow = Date.now
  let now = 0
  Date.now = () => now
  export class OfficeRoom extends Room {
    webSocketMessage(socket, message) {
      if (message === 'sync') return socket.send('synced')
      return super.webSocketMessage(socket, message)
    }
    armed() { return this.ctx.storage.getAlarm() }
    async fireAlarm() {
      const at = await this.ctx.storage.getAlarm()
      if (at === null || at > Date.now()) return false
      await this.ctx.storage.deleteAlarm()
      await this.alarm()
      return true
    }
    spoil(text) { this.ctx.storage.sql.exec('UPDATE room SET experiment = ?', text) }
  }
  export default { async fetch(request, env) {
    // The clock starts at real time and only moves forward, so no alarm lands in the real past.
    now ||= realNow()
    const url = new URL(request.url)
    if (url.pathname === '/clock') { now += Number(url.searchParams.get('advance') ?? 0); return Response.json(now) }
    const room = env.OFFICE_ROOM.getByName(url.searchParams.get('room'))
    if (url.pathname === '/armed') return Response.json(await room.armed())
    if (url.pathname === '/fire') return Response.json(await room.fireAlarm())
    if (url.pathname === '/spoil') { await room.spoil(url.searchParams.get('text')); return Response.json(true) }
    return room.fetch(request)
  } }
`

let runtime: Miniflare
const sockets: { close: () => void }[] = []
before(async () => {
  const modules = Object.fromEntries(await Promise.all(['worker/office-room.ts', 'shared/office-experiment.ts', 'shared/party-track.ts'].map(async path => [path, {
    type: 'esm' as const,
    contents: stripTypeScriptTypes(await readFile(new URL(`../${path}`, import.meta.url), 'utf8')),
  }])))
  runtime = new Miniflare({ workers: [{ config: {
    name: 'office-test', compatibilityDate: '2026-10-04',
    exports: { OfficeRoom: { type: 'durable-object', storage: 'sqlite' } },
    manifest: { mainModule: 'fixture.mjs', modules: { ...modules, 'fixture.mjs': { type: 'esm', contents: fixture } } },
    env: { OFFICE_ROOM: { type: 'durable-object', worker: 'office-test', exportName: 'OfficeRoom' } },
  } }] })
})
after(async () => {
  for (const socket of sockets) socket.close()
  await runtime.dispose()
})

const call = async (path: string) => (await runtime.dispatchFetch(`https://office.test${path}`)).json() as Promise<unknown>
/** Move the shared clock forward and return the new time. */
const clock = async (advance = 0) => await call(`/clock?advance=${advance}`) as number
const armed = async (room: string) => await call(`/armed?room=${room}`) as number | null
const fireAlarm = async (room: string) => await call(`/fire?room=${room}`) as boolean
const evict = (room: string) => runtime.unsafeEvictDurableObject('office-test', 'OfficeRoom', { name: room, webSockets: 'hibernate' })
const tally = (counts: Partial<Tally>): Tally => ({ snail: 0, beetle: 0, fly: 0, cricket: 0, ...counts })
const minutes = 60_000

const request = (room: string, role: 'visitor' | 'watcher') =>
  runtime.dispatchFetch(`https://office.test/api/office?room=${room}${role === 'watcher' ? '&watch' : ''}`, { headers: { Upgrade: 'websocket' } })

async function open(room: string, role: 'visitor' | 'watcher' = 'visitor') {
  const response = await request(room, role)
  assert.equal(response.status, 101)
  const socket = response.webSocket!
  let closed = false
  const close = () => { if (!closed) { closed = true; socket.close() } }
  sockets.push({ close })
  const states: RoomMessage[] = []
  const invalid: string[] = []
  let latest: RoomMessage | undefined
  let synced = 0
  let wake = () => {}
  socket.addEventListener('message', (event) => {
    const data = String(event.data)
    if (data === 'synced') synced++
    else {
      const message = readRoomMessage(data)
      if (message) { states.push(message); latest = message }
      else invalid.push(data)
    }
    wake()
  })
  socket.accept()
  const wait = async <T>(find: () => T | undefined, label: string): Promise<T> => {
    const deadline = Date.now() + 5000
    for (;;) {
      assert.deepEqual(invalid, [], 'The room sends only messages that readRoomMessage accepts')
      const found = find()
      if (found !== undefined) return found
      if (Date.now() > deadline) throw new Error(`${label}. The last state was ${JSON.stringify(latest)}`)
      await new Promise<void>((resolve) => { wake = resolve; setTimeout(resolve, 50) })
    }
  }
  /** Wait for a state that passes `check`. Earlier states are skipped. */
  const until = (check: (message: RoomMessage) => boolean, label = 'No state matched') => wait(() => {
    while (states.length) {
      const message = states.shift()!
      if (check(message)) return message
    }
  }, label)
  const send = (command: Command | string | ArrayBuffer) => socket.send(typeof command === 'object' && !(command instanceof ArrayBuffer) ? JSON.stringify(command) : command)
  const tap = (kind: Creature, taps = 1) => send({ op: 'tap', kind, taps })
  /** Resolve after the room handled every earlier message of this socket. */
  const sync = async () => {
    const wanted = synced + 1
    socket.send('sync')
    await wait(() => synced >= wanted || undefined, 'The room did not answer the sync')
  }
  /** Take the last state that passes `check` from the states already here. After `sync`, it shows that the room sent the state at once. */
  const received = (check: (message: RoomMessage) => boolean) => {
    const index = states.findLastIndex(check)
    return index < 0 ? undefined : states.splice(0, index + 1).at(-1)
  }
  // The room sends the state on connect, before it answers any message and before the next broadcast.
  await sync()
  const first = states.shift()
  assert.ok(first, 'The room sent no state on connect')
  return { first, send, tap, sync, until, received, close }
}
type Socket = Awaited<ReturnType<typeof open>>

/** Send taps one clock second at a time, so the rate limit accepts all of them. */
async function tapMany(socket: Socket, kind: Creature, count: number) {
  for (let left = count; left > 0; left -= tapsPerSecond) {
    await clock(1000)
    socket.tap(kind, Math.min(tapsPerSecond, left))
    await socket.sync()
  }
}

test('a request without a WebSocket upgrade gets 400', async () => {
  const response = await runtime.dispatchFetch('https://office.test/api/office?room=plain')
  assert.equal(response.status, 400)
  await response.arrayBuffer()
})

test('taps from one visitor reach every socket, and one tap is one specimen', async () => {
  const first = await open('two-visitors')
  const second = await open('two-visitors')
  await clock(1000)
  for (let tap = 0; tap < 7; tap++) first.tap('snail')
  for (let tap = 0; tap < 5; tap++) second.tap('beetle')
  await first.sync()
  await second.sync()
  const expected = tally({ snail: 7, beetle: 5 })
  for (const socket of [first, second]) {
    const seen = await socket.until(message => specimenCount(message.experiment) >= 12, 'The visitor never saw twelve specimens')
    assert.deepEqual(seen.experiment.tally, expected)
  }
  const observer = await open('two-visitors')
  assert.deepEqual(observer.first.experiment.tally, expected)
})

test('one socket gets at most tapsPerSecond taps in one clock second', async () => {
  const fast = await open('rate-limit')
  const other = await open('rate-limit')
  await clock(1000)
  for (let message = 0; message < 30; message++) fast.tap('fly', 2)
  await fast.sync()
  assert.equal(specimenCount((await open('rate-limit')).first.experiment), tapsPerSecond, 'The room drops taps over the limit')
  other.tap('fly', tapsPerSecond)
  await other.sync()
  assert.equal(specimenCount((await open('rate-limit')).first.experiment), tapsPerSecond * 2, 'The limit is per socket')
  await clock(1000)
  for (let message = 0; message < 3; message++) fast.tap('fly')
  await fast.sync()
  assert.equal(specimenCount((await open('rate-limit')).first.experiment), tapsPerSecond * 2 + 3, 'The next clock second accepts taps again')
})

test('the tap that reaches the target goes critical once, and a later visitor gets the same state', async () => {
  const visitors = [await open('critical'), await open('critical'), await open('critical')]
  visitors[0]!.send({ op: 'target', value: targetLimits.least })
  await visitors[0]!.until(message => message.experiment.target === targetLimits.least)
  const reached = await clock(1000)
  visitors[0]!.tap('snail', 20)
  visitors[1]!.tap('beetle', 20)
  visitors[2]!.tap('cricket', 20)
  for (const visitor of visitors) await visitor.sync()
  // The critical tap has been handled now, so its broadcast is ahead of the next sync reply on every socket.
  const seen = []
  for (const visitor of visitors) {
    await visitor.sync()
    seen.push(visitor.received(message => message.experiment.criticalAt !== null))
  }
  const critical = seen[0]
  assert.ok(critical, 'The critical state did not go out at once')
  assert.equal(specimenCount(critical.experiment), targetLimits.least, 'The count stops at the target')
  assert.equal(critical.experiment.criticalAt, reached)
  for (const state of seen.slice(1)) assert.deepEqual(state?.experiment, critical.experiment)
  await clock(1000)
  visitors[1]!.tap('fly', 5)
  await visitors[1]!.sync()
  const late = await open('critical')
  assert.deepEqual(late.first.experiment, critical.experiment, 'Taps after critical change nothing')
})

test('reset, target and critical change the run as the contract says, and go out at once', async () => {
  const presenter = await open('commands')
  /** Send one command and take the state it broadcast. The state must arrive before the sync reply. */
  const command = async (sent: Command) => {
    presenter.send(sent)
    await presenter.sync()
    const state = presenter.received(() => true)
    assert.ok(state, `The room did not broadcast ${sent.op} at once`)
    return state.experiment
  }
  await tapMany(presenter, 'cricket', 10)
  assert.deepEqual(await command({ op: 'target', value: 4000 }), { run: 0, tally: tally({ cricket: 10 }), target: 4000, criticalAt: null, revealAt: null }, 'A target keeps the tally')
  assert.deepEqual(await command({ op: 'reset' }), emptyExperiment(1, 4000), 'A reset raises the run, clears the tally, and keeps the target')

  await tapMany(presenter, 'fly', 60)
  const lowered = await clock()
  assert.deepEqual(await command({ op: 'target', value: 1 }), { run: 1, tally: tally({ fly: 60 }), target: targetLimits.least, criticalAt: lowered, revealAt: null }, 'A target at or under the count goes critical')

  assert.deepEqual(await command({ op: 'reset' }), emptyExperiment(2, targetLimits.least))
  // Fewer taps than the least target, so the run still counts when the presenter forces it.
  await tapMany(presenter, 'snail', 3)
  const forced = await clock()
  assert.deepEqual(await command({ op: 'critical' }), { run: 2, tally: tally({ snail: 3 }), target: targetLimits.least, criticalAt: forced, revealAt: null }, 'Critical goes critical at the current count and keeps the target')

  const revealedAt = await clock(criticalSceneSeconds * 1000 + 5000)
  assert.deepEqual(await command({ op: 'reveal' }), { run: 2, tally: tally({ snail: 3 }), target: targetLimits.least, criticalAt: forced, revealAt: revealedAt + revealSwellSeconds * 1000 }, 'Reveal ends the blackout hold after the swell')
})

test('a burst of taps reaches the other sockets in a few coalesced broadcasts', async () => {
  const watcher = await open('coalesce', 'watcher')
  const visitor = await open('coalesce')
  await watcher.until(message => message.connected === 1)
  await clock(1000)
  for (let tap = 0; tap < tapsPerSecond; tap++) visitor.tap('cricket')
  await visitor.sync()
  let broadcasts = 0
  await watcher.until((message) => { broadcasts++; return specimenCount(message.experiment) === tapsPerSecond }, 'The watcher never saw the burst')
  assert.ok(broadcasts <= 4, `${tapsPerSecond} taps came in ${broadcasts} broadcasts`)
})

test('a watcher is not a visitor in the count, and a closed visitor leaves it', async () => {
  const watcher = await open('presence', 'watcher')
  assert.equal(watcher.first.connected, 0)
  const first = await open('presence')
  assert.equal(first.first.connected, 1)
  await watcher.until(message => message.connected === 1, 'The watcher never saw the first visitor')
  const second = await open('presence')
  assert.equal(second.first.connected, 2)
  await watcher.until(message => message.connected === 2, 'The watcher never saw the second visitor')
  first.close()
  await watcher.until(message => message.connected === 1, 'The count kept the closed visitor')
  await second.until(message => message.connected === 1)
})

test('invalid messages change nothing and leave the socket open', async () => {
  const visitor = await open('invalid')
  await clock(1000)
  for (const message of ['not json', '{"op":"tap","kind":"ant","taps":1}', `{"op":"tap","kind":"fly","taps":${tapsPerSecond + 1}}`, '{"op":"tap","kind":"fly","taps":0}', '{"op":"host"}'])
    visitor.send(message)
  visitor.send(new TextEncoder().encode('{"op":"reset"}').buffer as ArrayBuffer)
  visitor.tap('fly')
  await visitor.sync()
  const state = await visitor.until(message => specimenCount(message.experiment) > 0, 'The valid tap never arrived')
  assert.deepEqual(state.experiment, { ...emptyExperiment(), tally: tally({ fly: 1 }) })
})

test('the state and the watcher mark survive eviction', async () => {
  const watcher = await open('eviction', 'watcher')
  const visitor = await open('eviction')
  await tapMany(visitor, 'beetle', 3)
  const saved = await watcher.until(message => specimenCount(message.experiment) === 3)
  await evict('eviction')
  const late = await open('eviction')
  assert.deepEqual(late.first.experiment, saved.experiment)
  assert.equal(late.first.connected, 2, 'The watcher stays out of the count after eviction')
  await clock(1000)
  for (let message = 0; message < 30; message++) visitor.tap('beetle', 2)
  await visitor.sync()
  assert.equal(specimenCount((await open('eviction')).first.experiment), 3 + tapsPerSecond, 'A hibernated socket taps, and the rate limit still holds')
})

test('a saved state that does not parse loads as an empty experiment', async () => {
  for (const [index, text] of ['not json', '{"run":1,"tally":{},"target":3000,"criticalAt":null}'].entries()) {
    const room = `spoiled-${index}`
    const visitor = await open(room)
    await tapMany(visitor, 'fly', 2)
    await visitor.until(message => specimenCount(message.experiment) === 2)
    await call(`/spoil?room=${room}&text=${encodeURIComponent(text)}`)
    await evict(room)
    assert.deepEqual((await open(room)).first.experiment, emptyExperiment())
  }
})

test('thirty minutes after critical the alarm starts a new run', async () => {
  const watcher = await open('alarm-critical', 'watcher')
  const visitor = await open('alarm-critical')
  await tapMany(visitor, 'snail', 5)
  const criticalAt = await clock()
  watcher.send({ op: 'critical' })
  await watcher.until(message => message.experiment.criticalAt === criticalAt)
  assert.equal(await armed('alarm-critical'), criticalAt + 30 * minutes)
  await clock(30 * minutes - 1)
  assert.equal(await fireAlarm('alarm-critical'), false, 'The alarm is not due yet')
  await clock(1)
  assert.equal(await fireAlarm('alarm-critical'), true)
  const cleared = await visitor.until(message => message.experiment.run === 1, 'The alarm did not reset the run')
  assert.equal(specimenCount(cleared.experiment), 0)
  assert.equal(cleared.experiment.criticalAt, null)
  assert.equal(await armed('alarm-critical'), null, 'A quiet run has no alarm')
})

test('an old alarm keeps a reset run that people tap on, and two idle hours clear it', async () => {
  const room = 'alarm-idle'
  const watcher = await open(room, 'watcher')
  const visitor = await open(room)
  await tapMany(visitor, 'beetle', 3)
  const firstTap = await clock()
  assert.equal(await armed(room), firstTap + 120 * minutes, 'The first specimen arms the idle deadline')
  watcher.send({ op: 'critical' })
  await watcher.until(message => message.experiment.criticalAt === firstTap)
  assert.equal(await armed(room), firstTap + 30 * minutes, 'Critical moves the alarm earlier')

  await clock(20 * minutes)
  watcher.send({ op: 'reset' })
  watcher.send({ op: 'target', value: targetLimits.initial })
  await watcher.until(message => message.experiment.run === 1 && message.experiment.target === targetLimits.initial)
  await clock(9 * minutes - 1000)
  await tapMany(visitor, 'fly', 4)
  const lastTap = await clock()
  await watcher.until(message => specimenCount(message.experiment) === 4)
  // A new instance reads the time of the last tap from storage.
  await evict(room)
  await clock(firstTap + 30 * minutes - lastTap)
  assert.equal(await fireAlarm(room), true)
  const kept = await open(room)
  assert.deepEqual(kept.first.experiment, { ...emptyExperiment(1), tally: tally({ fly: 4 }) }, 'The old alarm did not wipe the new run')
  assert.equal(await armed(room), lastTap + 120 * minutes, 'The alarm checks again two hours after the last tap')

  await clock(lastTap + 120 * minutes - 1 - await clock())
  assert.equal(await fireAlarm(room), false)
  await clock(1)
  assert.equal(await fireAlarm(room), true)
  const cleared = await watcher.until(message => message.experiment.run === 2, 'Two idle hours did not clear the run')
  assert.equal(specimenCount(cleared.experiment), 0)
})

test('the room refuses a socket over 400 with 503', { timeout: 60_000 }, async () => {
  for (let index = 0; index < 400; index++) {
    const response = await request('full', 'visitor')
    assert.equal(response.status, 101)
    const socket = response.webSocket!
    socket.accept()
    sockets.push({ close: () => socket.close() })
  }
  const refused = await request('full', 'visitor')
  assert.equal(refused.status, 503)
  await refused.arrayBuffer()
})

test('celebration settings reach every socket at once, and a reset keeps them', async () => {
  const presenter = await open('party', 'watcher')
  const visitor = await open('party')
  const settings = { chorusAt: 52.5, bpm: 104, leadIn: 14, playFor: 30, fadeOut: 6 }
  assert.deepEqual(visitor.first.party, emptyMessageParty, 'A new room has the default settings')
  presenter.send({ op: 'party', settings })
  const told = await visitor.until(message => message.party.bpm === 104, 'The visitor never got the settings')
  assert.deepEqual(told.party, settings)
  presenter.send({ op: 'reset' })
  const fresh = await visitor.until(message => message.experiment.run === 1)
  assert.deepEqual(fresh.party, settings, 'The settings belong to the song, not to a run')
  // A visitor who connects later gets them with the first state.
  const late = await open('party')
  assert.deepEqual(late.first.party, settings)
})
