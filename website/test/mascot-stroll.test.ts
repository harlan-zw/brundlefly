import assert from 'node:assert/strict'
import test from 'node:test'
import { swingShare } from '../layers/brand/shared/mascot-legs.ts'
import { advanceStroll, advanceTurn, leavingCourse, settled, settleTurn, startStroll, startTurn, stepRate, strollPace, strollPose, turnEase, turnPerStep } from '../layers/brand/shared/mascot-stroll.ts'
import type { Stroll, StrollAttention } from '../layers/brand/shared/mascot-stroll.ts'
import { travelTimes } from '../layers/brand/shared/set-travel.ts'
import { frame, meshCadence, meshWalk, sequence, startWalk, stepWalk, walkSets } from './walk-sim.ts'
import type { Point, Walk } from './walk-sim.ts'

const route = [[2, 0], [0, 0]] as const
const pauses = [1.5, 2.5]
const run = (state: Stroll, seconds: number, attention: StrollAttention = 'free', visit?: (state: Stroll) => void) => {
  for (let elapsed = 0; elapsed < seconds; elapsed += frame) {
    state = advanceStroll(state, { delta: frame, route, pauses, walkSpeed: 0.5, attention })
    visit?.(state)
  }
  return state
}
const between = (from: Point, to: Point) => Math.hypot(to[0] - from[0], to[1] - from[1])

test('he pauses at each waypoint for its listed time before walking on', () => {
  let arrived: Stroll | undefined
  let state = run(startStroll([0, 0], 0), 12, 'free', value => { if (!arrived && value.activity._tag === 'Pausing') arrived = value })
  assert.ok(arrived, 'He must stop at the first waypoint.')
  assert.ok(Math.abs(arrived.position[0] - 2) < 0.05, 'The pause must begin at the waypoint.')
  state = run(arrived, 1.4)
  // The last of his speed carries him a little further as his foot comes down. Then he stands.
  assert.ok(between(state.position, arrived.position) < 0.04 && between(state.position, route[0]) < 0.05, 'He must stay at the waypoint during the pause.')
  const stood = state.position
  assert.ok(settled(state), 'He must stand with both feet down during the pause.')
  state = run(state, 1.5)
  assert.ok(state.position[0] < stood[0] - 0.1, 'He must walk toward the next waypoint after the pause.')
})

test('the stride fades in and out without a jump', () => {
  let previous = strollPose(startStroll([0, 0], 0)).gait
  let largest = 0, fullest = 0, quietest = 1
  run(startStroll([0, 0], 0), 20, 'free', (state) => {
    const { gait } = strollPose(state)
    largest = Math.max(largest, Math.abs(gait - previous))
    previous = gait
    fullest = Math.max(fullest, gait)
    if (state.activity._tag === 'Pausing' && state.activity.remaining < 0.5) quietest = Math.min(quietest, gait)
  })
  assert.ok(largest < 0.06, `One frame must not change the stride by ${largest.toFixed(3)}.`)
  assert.ok(fullest > 0.95, 'Walking must reach the full stride.')
  assert.ok(quietest < 0.02, 'A pause must settle into the standing pose.')
})

test('noticing the visitor stops him with a head tilt, and he resumes afterward', () => {
  const walking = run(startStroll([0, 0], 0), 1.5)
  assert.ok(walking.speed > 0.45, 'He must be at a full walk before the visitor arrives.')
  // He ends the step he is in and stands. That takes less than one step of his walk.
  const stopped = run(walking, 0.8, 'noticed')
  assert.ok(settled(stopped), 'He must stand with both feet down soon after a visitor stops him.')
  assert.ok(between(stopped.position, walking.position) < 0.25, 'He must stop within a short step.')
  const held = run(stopped, 1.7, 'noticed')
  assert.ok(between(held.position, stopped.position) < 1e-9, 'He must stand still while noticed.')
  assert.ok(strollPose(held).gait < 0.01, 'His legs must settle while noticed.')
  assert.ok(strollPose(held).gaze.tilt > 0.03, 'He must tilt his head toward the visitor.')
  const resumed = run(held, 1)
  assert.ok(resumed.position[0] > held.position[0] + 0.1, 'He must walk on after the visitor leaves.')
})

test('before leaving a pause he looks toward the next waypoint', () => {
  let ending: Stroll | undefined
  run(startStroll([0, 0], 0), 12, 'free', (state) => {
    if (!ending && state.activity._tag === 'Pausing' && state.activity.remaining < 0.05) ending = state
  })
  assert.ok(ending, 'The walk must reach the end of a pause.')
  assert.ok(strollPose(ending).gaze.yaw < -0.05, 'The next waypoint lies toward negative x, so his head must turn that way first.')
})

test('his speed changes smoothly through starts, stops, and every interruption, and a frame of no length changes nothing', () => {
  const random = sequence(21)
  let state = startStroll([0, 0], 0)
  let attention: StrollAttention = 'free', until = 0, largest = 0, fastest = 0
  for (let elapsed = 0; elapsed < 90; elapsed += frame) {
    if (elapsed >= until) { const pick = random(); attention = pick < 0.6 ? 'free' : pick < 0.8 ? 'noticed' : 'talking'; until = elapsed + 0.2 + random() * 2.4 }
    const next = advanceStroll(state, { delta: frame, route, pauses, walkSpeed: 0.5, attention })
    for (const value of [next.speed, next.thrust, next.course, next.phase, next.gait, ...next.position, ...next.stance]) assert.ok(Number.isFinite(value), `A value is not a number at ${elapsed.toFixed(2)} s.`)
    // The ground he covers in the frame is never more than his speed allows.
    const covered = between(next.position, state.position) / frame
    assert.ok(covered <= next.speed + 1e-9, 'His place moved faster than his speed.')
    largest = Math.max(largest, Math.abs(next.speed - state.speed))
    fastest = Math.max(fastest, covered)
    state = next
  }
  // His walk is 0.5 units a second. One frame changes it by a twentieth of that at most: the brake of a visitor's stop.
  assert.ok(largest <= 0.5 * strollPace.halt * frame + 1e-9, `One frame changed his speed by ${largest.toFixed(4)}.`)
  assert.ok(fastest > 0.45 && fastest < 0.52, `He must reach his walk speed and not pass it, not ${fastest.toFixed(3)}.`)
  assert.equal(advanceStroll(state, { delta: 0, route, pauses, walkSpeed: 0.5, attention: 'free' }), state)
  // A walk speed of zero keeps him where he is, with every value still a number.
  let parked = startStroll([0.3, 0.2], 0)
  for (let step = 0; step < 120; step++) parked = advanceStroll(parked, { delta: frame, route, pauses, walkSpeed: 0, attention: 'free' })
  assert.deepEqual(parked.position, [0.3, 0.2])
  assert.ok(Number.isFinite(parked.phase) && Number.isFinite(parked.gait) && parked.speed === 0)
})

test('he comes to rest only with both feet down, and his cycle keeps time with the ground at a full walk', () => {
  const cadence = 6
  let state = startStroll([0, 0], 0)
  let atCruise: { phase: number, x: number } | undefined, measured = false
  for (let elapsed = 0; elapsed < 14; elapsed += frame) {
    const next = advanceStroll(state, { delta: frame, route, pauses, walkSpeed: 0.5, attention: 'free', cadence })
    // Both feet stand at a quarter and at three quarters of the cycle.
    if (settled(next)) assert.ok(Math.abs(Math.cos(next.phase)) < 1e-9, `He stood at phase ${next.phase}, with a foot in the air.`)
    if (next.tempo > 0) {
      // The cycle never runs slower than its slowest share, so a slow start takes short steps and not slow ones.
      assert.ok(next.tempo >= 0.5 * cadence * strollPace.slowest - 1e-9)
      // The ground one foot carries him over is his speed for its share of the cycle.
      assert.ok(Math.abs(Math.hypot(...next.stance) - next.speed * (2 - swingShare) * Math.PI / next.tempo) < 1e-9)
    }
    else assert.deepEqual(next.stance.map(Math.abs), [0, 0])
    if (!measured && next.speed > 0.495) {
      if (!atCruise) atCruise = { phase: next.phase, x: next.position[0] }
      else if (next.position[0] - atCruise.x > 0.5) {
        assert.ok(Math.abs((next.phase - atCruise.phase) / (next.position[0] - atCruise.x) - cadence) < 0.05, 'At a full walk the cycle advances by the cadence for each unit.')
        assert.ok(Math.abs(next.stance[0] - (2 - swingShare) * Math.PI / cadence) < 0.01 && Math.abs(next.stance[1]) < 1e-6, 'His stance points along his travel, to screen right.')
        measured = true
      }
    }
    state = next
  }
  assert.ok(measured, 'The walk must reach a full stride.')
})

test('his first steps leave the way he faces when the stop is ahead, and go straight to a stop beside or behind him', () => {
  // Facing half a radian to screen right. A stop a little to the left of that is ahead: he leaves along his facing.
  assert.equal(leavingCourse(-0.3, 0.5), 0.5)
  // A stop behind him: he steps straight to it.
  assert.equal(leavingCourse(-2.4, 0.5), -2.4)
  assert.equal(leavingCourse(3, 0.5), 3)
  // Between the two he leaves part of the way round.
  const part = leavingCourse(-1.2, 0.5)
  assert.ok(part > -1.2 && part < 0.5)
  // A mascot that does not turn walks straight.
  assert.equal(leavingCourse(1.1, undefined), 1.1)
})

test('from any stand and any facing he reaches the stop, on a path close to the straight line', () => {
  const random = sequence(4)
  const cadence = meshCadence(0.71)
  for (let trial = 0; trial < 60; trial++) {
    const target: Point = [(random() - 0.5) * 4, (random() - 0.5) * 4]
    const heading = (random() - 0.5) * 2.6
    let walk = startWalk([0, 0], heading)
    let widest = 0, seconds = 0
    const length = Math.hypot(...target)
    while (walk.stroll.activity._tag === 'Walking' && seconds < 30) {
      walk = stepWalk(walk, { route: [target], pauses: [600], cadence })
      seconds += frame
      // How far he is from the straight line between his stand and the stop.
      const [x, z] = walk.stroll.position
      const share = Math.max(0, Math.min(1, (x * target[0] + z * target[1]) / (length * length)))
      widest = Math.max(widest, Math.hypot(x - target[0] * share, z - target[1] * share))
    }
    assert.equal(walk.stroll.activity._tag, 'Pausing', `He never reached ${target} from a heading of ${heading.toFixed(2)}.`)
    assert.ok(seconds < length / meshWalk.speed + 4, `He took ${seconds.toFixed(1)} s for ${length.toFixed(2)} units.`)
    assert.ok(widest < 0.3, `He strayed ${widest.toFixed(2)} from the straight line to ${target}.`)
  }
})

test('on a journey he comes in from the way out and stands at his start point before the journey ends', () => {
  for (const [name, set] of Object.entries(walkSets)) {
    let walk = startWalk(set.exit)
    let seconds = 0
    while (!(walk.stroll.activity._tag === 'Pausing' && settled(walk.stroll)) && seconds < 20) {
      walk = stepWalk(walk, { route: [set.start], pauses: [600], walkSpeed: meshWalk.speed * meshWalk.journey, cadence: meshCadence(0.71) })
      seconds += frame
    }
    assert.ok(seconds < travelTimes.arrive, `In the ${name} he took ${seconds.toFixed(2)} s to reach his start point. The journey ends after ${travelTimes.arrive}.`)
  }
})

test('a journey that begins in the middle of a walk turns him to the way out without a jump in speed or course', () => {
  for (const set of Object.values(walkSets)) {
    const cadence = meshCadence(0.71)
    for (const after of [1.2, 4.6, 9, 13.7, 19.4, 24]) {
      let walk = startWalk(set.start)
      for (let elapsed = 0; elapsed < after; elapsed += frame) walk = stepWalk(walk, { route: set.route, pauses: set.pauses, cadence })
      // The scene sends him to the way out by a new route with one stop, and he walks it faster.
      walk = { ...walk, stroll: { ...walk.stroll, destination: 0, activity: { _tag: 'Walking' } } }
      let seconds = 0, sharpest = 0
      while (walk.stroll.activity._tag === 'Walking' && seconds < 12) {
        const next: Walk = stepWalk(walk, { route: [set.exit], pauses: [600], walkSpeed: meshWalk.speed * meshWalk.journey, cadence })
        if (walk.stroll.speed > 0 && next.stroll.speed > 0) sharpest = Math.max(sharpest, Math.abs(Math.atan2(Math.sin(next.stroll.course - walk.stroll.course), Math.cos(next.stroll.course - walk.stroll.course))))
        assert.ok(Math.abs(next.stroll.speed - walk.stroll.speed) < 0.06, 'His speed jumped as the journey began.')
        walk = next
        seconds += frame
      }
      assert.equal(walk.stroll.activity._tag, 'Pausing', `He never reached the way out from ${after} s into his loop.`)
      assert.ok(sharpest < 0.2, `His course turned ${sharpest.toFixed(3)} in one frame.`)
    }
  }
})

const facing = { walkSpeed: 0.5, rest: 0.5, limit: 1.3 }

test('walking, he faces his travel up to the limit; standing, he holds the three-quarter turn', () => {
  let turn = startTurn(0.5)
  let widest = 0, heldWhilePaused = true
  // The first waypoint is straight to screen right, so his travel is a quarter turn from the viewer. The second is to screen left.
  const state = run(startStroll([0, 0], 0), 9.5, 'free', (value) => {
    turn = advanceTurn(turn, value, { ...facing, delta: frame, attention: 'free' })
    if (value.activity._tag === 'Walking' && value.destination === 0) widest = Math.max(widest, turn.heading)
    if (value.activity._tag === 'Pausing' && value.activity.waypoint === 0 && value.activity.remaining > 0.2 && value.activity.age > 0.6) heldWhilePaused &&= Math.abs(turn.heading - 0.5) < 0.13 && turn.steps < 0.01
  })
  assert.ok(widest > 1.25 && widest <= 1.3, `He must face his travel up to the limit, not ${widest.toFixed(2)}.`)
  assert.ok(heldWhilePaused, 'He must hold the three-quarter turn, with both feet down, through the whole pause.')
  assert.equal(state.activity._tag, 'Walking')
  assert.ok(turn.heading < -1.2, `He must face screen left while he walks there, not ${turn.heading.toFixed(2)}.`)
  // A visitor stops him mid-walk. He steps round to the three-quarter turn on the side he faces, then stands.
  let stopped = state, stepped = 0
  for (let elapsed = 0; elapsed < 4; elapsed += frame) {
    stopped = advanceStroll(stopped, { delta: frame, route, pauses, walkSpeed: 0.5, attention: 'noticed' })
    turn = advanceTurn(turn, stopped, { ...facing, delta: frame, attention: 'noticed' })
    stepped = Math.max(stepped, turn.steps)
  }
  assert.ok(stepped > 0.8, 'He must step in place to turn back from his travel.')
  assert.ok(Math.abs(turn.heading + 0.5) < 0.05, `He must end near the three-quarter turn, not at ${turn.heading.toFixed(2)}.`)
  assert.ok(turn.steps === 0 && Math.abs(Math.sin(turn.phase)) < 1e-9, 'He must stand with both feet down once the turn ends.')
})

test('he turns only as fast as his feet carry him, and never with a jolt, whatever a visitor does and whenever', () => {
  // A fixed pseudo-random sequence switches the visitor's attention at uneven moments through several laps.
  const random = sequence(7)
  let state = startStroll([0, 0], 0), turn = startTurn(0.5)
  let attention: StrollAttention = 'free', until = 0, turnedInPlace = 0, standingStill = 0
  for (let elapsed = 0; elapsed < 120; elapsed += frame) {
    if (elapsed >= until) { const pick = random(); attention = pick < 0.6 ? 'free' : pick < 0.8 ? 'noticed' : 'talking'; until = elapsed + 0.2 + random() * 2.4 }
    state = advanceStroll(state, { delta: frame, route, pauses, walkSpeed: 0.5, attention })
    const next = advanceTurn(turn, state, { ...facing, delta: frame, attention })
    const moved = Math.abs(next.heading - turn.heading)
    // Each step of his walk and each step in place carries a share of the turn. `pace` and `steps` say how fast his feet take those steps.
    const pace = Math.max(next.pace, turn.pace), steps = Math.max(next.steps, turn.steps)
    const allowed = (turnPerStep.walking * pace + turnPerStep.inPlace * stepRate * steps) / Math.PI * frame + 1e-9
    assert.ok(moved <= allowed, `At ${elapsed.toFixed(2)} s he turned ${moved} with a pace of ${pace} and steps of ${steps}.`)
    assert.ok(Math.abs(next.rate - turn.rate) <= turnEase * frame + 0.2, `At ${elapsed.toFixed(2)} s his rate of turn jumped from ${turn.rate.toFixed(2)} to ${next.rate.toFixed(2)}.`)
    if (state.speed === 0 && next.steps > 0.5) turnedInPlace += moved
    // With both feet down and no step in place, he does not turn.
    if (settled(state) && pace === 0 && steps === 0) standingStill = Math.max(standingStill, moved)
    assert.ok(Math.abs(next.heading) <= 1.3 + 1e-9)
    turn = next
  }
  assert.ok(turnedInPlace > 1, 'The laps must include turns in place, or this test proves nothing.')
  assert.equal(standingStill, 0)
})

test('he turns to the next side as he walks off, with no step in place, and a visitor who holds him gets the three-quarter turn', () => {
  const pauses = [3.5, 3.5]
  let state = startStroll([0, 0], 0), turn = startTurn(0.5)
  const step = (attention: StrollAttention) => {
    state = advanceStroll(state, { delta: frame, route, pauses, walkSpeed: 0.5, attention, facing: turn.heading })
    turn = advanceTurn(turn, state, { ...facing, delta: frame, attention })
  }
  // He walks to the first stop, stands through its pause, and leaves for the stop on the other side.
  let stepped = 0, sideAtRest: number | undefined
  while (!(state.activity._tag === 'Walking' && state.destination === 1 && state.position[0] < 1)) {
    step('free')
    stepped = Math.max(stepped, turn.steps)
    if (state.activity._tag === 'Pausing' && state.activity.remaining < 0.1) sideAtRest = turn.side
  }
  assert.equal(stepped, 0, 'A walk with no visitor needs no step in place.')
  assert.equal(sideAtRest, 1, 'He must keep the side he arrived on until he walks off.')
  assert.ok(turn.side === -1 && turn.heading < -1, `Half way to the next stop he must face his travel, not ${turn.heading.toFixed(2)}.`)
  // A dialog opens while he is turned to his travel. He ends his step, steps round to the three-quarter turn on that side, and stands.
  const before = state.position
  for (let elapsed = 0; elapsed < 4; elapsed += frame) step('talking')
  assert.ok(between(state.position, before) < 0.3, 'The dialog must stop him within a short step.')
  assert.ok(Math.abs(turn.heading + 0.5) < 0.13 && turn.steps === 0 && turn.side === -1, `He must stand at the three-quarter turn, not at ${turn.heading.toFixed(2)}.`)
  assert.ok(settled(state))
})

test('with motion off he stands where the turn would end, with both feet down', () => {
  const state = run(startStroll([0, 0], 0), 0.2)
  const stood = settleTurn({ heading: 0.1, rate: 0.4, pace: 2, steps: 0.7, phase: 2, side: -1 }, { ...state, speed: 0, activity: { _tag: 'Pausing', remaining: 2, duration: 3, waypoint: 0, age: 1 } }, { ...facing, attention: 'free' })
  assert.deepEqual({ heading: stood.heading, rate: stood.rate, steps: stood.steps, side: stood.side }, { heading: -0.5, rate: 0, steps: 0, side: -1 })
  assert.ok(Math.abs(Math.sin(stood.phase)) < 1e-9, 'A step in place must end with the foot on the floor.')
})
