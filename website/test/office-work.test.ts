import assert from 'node:assert/strict'
import { test } from 'node:test'
import { officePlan } from '../layers/brand/shared/office-layout.ts'
import { keyTaps, mannerismDuration, markerStrokes, poseMannerisms, roundHabits } from '../layers/brand/shared/mannerism.ts'
import { advanceTurn, settleTurn, startStroll, startTurn, workLimit } from '../layers/brand/shared/mascot-stroll.ts'
import type { Stroll } from '../layers/brand/shared/mascot-stroll.ts'
import { headCounterTurn, neckLimit } from '../layers/brand/shared/mascot-mesh.ts'

const turning = { walkSpeed: 1, rest: 0.5, limit: 1.3, attention: 'free' as const }
const standingAt = (waypoint: number): Stroll => ({ ...startStroll([0, 0], waypoint), activity: { _tag: 'Pausing', remaining: 5, duration: 6, waypoint, age: 1 } })
const near = (value: number, wanted: number, slack: number) => assert.ok(Math.abs(value - wanted) <= slack, `${value} is not within ${slack} of ${wanted}`)

test('a stop at his work turns him past the walking limit, and no further than the work limit', () => {
  const stand = standingAt(0)
  near(settleTurn(startTurn(0.5), stand, { ...turning, stand: -2.35 }).heading, -2.35, 1e-9)
  near(settleTurn(startTurn(0.5), stand, { ...turning, stand: 3.1 }).heading, workLimit, 1e-9)
  assert.ok(Math.abs(settleTurn(startTurn(0.5), stand, turning).heading) <= turning.limit)
})

test('he steps round to his work at a stop, and back when a visitor has his attention, with no jump', () => {
  let turn = startTurn(0.5)
  const stand = standingAt(0)
  let largest = 0
  const run = (seconds: number, input: Parameters<typeof advanceTurn>[2]) => {
    for (let time = 0; time < seconds; time += 1 / 60) {
      const next = advanceTurn(turn, stand, input)
      largest = Math.max(largest, Math.abs(next.heading - turn.heading))
      turn = next
    }
  }
  run(12, { ...turning, stand: -2.35, delta: 1 / 60 })
  near(turn.heading, -2.35, 0.13)
  run(12, { ...turning, attention: 'noticed', delta: 1 / 60 })
  assert.ok(Math.abs(turn.heading) <= turning.limit + 0.01, `he stays turned away at ${turn.heading}`)
  // A sixtieth of a second never carries more of the turn than his steps in place allow.
  assert.ok(largest < 0.05, `one frame turned him ${largest}`)
})

test('the typing habit strikes its keys in bursts, with pauses between', () => {
  assert.equal(keyTaps(0.5), 0)
  assert.ok(keyTaps(mannerismDuration({ _tag: 'TypeKeys' })) > 20)
  let last = 0
  for (let age = 0; age <= 6.4; age += 0.05) { assert.ok(keyTaps(age) >= last); last = keyTaps(age) }
  // Between the first and the second burst he reads, and strikes no key.
  assert.equal(keyTaps(2.85), keyTaps(2.35))
})

test('typing lifts both long arms, and tending a jar lifts the arm on the side the jar stands', () => {
  const typing = poseMannerisms([{ mannerism: { _tag: 'TypeKeys' }, age: 1.5 }]).turns
  assert.ok(typing['left-shoulder']![0] < -0.4 && typing['right-shoulder']![0] < -0.4)
  const right = poseMannerisms([{ mannerism: { _tag: 'TendJar' }, age: 2.5, side: 1 }]).turns
  const left = poseMannerisms([{ mannerism: { _tag: 'TendJar' }, age: 2.5, side: -1 }]).turns
  assert.ok(right['left-shoulder']![0] < -0.6)
  assert.equal(right['right-shoulder'], undefined)
  assert.ok(left['right-shoulder']![0] < -0.6)
})

test('the two stations have a work habit, a facing, and the longest stops of his round', () => {
  const stations = officePlan.stops.filter(stop => stop.facing !== undefined)
  assert.deepEqual(stations.map(stop => stop.habit), ['TypeKeys', 'TendJar'])
  const others = officePlan.stops.filter(stop => stop.facing === undefined)
  assert.ok(Math.min(...stations.map(stop => stop.pause)) > Math.max(...others.map(stop => stop.pause)))
  for (const stop of stations) assert.ok(mannerismDuration({ _tag: stop.habit }) < stop.pause)
})

test('a walk point with a second habit takes it on every second visit, and the others keep theirs', () => {
  const habits = ['TypeKeys', 'TendJar'] as const
  const alternates = ['WriteBoard', undefined] as const
  assert.deepEqual(roundHabits(habits, alternates, []), ['TypeKeys', 'TendJar'])
  assert.deepEqual(roundHabits(habits, alternates, [1, 1]), ['TypeKeys', 'TendJar'])
  assert.deepEqual(roundHabits(habits, alternates, [2, 2]), ['WriteBoard', 'TendJar'])
  assert.deepEqual(roundHabits(habits, alternates, [3, 4]), ['TypeKeys', 'TendJar'])
  assert.deepEqual(roundHabits(habits, undefined, [2, 2]), ['TypeKeys', 'TendJar'])
})

test('he writes four lines on the board, and lifts the writing arm higher than for a jar', () => {
  assert.equal(markerStrokes(0.5), 0)
  assert.equal(markerStrokes(1), 1)
  assert.equal(markerStrokes(mannerismDuration({ _tag: 'WriteBoard' })), 4)
  let last = 0
  for (let age = 0; age <= 6.2; age += 0.05) { assert.ok(markerStrokes(age) >= last); last = markerStrokes(age) }
  const board = poseMannerisms([{ mannerism: { _tag: 'WriteBoard' }, age: 2.5, side: -1 }]).turns
  const jar = poseMannerisms([{ mannerism: { _tag: 'TendJar' }, age: 2.5, side: -1 }]).turns
  assert.ok(board['right-shoulder']![0] < jar['right-shoulder']![0])
  assert.equal(board['left-shoulder'], undefined)
  const desk = officePlan.stops.find(stop => stop.alternate === 'WriteBoard')
  assert.ok(desk && desk.facing !== undefined && mannerismDuration({ _tag: 'WriteBoard' }) < desk.pause)
})

test('his head stays on the viewer up to the neck limit, and goes with his body when he turns to his work', () => {
  // Inside the walking limit the head undoes the whole turn, as before.
  for (const heading of [-1.3, -0.6, 0, 0.5, 1.3]) assert.ok(Math.abs(headCounterTurn(heading, 0) - heading) < 1e-9)
  // At a station the neck does not twist: the head keeps only a small turn back to the viewer.
  for (const heading of [2.3, -2.35, 2.5]) {
    const counter = headCounterTurn(heading, 0)
    assert.ok(Math.abs(counter) <= 0.25 && Math.sign(counter) === Math.sign(heading), `the neck twists ${counter} at ${heading}`)
  }
  // No heading asks more of the neck than its limit, and the turn has no jump.
  let last = headCounterTurn(-3, 0)
  for (let heading = -3; heading <= 3; heading += 0.01) {
    const counter = headCounterTurn(heading, 0)
    assert.ok(Math.abs(counter) <= neckLimit + 1e-9)
    assert.ok(Math.abs(counter - last) < 0.03, `the head jumps ${counter - last} at ${heading}`)
    last = counter
  }
  // While he walks the head keeps half of the turn.
  assert.ok(Math.abs(headCounterTurn(1, 1) - 0.5) < 1e-9)
})
