type Point = readonly [number, number]
/** `waypoint` names the stop. `age` keeps counting while a visitor holds his attention, so a habit there still finishes. */
export type StrollActivity = { _tag: 'Walking' } | { _tag: 'Pausing', remaining: number, duration: number, waypoint: number, age: number }
/** `noticed` stops him for a hovering visitor. `talking` holds him still for the dialog. */
export type StrollAttention = 'free' | 'noticed' | 'talking'
export type Gaze = { yaw: number, tilt: number }
export type Stroll = {
  position: Point
  destination: number
  speed: number
  phase: number
  heading: number
  gaze: Gaze
  activity: StrollActivity
}
/** `cadence` is how far the walk cycle advances, in radians, for each unit he travels. A full body derives it from its stride. */
export type StrollInput = { delta: number, route: readonly Point[], pauses: readonly number[], walkSpeed: number, attention: StrollAttention, cadence?: number }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const approach = (value: number, target: number, rate: number, delta: number) => value + (target - value) * Math.min(1, delta * rate)

export const startStroll = (position: Point, destination: number): Stroll => ({
  position, destination, speed: 0, phase: 0, heading: 0, gaze: { yaw: 0, tilt: 0 }, activity: { _tag: 'Walking' },
})

function gazeTarget(state: Stroll, route: readonly Point[], attention: StrollAttention): Gaze {
  if (attention === 'talking') return { yaw: 0, tilt: 0 }
  if (attention === 'noticed') return { yaw: 0, tilt: 0.07 }
  const next = route[state.destination]!
  const toward = Math.sign(next[0] - state.position[0])
  if (state.activity._tag === 'Walking') return { yaw: toward * 0.05, tilt: 0 }
  // A curious tilt fills the middle of the pause. The last moment anticipates the next walk.
  const { remaining, duration } = state.activity
  const progress = duration > 0 ? 1 - remaining / duration : 1
  return { yaw: toward * 0.12 * clamp(1 - remaining / 0.8, 0, 1),
    tilt: 0.06 * Math.sin(Math.PI * clamp((progress - 0.1) / 0.55, 0, 1)) }
}

/** Pure walk state: cruise, slow into each waypoint, pause, glance ahead, and walk on. */
export function advanceStroll(state: Stroll, { delta, route, pauses, walkSpeed, attention, cadence = 10 }: StrollInput): Stroll {
  let activity = state.activity
  if (activity._tag === 'Pausing') {
    const remaining = attention === 'free' ? activity.remaining - delta : activity.remaining
    activity = remaining > 0 ? { ...activity, remaining, age: activity.age + delta } : { _tag: 'Walking' }
  }
  const target = route[state.destination]!
  const dx = target[0] - state.position[0], dz = target[1] - state.position[1]
  const distance = Math.hypot(dx, dz)
  const walking = activity._tag === 'Walking'
  // Slow over the last half unit, so each pause begins from a settled stride.
  const cruise = walking && attention === 'free' ? walkSpeed * clamp(distance / 0.5, 0.2, 1) : 0
  const speed = approach(state.speed, cruise, 6, delta)
  const step = walking && distance > 0 ? Math.min(distance, speed * delta) : 0
  const position: Point = step > 0 ? [state.position[0] + dx / distance * step, state.position[1] + dz / distance * step] : state.position
  let destination = state.destination
  if (walking && distance - step < 0.03) {
    const duration = pauses[destination % pauses.length] ?? 0
    activity = { _tag: 'Pausing', remaining: duration, duration, waypoint: destination, age: 0 }
    destination = (destination + 1) % route.length
  }
  const moved: Stroll = { ...state, position, destination, speed, activity, phase: state.phase + step * cadence,
    heading: approach(state.heading, activity._tag === 'Walking' && distance > 0 ? dx / distance * 0.2 : 0, 3, delta) }
  const gaze = gazeTarget(moved, route, attention)
  return { ...moved, gaze: { yaw: approach(state.gaze.yaw, gaze.yaw, 4, delta), tilt: approach(state.gaze.tilt, gaze.tilt, 4, delta) } }
}

/** Gait blends the walk cycle in and out, so stopping never snaps the legs. */
export const strollPose = (state: Stroll, walkSpeed: number) => ({
  gait: walkSpeed > 0 ? clamp(state.speed / walkSpeed, 0, 1) : 0,
  walkPhase: state.phase,
  gaze: state.gaze,
})

/** His direction of travel as a turn about the vertical. Zero faces the viewer and a positive turn faces screen right. */
export const travelYaw = (state: Stroll, route: readonly Point[]) => {
  const target = route[state.destination]!
  return Math.atan2(target[0] - state.position[0], target[1] - state.position[1])
}

/**
 * His turn about the vertical, for a mascot with a full body.
 * `steps` is how far he steps in place, from 0 to 1, and `phase` is the cycle of those steps. `side` is the side he faces, or turns to.
 */
export type Turn = { heading: number, steps: number, phase: number, side: 1 | -1 }
/** `rest` is the artwork's three-quarter turn, in radians. `limit` is the furthest he turns from the viewer. */
export type TurnInput = { delta: number, route: readonly Point[], walkSpeed: number, rest: number, limit: number, attention: StrollAttention }

export const startTurn = (heading: number): Turn => ({ heading, steps: 0, phase: 0, side: heading < 0 ? -1 : 1 })

// Radians a second he may turn at a full walk, and with full steps in place. A turn is never faster than his feet allow.
export const turnRates = { walking: 2.8, inPlace: 1.2 }
// He begins his turn to the next side this many seconds before he leaves a stop.
const leaveLead = 1.1
// Radians a second of the step cycle while he steps in place: about three quick foot lifts for a turn to the other side.
// Short steps keep each foot's share of the turn small, so his body does not swing wide about it.
export const stepRate = 12

/** The side and the heading he should have: his travel while he walks, and the three-quarter turn while he stands. */
function turnTarget(turn: Turn, state: Stroll, { route, walkSpeed, rest, limit, attention }: Omit<TurnInput, 'delta'>) {
  const dx = route[state.destination]![0] - state.position[0]
  // A visitor who holds his attention keeps him from turning away to leave.
  const leaving = state.activity._tag === 'Walking' || (attention === 'free' && state.activity.remaining < leaveLead)
  // A waypoint almost straight ahead or behind gives no side, so he keeps the one he has.
  const side: 1 | -1 = leaving && Math.abs(dx) > 0.05 ? (dx < 0 ? -1 : 1) : turn.side
  const gait = walkSpeed > 0 ? clamp(state.speed / walkSpeed, 0, 1) : 0
  const moving = gait * gait * (3 - 2 * gait)
  const standing = side * rest
  return { side, gait, heading: standing + (clamp(travelYaw(state, route), -limit, limit) - standing) * moving }
}

/**
 * While he walks he faces his direction of travel, up to `limit`, so he never turns his back on the viewer.
 * While he stands he holds the three-quarter turn. He turns to the next side a little before he leaves.
 * His feet carry every turn: he turns only as fast as he walks, or as he steps in place. With both feet down he does not turn.
 */
export function advanceTurn(turn: Turn, state: Stroll, input: TurnInput): Turn {
  const { delta } = input
  const target = turnTarget(turn, state, input)
  const error = target.heading - turn.heading
  // He steps in place for a turn that the walk does not carry. A small error is not worth a step.
  const wanted = target.gait < 0.15 && Math.abs(error) > (turn.steps > 0.05 ? 0.03 : 0.1) ? 1 : 0
  const steps = approach(turn.steps, wanted, 7, delta)
  const most = (turnRates.walking * target.gait + turnRates.inPlace * steps) * delta
  const eased = approach(turn.heading, target.heading, 3.5, delta) - turn.heading
  return { heading: turn.heading + clamp(eased, -most, most), steps, phase: turn.phase + steps * stepRate * delta, side: target.side }
}

/** With motion off he stands at once where the turn would end, with both feet down. */
export const settleTurn = (turn: Turn, state: Stroll, input: Omit<TurnInput, 'delta'>): Turn => {
  const target = turnTarget(turn, state, input)
  return { heading: target.heading, steps: 0, phase: turn.phase, side: target.side }
}
