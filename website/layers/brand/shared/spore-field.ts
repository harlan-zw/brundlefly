/** The air that spores drift in, in world units. It spans the clearing, from the floor to above his head. */
export const sporeVolume = { min: [-4.6, -2.15, -3], max: [4.6, 2.7, 8] } as const

/** How many spores the full picture draws. */
export const fullSporeCount = 300

/** The spore count for a share of the full count. A share outside 0 to 1 is clamped, and a share that is no number draws none. */
export function sporeCount(share: number) {
  return Number.isFinite(share) ? Math.round(fullSporeCount * Math.min(1, Math.max(0, share))) : 0
}

/** Stable variation from 0 to 1, so the air is the same in every build and every capture. */
const seeded = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

/**
 * Where each spore starts and how it moves. A smaller count is the start of a larger one, so a lower quality tier thins the same air.
 * `homes` holds x, y, z for each spore. `traits` holds phase (0 to 1), rise (world units each second, negative sinks), sway (0 to 1), and size (0 to 1).
 * `tints` is 0 for a pale dust mote and 1 for a slime spore.
 */
export function sporeField(count: number) {
  const homes = new Float32Array(count * 3)
  const traits = new Float32Array(count * 4)
  const tints = new Float32Array(count)
  const { min, max } = sporeVolume
  for (let index = 0; index < count; index++) {
    for (let axis = 0; axis < 3; axis++) {
      homes[index * 3 + axis] = min[axis]! + seeded(index * 3 + axis + 0.5) * (max[axis]! - min[axis]!)
    }
    traits[index * 4] = seeded(index + 811.3)
    // Most motes hang or rise in the warm air. A few sink.
    traits[index * 4 + 1] = -0.012 + seeded(index + 1201.7) * 0.05
    traits[index * 4 + 2] = seeded(index + 1733.9)
    traits[index * 4 + 3] = seeded(index + 2311.1)
    tints[index] = seeded(index + 2903.3) < 0.2 ? 1 : 0
  }
  return { homes, traits, tints }
}
