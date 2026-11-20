const fract = (value: number) => value - Math.floor(value)
// Seconds in one cycle of the failing tube, and the part of it that the tube holds steady.
const cycle = 9
const steady = 7.4
// The tube changes level at most this many times a second. Two changes make one flash, so it never flashes more than three times a second.
const rate = 5

/**
 * How bright the failing ceiling tube is, from 0 to 1, at a scene time in seconds.
 * It holds full light for most of each cycle, then stutters. Time zero is full light, so a scene that stands still shows a lit tube.
 */
export function tubeFlicker(time: number) {
  if (time % cycle < steady) return 1
  const step = Math.floor(time * rate)
  const chance = fract(Math.sin(step * 127.1 + 311.7) * 43758.5453)
  return chance > 0.5 ? 1 : chance > 0.2 ? 0.45 : 0.12
}
