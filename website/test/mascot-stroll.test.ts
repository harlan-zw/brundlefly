import assert from 'node:assert/strict'
import test from 'node:test'
import { advanceHeading, advanceStroll, startStroll, strollPose, travelYaw } from '../layers/brand/shared/mascot-stroll.ts'
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

test('walking, he faces his travel up to the limit; standing, he holds the three-quarter turn and turns before he leaves', () => {
  const heading = { delta: frame, route, walkSpeed: 0.5, rest: 0.5, limit: 1.3 }
  let yaw = 0.5
  let widest = 0, heldWhilePaused = true, turnedWhilePaused = false
  // The first waypoint is straight to screen right, so his travel is a quarter turn from the viewer. The second is to screen left.
  const state = run(startStroll([0, 0], 0), 9, 'free', (value) => {
    yaw = advanceHeading(yaw, value, heading)
    if (value.activity._tag === 'Walking' && value.destination === 0) widest = Math.max(widest, yaw)
    if (value.activity._tag === 'Pausing' && value.activity.waypoint === 0) {
      if (value.activity.remaining > 0.9 && value.activity.age > 1) heldWhilePaused &&= Math.abs(yaw - 0.5) < 0.02
      else if (value.activity.remaining < 0.1) turnedWhilePaused ||= yaw < 0
    }
  })
  assert.ok(widest > 1.25 && widest <= 1.3, `He must face his travel up to the limit, not ${widest.toFixed(2)}.`)
  assert.ok(heldWhilePaused, 'He must hold the three-quarter turn while he stands.')
  assert.ok(turnedWhilePaused, 'The turn must begin before the walk to screen left.')
  assert.equal(state.activity._tag, 'Walking')
  assert.ok(yaw < -1.2, 'He must face screen left while he walks there.')
  // A visitor stops him mid-walk. He eases back to the three-quarter turn on the side he faces.
  let stopped = state
  for (let elapsed = 0; elapsed < 3; elapsed += frame) {
    stopped = advanceStroll(stopped, { delta: frame, route, pauses, walkSpeed: 0.5, attention: 'noticed' })
    yaw = advanceHeading(yaw, stopped, heading)
  }
  assert.ok(Math.abs(yaw + 0.5) < 0.02)
})

test('the walk cycle advances by the cadence for each unit he travels', () => {
  let state = startStroll([0, 0], 0)
  for (let elapsed = 0; elapsed < 2; elapsed += frame) state = advanceStroll(state, { delta: frame, route, pauses, walkSpeed: 0.5, attention: 'free', cadence: 6 })
  assert.ok(state.position[0] > 0.5)
  assert.ok(Math.abs(state.phase - state.position[0] * 6) < 1e-6)
  assert.ok(Math.abs(travelYaw(state, route) - Math.PI / 2) < 1e-6, 'A waypoint to screen right is a quarter turn from the viewer.')
})
