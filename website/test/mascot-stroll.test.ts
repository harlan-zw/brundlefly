import assert from 'node:assert/strict'
import test from 'node:test'
import { advanceStroll, startStroll, strollPose } from '../layers/brand/shared/mascot-stroll.ts'
import type { Stroll, StrollAttention } from '../layers/brand/shared/mascot-stroll.ts'

const route = [[2, 0], [0, 0]] as const
const pauses = [1.5, 2.5]
const frame = 1 / 60
const run = (state: Stroll, seconds: number, attention: StrollAttention = 'free', visit?: (state: Stroll) => void) => {
  for (let elapsed = 0; elapsed < seconds; elapsed += frame) {
    state = advanceStroll(state, { delta: frame, route, pauses, walkSpeed: 0.5, attention })
    visit?.(state)
  }
  return state
}

test('he pauses at each waypoint for its listed time before walking on', () => {
  let arrived: Stroll | undefined
  let state = run(startStroll([0, 0], 0), 12, 'free', value => { if (!arrived && value.activity._tag === 'Pausing') arrived = value })
  assert.ok(arrived, 'He must stop at the first waypoint.')
  assert.ok(Math.abs(arrived.position[0] - 2) < 0.05, 'The pause must begin at the waypoint.')
  state = run(arrived, 1.4)
  assert.ok(Math.abs(state.position[0] - arrived.position[0]) < 0.01, 'He must stay put during the pause.')
  state = run(state, 1.5)
  assert.ok(state.position[0] < arrived.position[0] - 0.1, 'He must walk toward the next waypoint after the pause.')
})

test('the stride fades in and out without a jump', () => {
  let previous = strollPose(startStroll([0, 0], 0), 0.5).gait
  let largest = 0, fullest = 0, quietest = 1
  run(startStroll([0, 0], 0), 20, 'free', state => {
    const { gait } = strollPose(state, 0.5)
    largest = Math.max(largest, Math.abs(gait - previous))
    previous = gait
    fullest = Math.max(fullest, gait)
    if (state.activity._tag === 'Pausing' && state.activity.remaining < 0.5) quietest = Math.min(quietest, gait)
  })
  assert.ok(largest < 0.12, `One frame must not change the stride by ${largest.toFixed(3)}.`)
  assert.ok(fullest > 0.95, 'Walking must reach the full stride.')
  assert.ok(quietest < 0.02, 'A pause must settle into the standing pose.')
})

test('noticing the visitor stops him with a head tilt, and he resumes afterward', () => {
  const walking = run(startStroll([0, 0], 0), 1)
  const noticed = run(walking, 2, 'noticed')
  const held = run(noticed, 0.5, 'noticed')
  assert.ok(Math.abs(held.position[0] - noticed.position[0]) < 0.001, 'He must stand still while noticed.')
  assert.ok(strollPose(held, 0.5).gait < 0.01, 'His legs must settle while noticed.')
  assert.ok(strollPose(held, 0.5).gaze.tilt > 0.03, 'He must tilt his head toward the visitor.')
  const resumed = run(held, 1)
  assert.ok(resumed.position[0] > held.position[0] + 0.1, 'He must walk on after the visitor leaves.')
})

test('before leaving a pause he looks toward the next waypoint', () => {
  let ending: Stroll | undefined
  run(startStroll([0, 0], 0), 12, 'free', state => {
    if (!ending && state.activity._tag === 'Pausing' && state.activity.remaining < 0.05) ending = state
  })
  assert.ok(ending, 'The walk must reach the end of a pause.')
  assert.ok(strollPose(ending, 0.5).gaze.yaw < -0.05, 'The next waypoint lies toward negative x, so his head must turn that way first.')
})
