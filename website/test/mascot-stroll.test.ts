import assert from 'node:assert/strict'
import test from 'node:test'
import { advanceStroll, advanceTurn, settleTurn, startStroll, startTurn, strollPose, travelYaw, turnRates } from '../layers/brand/shared/mascot-stroll.ts'
import type { Stroll, StrollAttention, Turn } from '../layers/brand/shared/mascot-stroll.ts'

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

const facing = { route, walkSpeed: 0.5, rest: 0.5, limit: 1.3 }
/** The most he may turn in one frame for the steps he takes. */
const allowed = (state: Stroll, turn: Turn) => (turnRates.walking * strollPose(state, 0.5).gait + turnRates.inPlace * turn.steps) * frame + 1e-9

test('walking, he faces his travel up to the limit; standing, he holds the three-quarter turn', () => {
  let turn = startTurn(0.5)
  let widest = 0, heldWhilePaused = true
  // The first waypoint is straight to screen right, so his travel is a quarter turn from the viewer. The second is to screen left.
  const state = run(startStroll([0, 0], 0), 9, 'free', (value) => {
    turn = advanceTurn(turn, value, { ...facing, delta: frame, attention: 'free' })
    if (value.activity._tag === 'Walking' && value.destination === 0) widest = Math.max(widest, turn.heading)
    if (value.activity._tag === 'Pausing' && value.activity.waypoint === 0 && value.activity.remaining > 1.2 && value.activity.age > 1) heldWhilePaused &&= Math.abs(turn.heading - 0.5) < 0.1 && turn.steps < 0.01
  })
  assert.ok(widest > 1.25 && widest <= 1.3, `He must face his travel up to the limit, not ${widest.toFixed(2)}.`)
  assert.ok(heldWhilePaused, 'He must hold the three-quarter turn, with both feet down, while he stands.')
  assert.equal(state.activity._tag, 'Walking')
  assert.ok(turn.heading < -1.2, 'He must face screen left while he walks there.')
  // A visitor stops him mid-walk. He steps round to the three-quarter turn on the side he faces, then stands.
  let stopped = state
  for (let elapsed = 0; elapsed < 4; elapsed += frame) {
    stopped = advanceStroll(stopped, { delta: frame, route, pauses, walkSpeed: 0.5, attention: 'noticed' })
    turn = advanceTurn(turn, stopped, { ...facing, delta: frame, attention: 'noticed' })
  }
  assert.ok(Math.abs(turn.heading + 0.5) < 0.05, `He must end near the three-quarter turn, not at ${turn.heading.toFixed(2)}.`)
  assert.ok(turn.steps < 0.01, 'He must stand with both feet down once the turn ends.')
})

test('he turns only as fast as his feet carry him, whatever a visitor does and whenever', () => {
  // A fixed pseudo-random sequence switches the visitor's attention at uneven moments through several laps.
  let seed = 7
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  let state = startStroll([0, 0], 0), turn = startTurn(0.5)
  let attention: StrollAttention = 'free', until = 0, turnedInPlace = 0
  for (let elapsed = 0; elapsed < 120; elapsed += frame) {
    if (elapsed >= until) { const pick = random(); attention = pick < 0.6 ? 'free' : pick < 0.8 ? 'noticed' : 'talking'; until = elapsed + 0.2 + random() * 2.4 }
    state = advanceStroll(state, { delta: frame, route, pauses, walkSpeed: 0.5, attention })
    const next = advanceTurn(turn, state, { ...facing, delta: frame, attention })
    const moved = Math.abs(next.heading - turn.heading)
    assert.ok(moved <= allowed(state, next), `At ${elapsed.toFixed(2)} s he turned ${moved} with gait ${strollPose(state, 0.5).gait} and steps ${next.steps}.`)
    if (strollPose(state, 0.5).gait < 0.05) turnedInPlace += moved
    assert.ok(Math.abs(next.heading) <= 1.3 + 1e-9)
    turn = next
  }
  assert.ok(turnedInPlace > 1, 'The laps must include turns in place, or this test proves nothing.')
})

test('before he leaves for the other side he steps round to it, and a visitor who holds him stops that', () => {
  // The stops in the lair last 1.8 seconds or more. These last long enough for him to settle before the turn.
  const pauses = [3.5, 3.5]
  const pauseAt = (remaining: number) => {
    let state = startStroll([0, 0], 0), turn = startTurn(0.5)
    while (!(state.activity._tag === 'Pausing' && state.activity.remaining <= remaining)) {
      state = advanceStroll(state, { delta: frame, route, pauses, walkSpeed: 0.5, attention: 'free' })
      turn = advanceTurn(turn, state, { ...facing, delta: frame, attention: 'free' })
    }
    return { state, turn }
  }
  // Left alone, he steps in place through the end of the pause and faces screen left before he walks.
  let { state, turn } = pauseAt(1.3)
  assert.ok(Math.abs(turn.heading - 0.5) < 0.1 && turn.steps < 0.01)
  let stepped = 0
  while (state.activity._tag === 'Pausing') {
    state = advanceStroll(state, { delta: frame, route, pauses, walkSpeed: 0.5, attention: 'free' })
    turn = advanceTurn(turn, state, { ...facing, delta: frame, attention: 'free' })
    stepped = Math.max(stepped, turn.steps)
  }
  assert.ok(stepped > 0.8, 'He must step in place to turn.')
  assert.ok(turn.heading < -0.3 && turn.side === -1, `He must face the next side as he leaves, not ${turn.heading.toFixed(2)}.`)
  // A visitor who hovers before the turn begins keeps him as he stands.
  const held = pauseAt(1.3)
  for (let elapsed = 0; elapsed < 3; elapsed += frame) {
    held.state = advanceStroll(held.state, { delta: frame, route, pauses, walkSpeed: 0.5, attention: 'noticed' })
    held.turn = advanceTurn(held.turn, held.state, { ...facing, delta: frame, attention: 'noticed' })
  }
  assert.ok(Math.abs(held.turn.heading - 0.5) < 0.1 && held.turn.steps < 0.01 && held.turn.side === 1)
  // A dialog that opens in the middle of the turn lets him finish it, to the side he was turning to.
  const midTurn = pauseAt(0.7)
  assert.equal(midTurn.turn.side, -1)
  for (let elapsed = 0; elapsed < 3; elapsed += frame) {
    midTurn.state = advanceStroll(midTurn.state, { delta: frame, route, pauses, walkSpeed: 0.5, attention: 'talking' })
    midTurn.turn = advanceTurn(midTurn.turn, midTurn.state, { ...facing, delta: frame, attention: 'talking' })
  }
  assert.ok(Math.abs(midTurn.turn.heading + 0.5) < 0.05 && midTurn.turn.steps < 0.01)
})

test('with motion off he stands where the turn would end, with both feet down', () => {
  const state = run(startStroll([0, 0], 0), 0.2)
  const settled = settleTurn({ heading: 0.1, steps: 0.7, phase: 2, side: -1 }, { ...state, speed: 0, activity: { _tag: 'Pausing', remaining: 2, duration: 3, waypoint: 0, age: 1 } }, { ...facing, attention: 'free' })
  assert.deepEqual({ heading: settled.heading, steps: settled.steps, side: settled.side }, { heading: -0.5, steps: 0, side: -1 })
})

test('the walk cycle advances by the cadence for each unit he travels', () => {
  let state = startStroll([0, 0], 0)
  for (let elapsed = 0; elapsed < 2; elapsed += frame) state = advanceStroll(state, { delta: frame, route, pauses, walkSpeed: 0.5, attention: 'free', cadence: 6 })
  assert.ok(state.position[0] > 0.5)
  assert.ok(Math.abs(state.phase - state.position[0] * 6) < 1e-6)
  assert.ok(Math.abs(travelYaw(state, route) - Math.PI / 2) < 1e-6, 'A waypoint to screen right is a quarter turn from the viewer.')
})
