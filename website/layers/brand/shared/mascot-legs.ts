/**
 * Leg math for a mascot with a full body: the walk cycle of each foot, the swing of a foot to its next place, and a two-bone leg solve.
 * Every function is pure. The mesh mascot holds the state: where each foot stands on the floor.
 */
export type Point3 = { x: number, y: number, z: number }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const ease = (value: number) => value * value * (3 - 2 * value)

/**
 * The share of each half cycle that a foot spends in the air. For the rest of it both feet are on the floor.
 * A walk has that double support. A run does not.
 */
export const swingShare = 0.8

/** A foot is in the air (`Swing`) or it carries him (`Stance`). `progress` runs from 0 to 1 through each. */
export type FootCycle = { _tag: 'Swing', progress: number } | { _tag: 'Stance', progress: number }

/**
 * Where a foot is in the walk cycle. Foot 0 is the screen-left foot. The middle of its swing is at phase 0, and the other foot's at phase π.
 * Both feet stand at phase π/2 and at 3π/2: those are the phases he can stop in.
 */
export function footCycle(phase: number, foot: number): FootCycle {
  const cycle = Math.PI * 2
  const half = swingShare * Math.PI / 2
  // The phase from the middle of this foot's swing, from -π to π.
  const local = ((phase - foot * Math.PI + Math.PI) % cycle + cycle) % cycle - Math.PI
  if (Math.abs(local) < half) return { _tag: 'Swing', progress: (local + half) / (half * 2) }
  return { _tag: 'Stance', progress: ((local >= half ? local : local + cycle) - half) / (cycle - half * 2) }
}

/** How high a foot is through its swing, from 0 to 1. It leaves the floor and lands on it with no vertical speed. */
export const swingLift = (progress: number) => Math.sin(Math.PI * clamp(progress, 0, 1)) ** 2

// A foot rises for this share of its swing before it travels, and it has landed in place this long before the swing ends.
// So a foot never moves along the floor while it is still on it.
const clearance = 0.13
/** How far along its way a foot in the air is, from 0 to 1. */
export const swingTravel = (progress: number) => ease(clamp((progress - clearance) / (1 - clearance * 2), 0, 1))

/**
 * Where a foot is against its home under the body, as a share of the ground he covers in one stance.
 * It lands half a stance ahead, falls half a stance behind while it carries him, and swings forward again.
 * This is the place of a foot that walks on a treadmill. A foot that holds its place on a real floor ends each swing here.
 */
export const cycleReach = (cycle: FootCycle) => cycle._tag === 'Stance' ? 0.5 - cycle.progress : swingTravel(cycle.progress) - 0.5

/**
 * How far ahead of its home a foot in the air must aim, as a share of the ground he covers in one stance.
 * His body moves on while the foot is in the air, so the aim leads by the ground still to cover before the foot lands.
 */
export const landingReach = (progress: number) => 0.5 + (1 - clamp(progress, 0, 1)) * swingShare / (2 - swingShare)

/**
 * The share of the way to its target that a foot in the air moves in one frame, as its swing goes from `from` to `to`.
 * Repeated every frame, it brings the foot onto the target as its travel ends, whatever the target did on the way.
 * After that the foot comes down where it is, and the target no longer moves it.
 */
export function swingStep(from: number, to: number) {
  const done = swingTravel(from)
  return done >= 1 ? 0 : clamp((swingTravel(to) - done) / (1 - done), 0, 1)
}

/**
 * The share of a walk cycle from this moment of a swing to the middle of the stance that follows it.
 * His body is over the foot then. So a foot aims for where his body will be, and how it will be turned, at that moment.
 */
export const cycleToMidStance = (progress: number) => ((1 - clamp(progress, 0, 1)) * swingShare + (2 - swingShare) / 2) / 2

/** `stretched` is true when the foot could not reach its target. `foot` is then the nearest place it can reach. */
export type LegSolve = { knee: Point3, foot: Point3, stretched: boolean }

/**
 * Places the knee of a two-bone leg. The knee bends toward `pole`, so it never bends backward.
 * The leg never straightens past `limit` of its full length, so it never stretches and the knee never locks.
 */
export function solveLeg(hip: Point3, target: Point3, thigh: number, shin: number, pole: Point3, limit = 0.97): LegSolve {
  const full = thigh + shin
  let [x, y, z] = [target.x - hip.x, target.y - hip.y, target.z - hip.z]
  const wanted = Math.hypot(x, y, z)
  // A target on the hip gives no direction. The leg then hangs straight down.
  if (wanted < 1e-9) { x = 0; y = -1; z = 0 }
  else { x /= wanted; y /= wanted; z /= wanted }
  const length = clamp(wanted, Math.abs(thigh - shin) + full * 0.02, full * limit)
  // The knee lies `along` the line from hip to foot and `out` from it, by the law of cosines.
  const along = (thigh * thigh - shin * shin + length * length) / (length * 2)
  const out = Math.sqrt(Math.max(0, thigh * thigh - along * along))
  // The part of the pole that is square to the leg. A pole along the leg gives none, so any square direction serves.
  const share = pole.x * x + pole.y * y + pole.z * z
  let [px, py, pz] = [pole.x - x * share, pole.y - y * share, pole.z - z * share]
  let size = Math.hypot(px, py, pz)
  if (size < 1e-9) { [px, py, pz] = Math.abs(y) < 0.9 ? [-x * y, 1 - y * y, -z * y] : [1 - x * x, -y * x, -z * x]; size = Math.hypot(px, py, pz) }
  return {
    knee: { x: hip.x + x * along + px / size * out, y: hip.y + y * along + py / size * out, z: hip.z + z * along + pz / size * out },
    foot: { x: hip.x + x * length, y: hip.y + y * length, z: hip.z + z * length },
    stretched: Math.abs(wanted - length) > 1e-9,
  }
}

/**
 * How far the hips must come down for a leg of length `reach` to hold a foot on the floor. Zero when the foot is within reach.
 * With `ease`, the hips begin to sink that share of the reach before the leg is at its limit, slowly at first.
 * So the drop has no sudden start. It is never less than the limit needs.
 */
export function hipDrop(hip: Point3, foot: Point3, reach: number, ease = 0) {
  const flat = Math.hypot(foot.x - hip.x, foot.z - hip.z)
  const above = hip.y - foot.y
  const within = (length: number) => Math.sqrt(Math.max(0, length * length - flat * flat))
  const needed = Math.max(0, above - within(reach))
  // The same drop for a leg a little shorter. It begins sooner, by `gap`, and it leads the needed drop by `gap` from then on.
  const early = Math.max(0, above - within(reach * (1 - ease)))
  const gap = within(reach) - within(reach * (1 - ease))
  return gap > 1e-9 && early < gap * 2 ? Math.max(needed, early * early / (gap * 4)) : needed
}
