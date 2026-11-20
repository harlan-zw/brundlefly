import { shotChance } from './audio-shot.ts'
import type { Shot, ShotPoint } from './audio-shot.ts'

/** A short sound for something he does. Nothing in the scene asks for one yet. */
export type ActionSound = 'KeyClick' | 'MarkerSqueak' | 'JarBubbles'

// Stage gains for the action sounds. Each sits below the office's door, so no action masks his voice.
const levels = { key: 0.09, squeak: 0.05, bubble: 0.07 }

/** One key of his keyboard: a sharp click and a short plastic knock. `index` counts the keys he has pressed, and varies each one. */
export function keyClick(index: number): Shot {
  const weight = 0.7 + shotChance(index, 31) * 0.3
  const knock = 620 + shotChance(index, 32) * 420
  return { duration: 0.06, pan: (shotChance(index, 33) - 0.5) * 0.3, voices: [
    { _tag: 'Noise', filter: { type: 'highpass', frequency: [[0, 2200]], q: 0.7 }, level: [[0, 0], [0.001, levels.key * weight], [0.014, 0]] },
    { _tag: 'Tone', wave: 'triangle', pitch: [[0, knock], [0.04, knock * 0.8]], level: [[0, 0], [0.002, levels.key * weight * 0.5], [0.04, 0]] },
  ] }
}

/** One stroke of his marker on the whiteboard: a high squeak that wavers, over a soft rub. `index` counts his strokes. */
export function markerSqueak(index: number): Shot {
  const pitch = 1900 + shotChance(index, 34) * 700
  const length = 0.2 + shotChance(index, 35) * 0.12
  return { duration: length + 0.03, pan: (shotChance(index, 36) - 0.5) * 0.4, voices: [
    { _tag: 'Tone', wave: 'sawtooth', filter: { type: 'bandpass', frequency: [[0, pitch * 1.5]], q: 6 },
      pitch: [[0, pitch], [length * 0.4, pitch * 1.12], [length, pitch * 0.96]],
      level: [[0, 0], [0.02, levels.squeak], [length * 0.5, levels.squeak * 0.55], [length * 0.8, levels.squeak], [length, 0]] },
    { _tag: 'Noise', filter: { type: 'bandpass', frequency: [[0, 5200]], q: 1.5 }, level: [[0, 0], [0.02, levels.squeak * 0.3], [length, 0]] },
  ] }
}

/** A few small bubbles rise in a specimen jar. Small bubbles sing higher than the water cooler's. `index` counts his visits to the jars. */
export function jarBubbles(index: number): Shot {
  const count = 3 + Math.floor(shotChance(index, 37) * 3)
  const tone: ShotPoint[] = []
  const loud: ShotPoint[] = []
  let time = 0.01
  for (let bubble = 0; bubble < count; bubble++) {
    const pitch = 420 + shotChance(index * 9 + bubble, 38) * 520
    tone.push([time, pitch], [time + 0.04, pitch * 1.8])
    loud.push([time, 0], [time + 0.005, levels.bubble * (0.6 + shotChance(index * 9 + bubble, 39) * 0.4)], [time + 0.055, 0])
    time += 0.06 + shotChance(index * 9 + bubble, 40) * 0.08
  }
  return { duration: time + 0.03, pan: (shotChance(index, 41) - 0.5) * 0.5, voices: [{ _tag: 'Tone', wave: 'sine', pitch: tone, level: loud }] }
}

/** The sound of each action, by name. */
export const actionSounds: Record<ActionSound, (index: number) => Shot> = { KeyClick: keyClick, MarkerSqueak: markerSqueak, JarBubbles: jarBubbles }
