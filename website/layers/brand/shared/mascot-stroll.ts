import { swingShare } from './mascot-legs.ts'

type Point = readonly [number, number]
/** `waypoint` names the stop. `age` keeps counting while a visitor holds his attention, so a habit there still finishes. */
export type StrollActivity = { _tag: 'Walking' } | { _tag: 'Pausing', remaining: number, duration: number, waypoint: number, age: number }
/** `noticed` stops him for a hovering visitor. `talking` holds him still for the dialog. */
export type StrollAttention = 'free' | 'noticed' | 'talking'
export type Gaze = { yaw: number, tilt: number }
export type Stroll = {
  position: Point
  destination: number
  /** His ground speed, in units a second, and how fast it changes. Both change smoothly, so he never starts or stops with a jolt. */
  speed: number
  thrust: number
  /** The way he travels, as a turn about the vertical. Zero is toward the viewer and a positive turn is to screen right. */
  course: number
  /** How fully he strides, from 0 to 1. It follows his speed, and it holds while he finishes a step. */
  gait: number
  /** The walk cycle, in radians. Both feet stand at π/2 and at 3π/2. He comes to rest only there. */
  phase: number
  /** The phase he comes to rest at, while he finishes his step after a stop. */
  rest: number
  /** How fast the walk cycle runs, in radians a second. Zero while he stands at rest. */
  tempo: number
  /** The lean of the relief rig toward its travel. */
  heading: number
  gaze: Gaze
  activity: StrollActivity
  /** The ground he covers while one foot carries him, as a world vector. Zero while he stands. A full body places its feet by it. */
  stance: Point
}
/**
 * `cadence` is how far the walk cycle advances, in radians, for each unit he travels at a full walk. A full body derives it from its stride.
 * `facing` is the way a body that turns is facing. His first steps then curve away from it, so he turns as he walks off.
 */
export type StrollInput = { delta: number, route: readonly Point[], pauses: readonly number[], walkSpeed: number, attention: StrollAttention, cadence?: number, facing?: number }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const approach = (value: number, target: number, rate: number, delta: number) => value + (target - value) * Math.min(1, delta * rate)
/** A filter that ends at the same value after the same time, however the time is cut into frames. */
const follow = (value: number, target: number, rate: number, delta: number) => target + (value - target) * Math.exp(-rate * delta)
/** The short way round from one turn to another, from -π to π. */
const turnBetween = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from))
const restPhase = Math.PI / 2

/**
 * The walk's own measures. Distances are in world units and times in seconds.
 * `brake` is the distance over which he slows into a stop. `reach` is the walk speed he gains in a second, as a share of it, and `halt` the share he loses
 * when a visitor stops him. `arrive` is how near a stop counts as there. `steer` is how fast his course turns, in radians a second,
 * and `reverse` is the turn of his course, in radians, that he will not walk as a curve.
 * `slowest` is the slowest his cycle runs while he moves, as a share of its rate at a full walk: slower travel takes shorter steps, not slower ones.
 */
export const strollPace = { brake: 0.5, reach: 2.2, halt: 3, arrive: 0.02, steer: 2.6, reverse: 1.3, slowest: 0.85 }

export const startStroll = (position: Point, destination: number): Stroll => ({
  position, destination, speed: 0, thrust: 0, course: 0, gait: 0, phase: restPhase, rest: restPhase, tempo: 0, heading: 0,
  gaze: { yaw: 0, tilt: 0 }, activity: { _tag: 'Walking' }, stance: [0, 0],
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

/**
 * The course of his first steps from a stand. A stop that is roughly ahead of him lets him leave the way he faces and curve to it.
 * A stop beside or behind him cannot: he steps straight to it, sideways or back, and turns as he goes.
 */
export function leavingCourse(bearing: number, facing: number | undefined) {
  if (facing === undefined) return bearing
  const off = turnBetween(bearing, facing)
  return bearing + off * clamp(2.2 - Math.abs(off), 0, 1)
}

/** True while he stands with both feet down and his walk cycle at rest. */
export const settled = (state: Stroll) => state.speed === 0 && state.phase === state.rest

/**
 * Pure walk state. He leaves a stop in a curve, cruises, slows into the next stop, finishes his step, and pauses.
 * His speed and his course change smoothly, and his walk cycle keeps time with the ground he covers.
 */
export function advanceStroll(state: Stroll, { delta, route, pauses, walkSpeed, attention, cadence = 10, facing }: StrollInput): Stroll {
  // A frame of no length changes nothing. The scene draws one when its size changes.
  if (!(delta > 0)) return state
  let activity = state.activity
  if (activity._tag === 'Pausing') {
    const remaining = attention === 'free' ? activity.remaining - delta : activity.remaining
    activity = remaining > 0 ? { ...activity, remaining, age: activity.age + delta } : { _tag: 'Walking' }
  }
  const target = route[state.destination]!
  const dx = target[0] - state.position[0], dz = target[1] - state.position[1]
  const distance = Math.hypot(dx, dz)
  const bearing = distance > 0 ? Math.atan2(dx, dz) : state.course
  const walking = activity._tag === 'Walking'
  // Standing, his course is where his first step will go. Moving, it turns toward the stop, faster as the stop comes near, so he always arrives.
  const off = turnBetween(state.course, bearing)
  // A stop that is suddenly behind his course, as when a journey begins, is no curve to walk: he stands first and then leaves for it.
  const reversing = state.speed > 0 && Math.abs(off) > strollPace.reverse
  // Once he has arrived he keeps his course, so the last of his brake does not pull him toward the next stop.
  const course = !walking || reversing ? state.course : state.speed === 0 ? leavingCourse(bearing, facing)
    : state.course + Math.sign(off) * Math.min(Math.abs(off), Math.max(strollPace.steer, state.speed / Math.max(distance, 1e-6) * 2) * delta)
  // He slows for a turn of his course, so the curve stays tight, and he slows into the stop along a steady brake.
  const aside = Math.abs(turnBetween(course, bearing))
  const cruise = walking && attention === 'free' && !reversing
    ? Math.min(walkSpeed * clamp(1.15 - aside * 0.6, 0.3, 1), walkSpeed * Math.sqrt(distance / strollPace.brake), walkSpeed * 0.04 + distance * 5)
    : 0
  // His speed follows the cruise through a thrust that itself changes smoothly.
  // A stop is timed to his feet: he loses the last of his speed as the foot in the air comes down, so he does not stand and then step.
  const landing = state.tempo > 0 ? Math.max(0.1, (state.rest - state.phase) / state.tempo) : 0.1
  const push = cruise === 0 ? -Math.min(walkSpeed * strollPace.halt, state.speed / landing)
    : clamp((cruise - state.speed) * 8, -walkSpeed * strollPace.halt, walkSpeed * strollPace.reach)
  const thrust = follow(state.thrust, push, 16, delta)
  let speed = Math.max(0, state.speed + thrust * delta)
  // Below a hundredth of his walk he is standing. The last of the brake then ends.
  if (cruise === 0 && speed < walkSpeed * 0.01) speed = 0
  const step = Math.min(distance, speed * delta)
  const position: Point = step > 0 ? [state.position[0] + Math.sin(course) * step, state.position[1] + Math.cos(course) * step] : state.position
  let destination = state.destination
  // He has arrived once the last of his speed will carry him onto the stop while his foot comes down.
  // As both feet come down he chooses: one more step, or none. He takes none when that leaves him nearer the stop.
  const left = Math.hypot(target[0] - position[0], target[1] - position[1])
  const feetDown = state.tempo > 0 && state.phase + state.tempo * delta >= state.rest
  const arrived = walking && (left < Math.max(strollPace.arrive, speed * landing / 2) || (feetDown && left < speed * Math.PI / state.tempo / 4))
  if (arrived) {
    const duration = pauses[destination % pauses.length] ?? 0
    activity = { _tag: 'Pausing', remaining: duration, duration, waypoint: destination, age: 0 }
    destination = (destination + 1) % route.length
  }
  // The cycle keeps time with the ground. It never runs slower than `slowest` while he moves, so a slow start takes short steps.
  const full = walkSpeed * cadence
  // On his way to a stand he ends the step he is in and begins no other. The last of his speed then moves him over both feet.
  const stopping = cruise === 0 || arrived
  const tempo = (stopping ? state.phase < state.rest : speed > 0) ? Math.max(speed * cadence, full * strollPace.slowest) : 0
  let phase = state.phase + tempo * delta, rest = state.rest
  if (stopping) phase = Math.min(rest, phase)
  // He will stop at the next stand of his feet.
  else if (tempo > 0) rest = Math.ceil((phase - restPhase) / Math.PI - 1e-9) * Math.PI + restPhase
  const carried = tempo > 0 ? speed * (2 - swingShare) * Math.PI / tempo : 0
  const stance: Point = [Math.sin(course) * carried, Math.cos(course) * carried]
  const stepping = tempo > 0
  const gait = follow(state.gait, stepping ? Math.max(0.3, walkSpeed > 0 ? clamp(speed / walkSpeed, 0, 1) : 0) : 0, 9, delta)
  const moved: Stroll = { ...state, position, destination, speed, thrust: speed > 0 ? thrust : 0, course, gait: stepping || gait > 1e-4 ? gait : 0, phase, rest, tempo, activity, stance,
    heading: approach(state.heading, speed > 0 ? Math.sin(course) * 0.2 : 0, 3, delta) }
  const gaze = gazeTarget(moved, route, attention)
  return { ...moved, gaze: { yaw: approach(state.gaze.yaw, gaze.yaw, 4, delta), tilt: approach(state.gaze.tilt, gaze.tilt, 4, delta) } }
}

/** Gait blends the walk cycle in and out, so stopping never snaps the legs. A full body places its feet by `stance`. */
export const strollPose = (state: Stroll) => ({ gait: state.gait, walkPhase: state.phase, gaze: state.gaze, stance: state.stance })

/**
 * His turn about the vertical, for a mascot with a full body.
 * `rate` is how fast he turns, in radians a second. `pace` is how fast his walk steps, in radians of the walk cycle a second, eased so a turn ends softly.
 * `steps` is how far he steps in place, from 0 to 1, and `phase` is the cycle of those steps. `side` is the side he faces, or turns to.
 */
export type Turn = { heading: number, rate: number, pace: number, steps: number, phase: number, side: 1 | -1 }
/** `rest` is the artwork's three-quarter turn, in radians. `limit` is the furthest he turns from the viewer. */
export type TurnInput = { delta: number, walkSpeed: number, rest: number, limit: number, attention: StrollAttention }

export const startTurn = (heading: number): Turn => ({ heading, rate: 0, pace: 0, steps: 0, phase: 0, side: heading < 0 ? -1 : 1 })

// Radians he may turn in one step of a walk, and in one step in place. A turn is never faster than his feet allow:
// a foot on the floor stays there, so each step can carry only so much of a turn before its leg twists.
export const turnPerStep = { walking: 0.7, inPlace: 0.32 }
// Radians a second of the step cycle while he steps in place: about three quick foot lifts for a turn to the other side.
// Short steps keep each foot's share of the turn small, so his body does not swing wide about it.
export const stepRate = 12
// The most his rate of turn changes in a second, in radians a second. It keeps the start and the end of every turn soft.
export const turnEase = 10

/** The side and the heading he should have: his travel while he walks, and the three-quarter turn while he stands. */
function turnTarget(turn: Turn, state: Stroll, { walkSpeed, rest, limit }: Omit<TurnInput, 'delta' | 'attention'>) {
  const stride = walkSpeed > 0 ? clamp(state.speed / walkSpeed, 0, 1) : 0
  // He faces his travel as far as the limit lets him. Travel almost straight toward the viewer or away gives no side, so he keeps the one he has.
  const facing = clamp(turnBetween(0, state.course), -limit, limit)
  const side: 1 | -1 = state.speed > 0 && Math.abs(Math.sin(state.course)) > 0.08 ? (Math.sin(state.course) < 0 ? -1 : 1) : turn.side
  // He faces his travel only near a full walk. So he turns back to the three-quarter turn while he slows into a stop,
  // and the last steps of his walk end the turn.
  const share = clamp((stride - 0.5) / 0.4, 0, 1)
  const moving = share * share * (3 - 2 * share)
  const standing = side * rest
  return { side, stride, heading: standing + (facing - standing) * moving }
}

/**
 * While he walks he faces his direction of travel, up to `limit`, so he never turns his back on the viewer.
 * While he stands he holds the three-quarter turn. He turns to a new side as he walks off, not before.
 * His feet carry every turn: he turns only as fast as he walks, or as he steps. With both feet down he does not turn.
 * He steps in place only when something stops him away from the three-quarter turn.
 */
export function advanceTurn(turn: Turn, state: Stroll, input: TurnInput): Turn {
  const { delta } = input
  if (!(delta > 0)) return turn
  const target = turnTarget(turn, state, input)
  const error = target.heading - turn.heading
  // His steps in place end with both feet down, at a whole number of half cycles.
  const stand = Math.ceil(turn.phase / Math.PI - 1e-9) * Math.PI
  const atRest = stand - turn.phase < 1e-9
  // He steps in place for a turn that no walk will carry: he stands, his own last step has ended, and nothing sends him on.
  const held = state.activity._tag === 'Pausing' || input.attention !== 'free'
  const wanted = held && settled(state) && Math.abs(error) > (atRest ? 0.12 : 0.03)
  // A step in place, once begun, ends with the foot on the floor.
  const ahead = turn.phase + stepRate * delta
  const phase = wanted ? ahead : atRest ? stand : Math.min(ahead, stand)
  const stepping = wanted || phase < stand
  const steps = follow(turn.steps, stepping ? 1 : 0, 14, delta)
  // Every step carries its share of the turn: the steps of his walk, the step that ends it, and his steps in place.
  const pace = follow(turn.pace, state.tempo * clamp(state.gait / 0.3, 0, 1), 14, delta)
  const most = (turnPerStep.walking * pace + turnPerStep.inPlace * stepRate * steps) / Math.PI
  const wish = clamp(error * 5, -most, most)
  const rate = clamp(clamp(wish, turn.rate - turnEase * delta, turn.rate + turnEase * delta), -most, most)
  return { heading: clamp(turn.heading + rate * delta, -input.limit, input.limit), rate, pace: pace > 1e-3 ? pace : 0, steps: stepping || steps > 1e-3 ? steps : 0, phase, side: target.side }
}

/** With motion off he stands at once where the turn would end, with both feet down. */
export const settleTurn = (turn: Turn, state: Stroll, input: Omit<TurnInput, 'delta'>): Turn => {
  const target = turnTarget(turn, state, input)
  return { heading: target.heading, rate: 0, pace: 0, steps: 0, phase: Math.ceil(turn.phase / Math.PI - 1e-9) * Math.PI, side: target.side }
}
