type Point = readonly [number, number]
export type StrollActivity = { _tag: 'Walking' } | { _tag: 'Pausing', remaining: number, duration: number }
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
export type StrollInput = { delta: number, route: readonly Point[], pauses: readonly number[], walkSpeed: number, attention: StrollAttention }

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
export function advanceStroll(state: Stroll, { delta, route, pauses, walkSpeed, attention }: StrollInput): Stroll {
  let activity = state.activity
  if (attention === 'free' && activity._tag === 'Pausing') {
    const remaining = activity.remaining - delta
    activity = remaining > 0 ? { ...activity, remaining } : { _tag: 'Walking' }
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
    activity = { _tag: 'Pausing', remaining: duration, duration }
    destination = (destination + 1) % route.length
  }
  const moved: Stroll = { ...state, position, destination, speed, activity, phase: state.phase + step * 10,
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
