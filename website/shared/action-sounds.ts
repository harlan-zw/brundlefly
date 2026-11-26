import { strikeLevels } from '../layers/brand/shared/office-entrance.ts'
import { shotChance } from './audio-shot.ts'
import { criticalStruckAt } from './office-critical.ts'
import type { Shot, ShotPoint } from './audio-shot.ts'

/** A short sound for something he does. The scene asks for the switch and the strike in the office entrance. Nothing asks for the others yet. */
export type ActionSound = 'KeyClick' | 'MarkerSqueak' | 'JarBubbles' | 'LightSwitch' | 'TubeStrike' | 'FlyBuzz' | 'CricketChirp' | 'ChamberHum' | 'HoldPulse' | 'MachineThump' | 'ArcZap'

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

/** A fly lands in the office experiment: a short low buzz that rises. Each one has its own pitch and place. */
export function flyBuzz(index: number): Shot {
  const pitch = 140 + shotChance(index, 31) * 40
  return { duration: 0.16, pan: shotChance(index, 32) * 0.6 - 0.3, voices: [{ _tag: 'Tone', wave: 'sawtooth', pitch: [[0, pitch], [0.15, pitch * 1.5]], level: [[0, 0], [0.018, 0.035], [0.15, 0]] }] }
}

/** A cricket lands in the office experiment: two quick high chirps. Each one has its own pitch and place. */
export function cricketChirp(index: number): Shot {
  const pitch = 2000 + shotChance(index, 41) * 500
  return { duration: 0.13, pan: shotChance(index, 42) * 0.6 - 0.3, voices: [{ _tag: 'Tone', wave: 'sine', pitch: [[0, pitch], [0.13, pitch * 1.4]], level: [[0, 0], [0.012, 0.07], [0.054, 0], [0.073, 0.06], [0.13, 0]] }] }
}

/** His hand lands flat on the vending machine: a dull thump of sheet metal, and the bags inside rattle after it. Each blow is a little different. */
export function machineThump(index: number): Shot {
  const pitch = 78 + shotChance(index, 51) * 18
  return { duration: 0.42, pan: 0.55, voices: [
    { _tag: 'Tone', wave: 'sine', pitch: [[0, pitch * 1.6], [0.09, pitch]], level: [[0, 0], [0.006, 0.09], [0.16, 0]] },
    { _tag: 'Noise', level: [[0, 0], [0.004, 0.06], [0.07, 0]], filter: { type: 'lowpass', frequency: [[0, 900], [0.07, 240]], q: 0.8 } },
    { _tag: 'Noise', level: [[0.05, 0], [0.09, 0.022], [0.2, 0.008], [0.4, 0]], filter: { type: 'bandpass', frequency: [[0.05, 3200 + shotChance(index, 52) * 900], [0.4, 2400]], q: 3 } },
  ] }
}

/** A green arc leaps from the chamber: a sharp crack that falls in pitch, and a short hiss after it. Each arc is a little different. */
export function arcZap(index: number): Shot {
  const pitch = 1500 + shotChance(index, 61) * 900
  return { duration: 0.3, pan: shotChance(index, 62) * 1.2 - 0.6, voices: [
    { _tag: 'Tone', wave: 'sawtooth', pitch: [[0, pitch], [0.08, pitch * 0.22], [0.28, 90]], level: [[0, 0], [0.004, 0.07], [0.05, 0.03], [0.1, 0.05], [0.28, 0]] },
    { _tag: 'Noise', level: [[0, 0], [0.003, 0.08], [0.06, 0.02], [0.3, 0]], filter: { type: 'highpass', frequency: [[0, 2600], [0.3, 900]], q: 0.7 } },
  ] }
}

/**
 * The hum of the test chamber in the critical scene of the office experiment. It is the one long action sound: it lasts `seconds`, from the moment the run goes critical to the moment the tubes go out.
 * It starts low and quiet, rises with the chamber's light, and stops dead.
 */
export function chamberHum(seconds: number): Shot {
  const end = seconds - 0.05
  return { duration: seconds, pan: 0.25, voices: [
    { _tag: 'Tone', wave: 'sawtooth', pitch: [[0, 46], [seconds * 0.75, 58], [end, 92]], level: [[0, 0], [seconds * 0.2, 0.04], [seconds * 0.75, 0.09], [end, 0.12], [seconds, 0]],
      filter: { type: 'lowpass', frequency: [[0, 160], [seconds * 0.75, 420], [end, 1100]], q: 1 } },
    { _tag: 'Tone', wave: 'sine', pitch: [[0, 92], [seconds * 0.75, 116], [end, 184]], level: [[0, 0], [seconds * 0.2, 0.02], [end, 0.06], [seconds, 0]] },
  ] }
}

/**
 * A low, rising pulse played while the projector holds in the dark waiting for the presenter's clicker reveal.
 * Each pulse swells smoothly and returns to silence, so repeated pulses keep tension alive without dead air.
 */
export function holdPulse(index: number): Shot {
  const base = 52 + (index % 4) * 4
  return { duration: 1, pan: 0, voices: [
    { _tag: 'Tone', wave: 'sawtooth', pitch: [[0, base], [0.7, base * 1.18], [1, base * 1.05]],
      level: [[0, 0], [0.18, 0.04], [0.7, 0.09], [1, 0]],
      filter: { type: 'lowpass', frequency: [[0, 140], [0.7, 360], [1, 160]], q: 1.2 } },
    { _tag: 'Tone', wave: 'sine', pitch: [[0, base * 2], [0.7, base * 2.36], [1, base * 2.1]],
      level: [[0, 0], [0.22, 0.02], [0.7, 0.045], [1, 0]] },
  ] }
}

/** The sound of each action, by name. */
export const actionSounds: Record<ActionSound, (index: number) => Shot> = { KeyClick: keyClick, MarkerSqueak: markerSqueak, JarBubbles: jarBubbles, LightSwitch: lightSwitch, TubeStrike: tubeStrike,
  FlyBuzz: flyBuzz, CricketChirp: cricketChirp, MachineThump: machineThump, ArcZap: arcZap,
  // The hum ends as the last tube goes out in the critical scene.
  ChamberHum: () => chamberHum(criticalStruckAt),
  HoldPulse: holdPulse }
