import assert from 'node:assert/strict'
import test from 'node:test'
import { beats } from '../shared/conversation.ts'
import { beatMannerism, mannerismDuration, pauseMannerism, poseMannerisms } from '../layers/brand/shared/mannerism.ts'
import type { Mannerism, MannerismPose } from '../layers/brand/shared/mannerism.ts'
import { advanceStroll, startStroll } from '../layers/brand/shared/mascot-stroll.ts'
import type { Stroll } from '../layers/brand/shared/mascot-stroll.ts'

const atRest = (pose: MannerismPose) => Object.values(pose.turns).every(turn => turn.every(value => value === 0))
  && !pose.eyes && pose.buzz === 0 && pose.rub === 0 && pose.jaw === 0 && pose.blink === 0 && pose.calm === 0
const moves = (pose: MannerismPose) => !atRest(pose)
const performed = beats.filter(Boolean).map(beat => [beat, beatMannerism(beat)] as const)

test('every dialogue beat names a mannerism, and an empty beat performs nothing', () => {
  for (const [beat, mannerism] of performed) assert.notEqual(mannerism._tag, 'None', beat)
  assert.equal(new Set(performed.map(([, mannerism]) => mannerism._tag)).size, performed.length, 'Each beat needs its own movement.')
  assert.deepEqual(beatMannerism(''), { _tag: 'None' })
  assert.deepEqual(beatMannerism('He attacks the visitor.'), { _tag: 'None' })
})

test('each mannerism starts and ends at rest and moves in between', () => {
  for (const [beat, mannerism] of performed) {
    const duration = mannerismDuration(mannerism)
    assert.ok(atRest(poseMannerisms([{ mannerism, age: 0 }])), `${beat} must start at rest.`)
    assert.ok(moves(poseMannerisms([{ mannerism, age: duration / 2 }])), `${beat} must move.`)
    assert.ok(atRest(poseMannerisms([{ mannerism, age: duration }])), `${beat} must settle.`)
    assert.ok(atRest(poseMannerisms([{ mannerism, age: duration + 5 }])), `${beat} must stay settled.`)
  }
})

test('overlapping mannerisms add their turns', () => {
  const tilt: Mannerism = { _tag: 'HeadTilt' }
  const lean: Mannerism = { _tag: 'LeanIn' }
  const head = (layers: Parameters<typeof poseMannerisms>[0]) => poseMannerisms(layers).turns.head ?? [0, 0, 0]
  const both = head([{ mannerism: tilt, age: 1 }, { mannerism: lean, age: 1 }])
  const alone = [head([{ mannerism: tilt, age: 1 }]), head([{ mannerism: lean, age: 1 }])]
  both.forEach((value, axis) => assert.ok(Math.abs(value - alone[0]![axis]! - alone[1]![axis]!) < 1e-9))
})

test('each walk pause performs its habit and settles before he walks on', () => {
  const route = [[1, 0], [0, 0]] as const
  const pauses = [1.2, 3]
  const habits = ['ListenCeiling', 'GlanceEggs'] as const
  const frame = 1 / 60
  let state: Stroll = startStroll([0, 0], 0)
  let moved = false
  let previous: MannerismPose | undefined
  const finished: number[] = []
  for (let elapsed = 0; elapsed < 14; elapsed += frame) {
    const waypoint = state.activity._tag === 'Pausing' ? state.activity.waypoint : undefined
    state = advanceStroll(state, { delta: frame, route, pauses, walkSpeed: 0.5, attention: 'free' })
    const layer = pauseMannerism(state, habits)
    if (state.activity._tag === 'Pausing') {
      assert.equal(layer?.mannerism._tag, habits[state.activity.waypoint % habits.length])
      previous = poseMannerisms([layer!])
      moved ||= moves(previous)
      continue
    }
    assert.equal(layer, undefined, 'He performs no habit while walking.')
    if (waypoint === undefined) continue
    // This frame he walks on. The habit from the frame before must already be at rest.
    assert.ok(moved, `The habit at stop ${waypoint} must move.`)
    assert.ok(previous && atRest(previous), `The habit at stop ${waypoint} must settle before he walks on, even when the pause is short.`)
    finished.push(waypoint)
    moved = false
  }
  assert.deepEqual([...new Set(finished)].sort(), [0, 1], 'He must finish a pause at both waypoints.')
})
