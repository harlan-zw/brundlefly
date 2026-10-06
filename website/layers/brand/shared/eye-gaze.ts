/** Eye travel in face space. `x` turns toward image right and `y` looks up. Both stay within [-1, 1]. */
export type Look = { x: number, y: number }
type Point = { x: number, y: number, z: number }
/** `Ahead` keeps the canonical pose. `Wander` looks around on its own. `Watch` holds one world point, such as the camera. */
export type EyeFocus = { _tag: 'Ahead' } | { _tag: 'Wander' } | { _tag: 'Watch', target: Point }

const maxYaw = 0.55
const maxPitch = 0.38
const clamp = (value: number) => Math.max(-1, Math.min(1, value))

// Irregular fixations with sweeps, small corrective jumps, and one long stare. The table repeats every cycle.
const wander = {
  cycle: 21.3,
  fixations: [
    [0, 0.05, 0], [1.9, -0.72, 0.12], [2.25, -0.62, 0.06], [4.1, 0.15, -0.35], [5.4, 0.82, 0.2], [7.9, 0.74, 0.3],
    [8.6, -0.1, 0.05], [11.2, -0.85, -0.25], [12, -0.3, 0.45], [13.7, 0.45, -0.1], [16.4, 0.05, 0.02], [19.5, 0.6, 0.35],
  ] as const,
}

/** A saccade jumps fast and settles, then the eye holds. `settle` is the jump length in seconds. */
export function wanderingLook(time: number, settle = 0.07): Look {
  const { cycle, fixations } = wander
  const local = (time % cycle + cycle) % cycle
  const index = fixations.findLastIndex(([at]) => at <= local)
  const [at, x, y] = fixations[index]!
  const [, fromX, fromY] = fixations[(index + fixations.length - 1) % fixations.length]!
  const progress = Math.min(1, (local - at) / settle)
  const eased = 1 - (1 - progress) ** 3
  return { x: fromX + (x - fromX) * eased, y: fromY + (y - fromY) * eased }
}

/** Living eyes never hold perfectly still. */
export const fixationDrift = (time: number): Look => ({
  x: Math.sin(time * 5.3) * Math.sin(time * 1.7) * 0.02,
  y: Math.sin(time * 4.1 + 1) * 0.015,
})

/** `direction` points from the eye toward the target, in face space. */
export const lookToward = ({ x, y, z }: Point): Look => ({
  x: clamp(Math.atan2(x, z) / maxYaw),
  y: clamp(Math.atan2(y, Math.hypot(x, z)) / maxPitch),
})

/** Unit direction the pupil faces, in eye space. */
export function pupilDirection({ x, y }: Look): Point {
  const yaw = clamp(x) * maxYaw
  const pitch = clamp(y) * maxPitch
  return { x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) }
}

/** Pupil radius on the unit eye. A watched visitor dilates it. Wandering pupils pulse slowly. */
export const pupilSize = (focus: EyeFocus['_tag'], time: number) =>
  focus === 'Watch' ? 0.23 : 0.16 + Math.sin(time * 0.83) * Math.sin(time * 0.31 + 1) * 0.014
