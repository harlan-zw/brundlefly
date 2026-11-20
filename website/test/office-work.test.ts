import assert from 'node:assert/strict'
import { test } from 'node:test'
import { officePlan } from '../layers/brand/shared/office-layout.ts'
import { keyTaps, mannerismDuration, poseMannerisms } from '../layers/brand/shared/mannerism.ts'
import { advanceTurn, settleTurn, startStroll, startTurn, workLimit } from '../layers/brand/shared/mascot-stroll.ts'
import type { Stroll } from '../layers/brand/shared/mascot-stroll.ts'

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
