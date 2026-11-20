import { tubeFlicker } from '../layers/brand/shared/office-flicker.ts'
import { shotChance } from './audio-shot.ts'
import type { LayerStage, Shot, ShotPoint } from './audio-shot.ts'

// The office stands on a 60 Hz supply. A tube ballast hums at twice the supply, and a set's line scan whines at 15.7 kHz.
export const mainsHz = 60
export const ballastHz = mainsHz * 2
export const scanHz = 15734

// Stage gains, set by offline rendering at the default mix. The office averages about -39 dBFS, 10 dB below the cave.
// The hum's harmonics from 240 Hz to 480 Hz carry it on small speakers. The whine holds under one percent of the energy.
export const officeLevels = {
  hum: 0.024, mains: 0.0046, buzz: 0.021, flicker: 0.18,
  fan: 0.07, fanTone: 0.0021, whine: 0.0011, air: 0.12, airSwell: 0.036,
  tick: 0.035, glug: 0.035, door: 0.06, creak: 0.09,
  room: 0.3, voiceRoom: 0.14,
}

/** How loud the faulty tube's extra buzz is, from 0 to 1, for the light it gives. A steady tube adds none. */
export const flickerBuzz = (brightness: number) => Math.max(0, Math.min(1, 1 - brightness))

// The buzz follows the light in steps this long. The light changes level at most five times a second.
const buzzStep = 0.02
export type BuzzChange = { time: number, level: number }
/**
 * The changes of the tube's extra buzz in a span of scene time, for a buzz now at `level`.
 * It reads the light's own function, so the sound and the light agree.
 */
export function buzzChanges(from: number, to: number, level: number, light: (time: number) => number = tubeFlicker): BuzzChange[] {
  const changes: BuzzChange[] = []
  for (let step = Math.ceil(from / buzzStep - 1e-6); step * buzzStep < to; step++) {
    const next = flickerBuzz(light((step + 0.5) * buzzStep))
    if (next !== level) { level = next; changes.push({ time: step * buzzStep, level }) }
  }
  return changes
}

// A bubble: the level jumps up and dies away, and the pitch rises as the bubble closes.
function bubbles(count: number, start: number, gap: (index: number) => number, pitch: (index: number) => number, level: number, length: number) {
  const tone: ShotPoint[] = []
  const loud: ShotPoint[] = []
  let time = start
  for (let index = 0; index < count; index++) {
    tone.push([time, pitch(index)], [time + length * 0.8, pitch(index) * 1.8])
    loud.push([time, 0], [time + 0.008, level * (1 - index * 0.12)], [time + length, 0])
    time += length + gap(index)
  }
  return { tone, loud, end: time }
}

/** The wall clock. A tick and a tock alternate, a little apart in pitch. */
export function clockTick(index: number): Shot {
  const pitch = index % 2 ? 2300 : 2900
  return { duration: 0.05, pan: 0.45, voices: [
    { _tag: 'Noise', filter: { type: 'bandpass', frequency: [[0, pitch]], q: 6 }, level: [[0, 0], [0.001, officeLevels.tick], [0.012, officeLevels.tick * 0.15], [0.04, 0]] },
  ] }
}

/** The water cooler lets a few air bubbles up through its bottle. */
export function coolerGlug(index: number): Shot {
  const count = 2 + Math.floor(shotChance(index, 3) * 3)
  const low = bubbles(count, 0.02, step => 0.05 + shotChance(index * 7 + step, 4) * 0.09, step => 150 + shotChance(index * 7 + step, 5) * 90, officeLevels.glug, 0.11)
  // A second partial an octave up keeps the glug on speakers that cannot play the first.
  const high = bubbles(count, 0.02, step => 0.05 + shotChance(index * 7 + step, 4) * 0.09, step => 300 + shotChance(index * 7 + step, 5) * 180, officeLevels.glug * 0.45, 0.11)
  return { duration: low.end + 0.05, pan: -0.55, voices: [
    { _tag: 'Tone', wave: 'sine', pitch: low.tone, level: low.loud },
    { _tag: 'Tone', wave: 'sine', pitch: high.tone, level: high.loud },
  ] }
}

/** A door shuts somewhere down the corridor: a latch, then a dull thump through the wall. */
export function distantDoor(index: number): Shot {
  const weight = 0.75 + shotChance(index, 6) * 0.25
  const level = officeLevels.door * weight
  return { duration: 0.7, pan: 0.6, voices: [
    { _tag: 'Noise', filter: { type: 'bandpass', frequency: [[0, 950]], q: 3 }, level: [[0, 0], [0.002, level * 0.4], [0.03, 0]] },
    { _tag: 'Noise', filter: { type: 'lowpass', frequency: [[0.06, 900], [0.4, 320]], q: 0.7 }, level: [[0.06, 0], [0.072, level], [0.2, level * 0.3], [0.6, 0]] },
    { _tag: 'Tone', wave: 'triangle', pitch: [[0.06, 240], [0.4, 150]], level: [[0.06, 0], [0.07, level * 0.8], [0.45, 0]] },
  ] }
}

/** A chair takes a shifted weight: a stick and slip squeak. */
export function chairCreak(index: number): Shot {
  const pitch = 380 + shotChance(index, 7) * 160
  const level = officeLevels.creak
  return { duration: 0.5, pan: -0.2, voices: [
    { _tag: 'Tone', wave: 'sawtooth', filter: { type: 'bandpass', frequency: [[0, 1300], [0.3, 1900], [0.45, 1500]], q: 5 },
      pitch: [[0, pitch], [0.08, pitch * 1.25], [0.16, pitch * 0.9], [0.3, pitch * 1.4], [0.42, pitch * 1.1]],
      level: [[0, 0], [0.03, level], [0.1, level * 0.4], [0.17, level], [0.26, level * 0.3], [0.33, level * 0.8], [0.45, 0]] },
  ] }
}

export type OfficeEvent = { _tag: 'Tick' | 'Glug' | 'Door' | 'Creak', time: number, shot: Shot }
// One event in each slot of this many seconds, at a place in the slot that the slot's number decides.
const slots = [
  { _tag: 'Creak', seconds: 13, seed: 11, shot: chairCreak },
  { _tag: 'Glug', seconds: 19, seed: 12, shot: coolerGlug },
  { _tag: 'Door', seconds: 31, seed: 13, shot: distantDoor },
] as const
/**
 * Every office event that starts in a span of audio time, in seconds. The clock ticks each second.
 * The other events come at irregular times, and the same times on every visit.
 */
export function officeEvents(from: number, to: number): OfficeEvent[] {
  const events: OfficeEvent[] = []
  for (let second = Math.ceil(from); second < to; second++) events.push({ _tag: 'Tick', time: second, shot: clockTick(second) })
  for (const slot of slots) {
    for (let index = Math.max(0, Math.floor(from / slot.seconds)); index * slot.seconds < to; index++) {
      const time = (index + 0.15 + shotChance(index, slot.seed) * 0.7) * slot.seconds
      if (time >= from && time < to) events.push({ _tag: slot._tag, time, shot: slot.shot(index) })
    }
  }
  return events.sort((a, b) => a.time - b.time)
}

// A small hard room: a few early reflections off the walls and desk, then a short bright tail.
export const officeRoomSeconds = 0.32
const reflections = [[0.0031, 0.62], [0.0057, -0.48], [0.0083, 0.4], [0.0119, -0.33], [0.0164, 0.27], [0.0218, -0.2]] as const
/** Fills one channel of the office's room response. The two channels differ a little, so the room has width. */
export function fillOfficeImpulse(samples: Float32Array, channel: number, sampleRate: number) {
  let soft = 0
  for (let index = 0; index < samples.length; index++) {
    const time = index / sampleRate
    soft = soft * 0.3 + (shotChance(index, 21 + channel) * 2 - 1) * 0.7
    // The tail falls 60 dB in about a third of a second.
    samples[index] = soft * Math.exp(-time * 21) * Math.min(1, time / 0.012) * 0.5
  }
  for (const [time, level] of reflections) {
    const index = Math.round(time * (1 + channel * 0.07) * sampleRate)
    if (index < samples.length) samples[index] = samples[index]! + level
  }
}

/** The office's steady layers. It returns their sources, and the gain that the faulty tube's buzz plays through. */
export function buildOfficeAmbience({ context, noise, own, output }: LayerStage) {
  const levels = officeLevels
  const gain = (level: number) => { const node = own(context.createGain()); node.gain.value = level; return node }
  const filter = (type: BiquadFilterType, frequency: number, q: number) => {
    const node = own(context.createBiquadFilter())
    node.type = type; node.frequency.value = frequency; node.Q.value = q
    return node
  }
  const tone = (type: OscillatorType, frequency: number) => {
    const node = own(context.createOscillator())
    node.type = type; node.frequency.value = frequency
    return node
  }
  // Tubes: the ballast hums at twice the supply. A saw gives it the harmonics that small speakers can play.
  const ballast = tone('sawtooth', ballastHz)
  ballast.connect(filter('bandpass', 300, 0.8)).connect(gain(levels.hum)).connect(output)
  // A little of the supply itself, for speakers that reach it.
  const supply = tone('sine', mainsHz)
  supply.connect(gain(levels.mains)).connect(output)
  // The buzz is the top of the same hum.
  const edge = filter('bandpass', 2800, 0.7)
  ballast.connect(edge).connect(gain(levels.buzz)).connect(output)
  // The faulty tube buzzes louder while it stutters. The graph sets this gain from the light's own times.
  const flicker = gain(0)
  ballast.connect(filter('bandpass', 1600, 1.5)).connect(filter('lowpass', 4500, 0.5)).connect(gain(levels.flicker)).connect(flicker).connect(output)
  // Computer: a soft fan with a faint blade tone, and the whine of its screen.
  const hiss = own(context.createBufferSource())
  hiss.buffer = noise
  hiss.loop = true
  hiss.connect(filter('bandpass', 520, 0.5)).connect(filter('lowpass', 1800, 0.5)).connect(gain(levels.fan)).connect(output)
  const blades = tone('sine', 276)
  blades.connect(gain(levels.fanTone)).connect(output)
  const whine = tone('sine', scanHz)
  whine.connect(gain(levels.whine)).connect(output)
  // Ventilation: low air that swells and falls about every eleven seconds.
  const air = gain(levels.air)
  hiss.connect(filter('lowpass', 420, 0.5)).connect(filter('highpass', 150, 0.5)).connect(air).connect(output)
  const swell = tone('sine', 0.09)
  swell.connect(gain(levels.airSwell)).connect(air.gain)
  return { sources: [ballast, supply, hiss, blades, whine, swell], flicker }
}
