/** The slow swell of one sac, from -1 to 1. Its shell, its inner fold, and its light all read this one value. */
export function eggPulse(time: number, phase: number) {
  return Math.sin(time * 0.55 + phase)
}

/**
 * How bright a sac's light is. Rest is 1. The light swells with the sac and wavers a little, so it looks alive and never strobes.
 * `breath` scales the motion: 0 holds the light at rest. The value depends on `time` alone, so a frozen time holds it still.
 */
export function eggGlow(time: number, phase: number, breath: number) {
  const response = Math.min(1, Math.max(0, breath))
  const waver = Math.sin(time * 1.9 + phase * 3.1) * Math.sin(time * 0.83 + phase * 1.7)
  return 1 + (eggPulse(time, phase) * 0.24 + waver * 0.08) * response
}
