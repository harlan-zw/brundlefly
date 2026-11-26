import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addTaps, criticalSceneSeconds, defaultParty, emptyExperiment, goCritical, loadedPercent, phase, readPartySettings, readCommand, readRoomMessage, resetExperiment, revealExperiment, revealSwellSeconds, setTarget, specimenCount, tapsPerSecond, targetLimits } from '../shared/office-experiment.ts'
import type { Experiment, RoomMessage, Tally } from '../shared/office-experiment.ts'

const tally = (counts: Partial<Tally>): Tally => ({ snail: 0, beetle: 0, fly: 0, cricket: 0, ...counts })
const counting = (counts: Partial<Tally>, target = targetLimits.initial): Experiment => ({ ...emptyExperiment(3, target), tally: tally(counts) })

test('addTaps adds one specimen for each tap', () => {
  const once = addTaps(emptyExperiment(), 'snail', 1, 10)
  assert.deepEqual(once, { ...emptyExperiment(), tally: tally({ snail: 1 }) })
  assert.deepEqual(addTaps(once, 'fly', 3, 20).tally, tally({ snail: 1, fly: 3 }))
  assert.deepEqual(addTaps(once, 'fly', 2.9, 20).tally, tally({ snail: 1, fly: 2 }), 'A fraction of a tap is no tap')
})

test('addTaps without a whole tap returns the same experiment', () => {
  const experiment = counting({ beetle: 4 })
  for (const taps of [0, -5, 0.5]) assert.equal(addTaps(experiment, 'beetle', taps, 10), experiment)
})

test('the tap that reaches the target stops the count and sets the critical time', () => {
  const near = counting({ beetle: 48 }, 50)
  const reached = addTaps(near, 'cricket', 20, 1234)
  assert.equal(specimenCount(reached), 50)
  assert.deepEqual(reached.tally, tally({ beetle: 48, cricket: 2 }))
  assert.equal(reached.criticalAt, 1234)
  assert.equal(addTaps(reached, 'fly', 1, 2000), reached, 'Taps after critical change nothing')
  assert.equal(addTaps(near, 'fly', 1, 1000).criticalAt, null, 'A count under the target stays counting')
})

test('setTarget keeps the tally and keeps the target inside its limits', () => {
  const experiment = counting({ fly: 10 })
  assert.deepEqual(setTarget(experiment, 4000, 5), { ...experiment, target: 4000 })
  assert.equal(setTarget(experiment, 1, 5).target, targetLimits.least)
  assert.equal(setTarget(experiment, 10 ** 9, 5).target, targetLimits.most)
  assert.equal(setTarget(experiment, 99.6, 5).target, 100)
})

test('setTarget at or under the count goes critical at once', () => {
  const experiment = counting({ fly: 60 })
  assert.deepEqual(setTarget(experiment, 60, 7), { ...experiment, target: 60, criticalAt: 7 })
  assert.deepEqual(setTarget(experiment, 1, 7), { ...experiment, target: targetLimits.least, criticalAt: 7 })
  const critical = setTarget(experiment, 10, 7)
  assert.equal(setTarget(critical, 5000, 9), critical, 'A critical run keeps its target')
})

test('goCritical goes critical at the current count', () => {
  const experiment = counting({ snail: 7, fly: 2 })
  assert.deepEqual(goCritical(experiment, 30), { ...experiment, criticalAt: 30 })
  assert.deepEqual(goCritical(emptyExperiment(), 30), { ...emptyExperiment(), criticalAt: 30 }, 'An empty run goes critical with no specimens')
  const critical = goCritical(experiment, 30)
  assert.equal(goCritical(critical, 90), critical)
})

test('resetExperiment raises the run, clears the tally, and keeps the target', () => {
  const critical = addTaps(counting({ beetle: 49 }, 50), 'beetle', 1, 10)
  assert.deepEqual(resetExperiment(critical), emptyExperiment(4, 50))
})

test('a forced critical keeps the target, so the next run counts to it', () => {
  const next = resetExperiment(goCritical(counting({ fly: 7 }), 10))
  assert.equal(next.target, targetLimits.initial)
  assert.equal(addTaps(next, 'fly', 7, 20).criticalAt, null)
  assert.equal(addTaps(resetExperiment(goCritical(emptyExperiment(), 10)), 'fly', 1, 20).criticalAt, null, 'After a forced critical on an empty run, the first tap of the next run only counts')
})

test('phase follows the count, critical scene, blackout hold, and reveal', () => {
  assert.equal(phase(emptyExperiment(), 0), 'Quiet')
  assert.equal(phase(counting({ cricket: 1 }), 0), 'Counting')
  const critical = goCritical(counting({ cricket: 1 }), 1000)
  assert.equal(phase(critical, 1000), 'Critical')
  assert.equal(phase(critical, 1000 + criticalSceneSeconds * 1000 - 1), 'Critical')
  assert.equal(phase(critical, 1000 + criticalSceneSeconds * 1000), 'Holding')
  const revealed = revealExperiment(critical, 1000 + criticalSceneSeconds * 1000 + 5000)
  assert.equal(revealed.revealAt, 1000 + criticalSceneSeconds * 1000 + 5000 + revealSwellSeconds * 1000)
  assert.equal(phase(revealed, revealed.revealAt! - 1), 'Critical')
  assert.equal(phase(revealed, revealed.revealAt!), 'Over')
})

test('revealExperiment requires critical, is idempotent, and never cuts the critical scene short', () => {
  const quiet = emptyExperiment()
  assert.equal(revealExperiment(quiet, 5000), quiet)
  const critical = goCritical(counting({ fly: 5 }), 1000)
  const early = revealExperiment(critical, 5000)
  assert.equal(early.revealAt, 1000 + criticalSceneSeconds * 1000)
  assert.equal(revealExperiment(early, 999_999), early, 'A second reveal changes nothing')
})

test('readCommand accepts the five commands', () => {
  assert.deepEqual(readCommand('{"op":"tap","kind":"snail","taps":1}'), { op: 'tap', kind: 'snail', taps: 1 })
  assert.deepEqual(readCommand(`{"op":"tap","kind":"cricket","taps":${tapsPerSecond}}`), { op: 'tap', kind: 'cricket', taps: tapsPerSecond })
  assert.deepEqual(readCommand('{"op":"reset","extra":true}'), { op: 'reset' })
  assert.deepEqual(readCommand('{"op":"critical"}'), { op: 'critical' })
  assert.deepEqual(readCommand('{"op":"reveal"}'), { op: 'reveal' })
  assert.deepEqual(readCommand('{"op":"target","value":4000}'), { op: 'target', value: 4000 })
  assert.deepEqual(readCommand('{"op":"target","value":1}'), { op: 'target', value: targetLimits.least }, 'A target outside the limits moves inside them')
})

test('readCommand rejects malformed messages and taps out of range', () => {
  const rejected = [
    '{', 'null', '[]', '"tap"', '{}', '{"op":"host","key":"x"}', '{"op":"open"}',
    '{"op":"tap","kind":"ant","taps":1}', '{"op":"tap","kind":"toString","taps":1}', '{"op":"tap","kind":"__proto__","taps":1}',
    '{"op":"tap","kind":"snail"}', '{"op":"tap","kind":"snail","taps":0}', '{"op":"tap","kind":"snail","taps":-1}',
    `{"op":"tap","kind":"snail","taps":${tapsPerSecond + 1}}`, '{"op":"tap","kind":"snail","taps":1.5}', '{"op":"tap","kind":"snail","taps":"3"}',
    '{"op":"target"}', '{"op":"target","value":"4000"}', '{"op":"target","value":null}',
    `{"op":"reset","pad":"${'x'.repeat(200)}"}`,
  ]
  for (const message of rejected) assert.equal(readCommand(message), undefined, message)
})

const state: RoomMessage = { op: 'state', experiment: { run: 2, tally: tally({ fly: 3 }), target: 50, criticalAt: 99, revealAt: null }, connected: 4, now: 1000,
  party: { chorusAt: 52.5, bpm: 104, leadIn: 14, playFor: 30, fadeOut: 6 } }

test('readRoomMessage reads a state and drops unknown fields', () => {
  assert.deepEqual(readRoomMessage(JSON.stringify(state)), state)
  const padded = { ...state, extra: 1, experiment: { ...state.experiment, extra: 1, tally: { ...state.experiment.tally, ant: 9 } } }
  assert.deepEqual(readRoomMessage(JSON.stringify(padded)), state)
  const uncritical = { ...state, experiment: { ...state.experiment, criticalAt: null } }
  assert.deepEqual(readRoomMessage(JSON.stringify(uncritical)), uncritical)
})

test('readRoomMessage rejects malformed states', () => {
  const broken = [
    'not json', 'null', JSON.stringify({ ...state, op: 'snapshot' }), JSON.stringify({ ...state, connected: -1 }),
    JSON.stringify({ ...state, connected: 1.5 }), JSON.stringify({ ...state, now: '1000' }),
    JSON.stringify({ ...state, experiment: undefined }), JSON.stringify({ ...state, experiment: { ...state.experiment, run: -1 } }),
    JSON.stringify({ ...state, experiment: { ...state.experiment, criticalAt: '99' } }),
    JSON.stringify({ ...state, experiment: { ...state.experiment, tally: { snail: 0, beetle: 0, fly: 3 } } }),
    JSON.stringify({ ...state, experiment: { ...state.experiment, tally: { ...state.experiment.tally, fly: 0.5 } } }),
  ]
  for (const message of broken) assert.equal(readRoomMessage(message), undefined, message)
})

test('the loaded percent is whole, and reads 100 only at the target', () => {
  const run = (snail: number) => ({ ...emptyExperiment(1, 3000), tally: { snail, beetle: 0, fly: 0, cricket: 0 } })
  assert.equal(loadedPercent(run(0)), 0)
  assert.equal(loadedPercent(run(1400)), 46)
  assert.equal(loadedPercent(run(2999)), 99, 'One specimen short of the target is not yet 100')
  assert.equal(loadedPercent(run(3000)), 100)
  // A target that the presenter lowered under the count still reads 100.
  assert.equal(loadedPercent({ ...run(900), target: 500 }), 100)
})

test('a state without celebration settings takes the defaults, so the dance always has a tempo', () => {
  const { party: _party, ...bare } = state
  assert.deepEqual(readRoomMessage(JSON.stringify(bare))?.party, defaultParty)
  assert.deepEqual(readRoomMessage(JSON.stringify({ ...bare, party: 'loud' }))?.party, defaultParty)
})

test('the party command carries settings inside their limits, and nothing else', () => {
  const settings = { chorusAt: 52.5, bpm: 104, leadIn: 14, playFor: 30, fadeOut: 6 }
  assert.deepEqual(readCommand(JSON.stringify({ op: 'party', settings })), { op: 'party', settings })
  // A hostile tempo is clamped, and a field that is no setting is dropped.
  const hostile = readCommand(JSON.stringify({ op: 'party', settings: { ...settings, bpm: 1e9, name: 'x', extra: 1 } }))
  assert.ok(hostile && hostile.op === 'party')
  assert.ok(hostile.settings.bpm < 1000)
  assert.deepEqual(Object.keys(hostile.settings).sort(), Object.keys(settings).sort())
  assert.equal(readCommand('{"op":"party"}'), undefined)
  assert.equal(readCommand('{"op":"party","settings":7}'), undefined)
  assert.equal(readPartySettings(null), undefined)
})
