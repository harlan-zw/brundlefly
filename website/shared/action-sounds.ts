import { strikeLevels } from '../layers/brand/shared/office-entrance.ts'
import { shotChance } from './audio-shot.ts'
import type { Shot, ShotPoint } from './audio-shot.ts'

/** A short sound for something he does. The scene asks for the switch and the strike in the office entrance. Nothing asks for the others yet. */
export type ActionSound = 'KeyClick' | 'MarkerSqueak' | 'JarBubbles' | 'LightSwitch' | 'TubeStrike'

// Stage gains for the action sounds, set by offline rendering at the default mix. Each peaks between -38 and -29 dBFS, far below his voice.
// The switch and the strike are set by ear against them, and no offline render has measured them.
const levels = { key: 0.06, squeak: 0.05, bubble: 0.07, rocker: 0.09, strike: 0.055 }

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
    { _tag: 'Tone', wave: 'sawtooth', filter: { type: 'bandpass', frequency: [[0, pitch]], q: 4 },
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

/** The wall switch of the tubes: a hard click as the rocker goes over, and the knock of the plate behind it. `index` counts his uses of it. */
export function lightSwitch(index: number): Shot {
  const weight = 0.85 + shotChance(index, 42) * 0.15
  const knock = 300 + shotChance(index, 43) * 90
  return { duration: 0.09, pan: 0.5, voices: [
    { _tag: 'Noise', filter: { type: 'bandpass', frequency: [[0, 3200]], q: 1.2 }, level: [[0, 0], [0.001, levels.rocker * weight], [0.014, 0]] },
    { _tag: 'Tone', wave: 'triangle', pitch: [[0, knock], [0.06, knock * 0.7]], level: [[0, 0], [0.003, levels.rocker * weight * 0.6], [0.07, 0]] },
  ] }
}

/**
 * The tubes strike. At each flash a starter ticks and the glass rings, and the ballast growls as loud as the light is bright.
 * The times and the levels are the light's own, so the sound and the flicker agree. `index` varies the ring of the glass.
 */
export function tubeStrike(index: number): Shot {
  const tick: ShotPoint[] = []
  const ring: ShotPoint[] = []
  const note: ShotPoint[] = []
  const growl: ShotPoint[] = []
  let before = 0
  for (const [step, [time, level]] of strikeLevels.entries()) {
    // The ballast follows every change of the light.
    growl.push([time, levels.strike * before], [time + 0.02, levels.strike * level])
    if (level > before) {
      const pitch = 2100 + shotChance(index * 5 + step, 44) * 600
      tick.push([time, 0], [time + 0.002, levels.strike * level], [time + 0.02, 0])
      ring.push([time, 0], [time + 0.004, levels.strike * level * 0.5], [time + 0.07, 0])
      note.push([time, pitch], [time + 0.07, pitch * 0.985])
    }
    before = level
  }
  // The growl sinks into the room's hum once the tubes hold.
  const end = strikeLevels.at(-1)![0] + 0.36
  growl.push([end, 0])
  return { duration: end + 0.02, pan: 0, voices: [
    { _tag: 'Noise', filter: { type: 'highpass', frequency: [[0, 2600]], q: 0.7 }, level: tick },
    { _tag: 'Tone', wave: 'sine', pitch: note, level: ring },
    { _tag: 'Tone', wave: 'sawtooth', filter: { type: 'bandpass', frequency: [[0, 360]], q: 0.8 }, pitch: [[0, 120]], level: growl },
  ] }
}

/** The sound of each action, by name. */
export const actionSounds: Record<ActionSound, (index: number) => Shot> = { KeyClick: keyClick, MarkerSqueak: markerSqueak, JarBubbles: jarBubbles, LightSwitch: lightSwitch, TubeStrike: tubeStrike }
