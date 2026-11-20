/** A point on a curve: seconds from the start of the sound, and a value. */
export type ShotPoint = readonly [time: number, value: number]
export type ShotFilter = { type: 'lowpass' | 'highpass' | 'bandpass', frequency: readonly ShotPoint[], q: number }
/**
 * One voice of a short sound. `level` starts at zero and moves in straight lines through its points.
 * `pitch` and a filter's `frequency` glide through their points, in hertz.
 */
export type ShotVoice =
  | { _tag: 'Tone', wave: 'sine' | 'triangle' | 'sawtooth' | 'square', pitch: readonly ShotPoint[], level: readonly ShotPoint[], filter?: ShotFilter }
  | { _tag: 'Noise', level: readonly ShotPoint[], filter: ShotFilter }
/** A short sound as data. `pan` runs from -1 at the left to 1 at the right. Pure code decides what plays, and `playShot` only plays it. */
export type Shot = { duration: number, pan: number, voices: readonly ShotVoice[] }

/** A repeatable number from 0 to 1 for an index and a seed. Sounds vary with it, and a test can name each value. */
export function shotChance(index: number, seed: number) {
  const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453
  return value - Math.floor(value)
}

/** The level of a voice at a time in the sound. */
export function shotLevelAt(level: readonly ShotPoint[], time: number) {
  let last: ShotPoint = [0, 0]
  for (const point of level) {
    if (time < point[0]) return last[1] + (point[1] - last[1]) * (time - last[0]) / Math.max(1e-9, point[0] - last[0])
    last = point
  }
  return last[1]
}

/** The most the voices of a sound can reach together, before any filter. */
export const shotPeak = (shot: Shot) => shot.voices.reduce((sum, voice) => sum + Math.max(...voice.level.map(point => point[1])), 0)

/** What an ambience's steady layers need from the graph. `own` lets the graph release them when the set changes. */
export type LayerStage = { context: BaseAudioContext, noise: AudioBuffer, own: <T extends AudioNode>(node: T) => T, output: AudioNode }

/** What `playShot` needs from the graph. `own` and `start` let the graph release the nodes when the sound ends. */
export type ShotStage = {
  context: BaseAudioContext
  noise: AudioBuffer
  own: <T extends AudioNode>(node: T) => T
  start: (source: AudioScheduledSourceNode) => void
}

function glide(param: AudioParam, points: readonly ShotPoint[], at: number) {
  points.forEach(([time, value], index) => index ? param.exponentialRampToValueAtTime(value, at + time) : param.setValueAtTime(value, at + time))
}

/** Plays a short sound into `output` at audio time `at`. It holds no decisions: every time, pitch, and level comes from the data. */
export function playShot({ context, noise, own, start }: ShotStage, shot: Shot, at: number, output: AudioNode) {
  const pan = own(context.createStereoPanner())
  pan.pan.value = shot.pan
  pan.connect(output)
  for (const voice of shot.voices) {
    const gain = own(context.createGain())
    gain.gain.setValueAtTime(0, at)
    for (const [time, level] of voice.level) gain.gain.linearRampToValueAtTime(level, at + time)
    gain.connect(pan)
    let source: AudioScheduledSourceNode
    if (voice._tag === 'Tone') {
      const tone = own(context.createOscillator())
      tone.type = voice.wave
      glide(tone.frequency, voice.pitch, at)
      source = tone
    }
    else {
      const hiss = own(context.createBufferSource())
      hiss.buffer = noise
      hiss.loop = true
      source = hiss
    }
    if (voice.filter) {
      const filter = own(context.createBiquadFilter())
      filter.type = voice.filter.type
      filter.Q.value = voice.filter.q
      glide(filter.frequency, voice.filter.frequency, at)
      source.connect(filter).connect(gain)
    }
    else source.connect(gain)
    start(source)
  }
}
