export type SceneAudioStatus =
  | { _tag: 'Idle' }
  | { _tag: 'Running' }
  | { _tag: 'Suspended', reason: 'muted' | 'hidden' }
  | { _tag: 'Unavailable' }
export type SceneAudioState = { muted: boolean, status: SceneAudioStatus }
export type SceneAudioMix = { master: number, ambience: number, voice: number }
export const defaultSceneAudioMix: SceneAudioMix = { master: 0.7, ambience: 0.6, voice: 0.8 }
export function parseSceneAudioMix(value: SceneAudioMix): SceneAudioMix {
  const level = (input: number, fallback: number) => Number.isFinite(input) ? Math.max(0, Math.min(1, input)) : fallback
  return { master: level(value.master, defaultSceneAudioMix.master), ambience: level(value.ambience, defaultSceneAudioMix.ambience), voice: level(value.voice, defaultSceneAudioMix.voice) }
}
export type SceneAudioDependencies = {
  createContext: () => AudioContext
  random: () => number
  schedule: (callback: () => void, delay: number) => number
  cancel: (timer: number) => void
  onState: (state: SceneAudioState) => void
  onVoice: (envelope: number) => void
  onError: (error: unknown) => void
}
type SoundScope = { nodes: Set<AudioNode>, sources: Set<AudioScheduledSourceNode>, start: number, duration: number, voice: boolean, envelope: (time: number) => number }
export type VoiceSyllable = { start: number, duration: number, pitch: number, strength: number }

export function createVoicePhrase(kind: 'open' | 'reply', replyLength: number, random: () => number) {
  const length = Number.isFinite(replyLength) ? Math.max(0, Math.min(1000, replyLength)) : 120
  const duration = kind === 'open' ? 1.2 : Math.min(8, 3 + length / 65)
  const syllables: VoiceSyllable[] = []
  let start = 0
  while (start < duration - 0.15) {
    const syllableDuration = Math.min(duration - start, 0.19 + random() * 0.28)
    syllables.push({ start, duration: syllableDuration, pitch: 89 + random() * 53, strength: 0.56 + random() * 0.24 })
    start += syllableDuration + 0.065 + random() * 0.17
  }
  return { duration, syllables }
}

export function phraseVoiceEnvelope(time: number, start: number, syllables: readonly VoiceSyllable[]) {
  return syllables.reduce((peak, syllable) => Math.max(peak,
    sceneVoiceEnvelope(time, start + syllable.start, syllable.duration) * syllable.strength), 0)
}
type Graph = {
  context: AudioContext, master: GainNode, ambience: GainNode, voice: GainNode, noise: AudioBuffer,
  nodes: Set<AudioNode>, sources: Set<AudioScheduledSourceNode>, sounds: Set<SoundScope>,
}

/** A known synthesizer envelope drives the face. It never reads a microphone. */
export function sceneVoiceEnvelope(time: number, start: number, duration: number) {
  const elapsed = time - start
  if (elapsed <= 0 || elapsed >= duration) return 0
  const attack = Math.min(1, elapsed / 0.09)
  const release = Math.min(1, (duration - elapsed) / 0.28)
  return Math.max(0, Math.min(1, attack * release * (0.68 + Math.sin(elapsed * 29) * 0.14)))
}

// Stage gains, set by offline rendering at the default mix. The room averages about -29 dBFS,
// drips peak near -11 dBFS, and a reply peaks near -3 dBFS. Most room energy sits above 200 Hz for small speakers.
const levels = {
  ambience: 1, voice: 3.5, room: 0.5, breath: 0.25, drone: 0.04,
  drip: 0.55, squelch: 2.2, bubble: 0.22, groan: 0.65, click: 0.12,
}
// Formant pairs for a, e, o, u, and a neutral vowel, set low for a large throat.
const vowels = [[660, 1100], [460, 1650], [500, 860], [360, 900], [560, 1200]] as const
// Soft clipping strains the voice without a harsh digital edge.
const gritCurve = Float32Array.from({ length: 1025 }, (_, index) => Math.tanh((index / 512 - 1) * 2.6) / Math.tanh(2.6))

// Wet stone absorbs treble first, so the cave tail darkens as it decays.
function caveImpulse(context: BaseAudioContext, random: () => number) {
  const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * 2.4), context.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const samples = impulse.getChannelData(channel)
    let dark = 0
    for (let index = 0; index < samples.length; index++) {
      const time = index / context.sampleRate
      const smoothing = Math.min(0.92, 0.35 + time * 0.3)
      dark = dark * smoothing + (random() * 2 - 1) * (1 - smoothing)
      samples[index] = dark * Math.exp(-time * 2.6)
    }
  }
  return impulse
}

export function createSceneAudio(dependencies: SceneAudioDependencies) {
  let graph: Graph | undefined
  let timer: number | undefined
  let muted = false
  let visible = true
  let talking = false
  let disposed = false
  let nextDrip = 0
  let nextGurgle = 0
  let nextGroan = 0
  let status: SceneAudioStatus = { _tag: 'Idle' }
  let mix = { ...defaultSceneAudioMix }
  let duckUntil = 0
  let fadeTimer: number | undefined
  let fadeResolve: (() => void) | undefined
  const publish = (next: SceneAudioStatus) => { status = next; dependencies.onState({ muted, status }) }
  const stopTimer = () => { if (timer !== undefined) dependencies.cancel(timer); timer = undefined }
  const cancelFade = () => { if (fadeTimer !== undefined) dependencies.cancel(fadeTimer); fadeTimer = undefined; fadeResolve?.(); fadeResolve = undefined }
  const fadeBeforeSuspend = () => new Promise<void>(resolve => {
    cancelFade(); fadeResolve = resolve
    fadeTimer = dependencies.schedule(() => { fadeTimer = undefined; fadeResolve = undefined; resolve() }, 45)
  })
  const ambienceLevel = (ducked: boolean) => mix.ambience * levels.ambience * (ducked ? 0.3 : talking ? 0.72 : 1)

  function createGraph(context: AudioContext): Graph {
    const nodes = new Set<AudioNode>()
    const sources = new Set<AudioScheduledSourceNode>()
    const own = <T extends AudioNode>(node: T) => { nodes.add(node); return node }
    const master = own(context.createGain())
    master.gain.value = mix.master
    // A safety limiter. Calibrated stages stay near or below its threshold.
    const limiter = own(context.createDynamicsCompressor())
    limiter.threshold.value = -3
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.002
    limiter.release.value = 0.2
    master.connect(limiter).connect(context.destination)
    const ambience = own(context.createGain())
    ambience.gain.value = ambienceLevel(false)
    ambience.connect(master)
    const voice = own(context.createGain())
    voice.gain.value = mix.voice * levels.voice
    voice.connect(master)
    // One cave echoes everything. The ambience sends more than the voice, so speech stays clear.
    const cave = own(context.createConvolver())
    cave.buffer = caveImpulse(context, dependencies.random)
    cave.connect(master)
    const ambienceEcho = own(context.createGain())
    ambienceEcho.gain.value = 0.6
    ambience.connect(ambienceEcho).connect(cave)
    const voiceEcho = own(context.createGain())
    voiceEcho.gain.value = 0.18
    voice.connect(voiceEcho).connect(cave)
    const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
    const samples = noise.getChannelData(0)
    for (let index = 0; index < samples.length; index++) samples[index] = dependencies.random() * 2 - 1
    const noiseSource = own(context.createBufferSource())
    noiseSource.buffer = noise
    noiseSource.loop = true
    // Room tone: a low wash that small speakers can still play.
    const room = own(context.createBiquadFilter())
    room.type = 'lowpass'; room.frequency.value = 360; room.Q.value = 0.5
    const roomGain = own(context.createGain())
    roomGain.gain.value = levels.room
    noiseSource.connect(room).connect(roomGain).connect(ambience)
    // The room breathes: an airy band swells and brightens about every eight seconds.
    const breath = own(context.createBiquadFilter())
    breath.type = 'bandpass'; breath.frequency.value = 640; breath.Q.value = 0.9
    const breathGain = own(context.createGain())
    breathGain.gain.value = levels.breath
    noiseSource.connect(breath).connect(breathGain).connect(ambience)
    const breathCycle = own(context.createOscillator())
    breathCycle.frequency.value = 0.125
    const breathDepth = own(context.createGain())
    breathDepth.gain.value = levels.breath
    const breathSweep = own(context.createGain())
    breathSweep.gain.value = 240
    breathCycle.connect(breathDepth).connect(breathGain.gain)
    breathCycle.connect(breathSweep).connect(breath.frequency)
    // Drone: two beating saws, filtered so their low harmonics still carry on laptop speakers.
    const droneFilter = own(context.createBiquadFilter())
    droneFilter.type = 'lowpass'; droneFilter.frequency.value = 230; droneFilter.Q.value = 2.5
    const droneGain = own(context.createGain())
    droneGain.gain.value = levels.drone
    droneFilter.connect(droneGain).connect(ambience)
    const droneLow = own(context.createOscillator())
    droneLow.type = 'sawtooth'; droneLow.frequency.value = 55
    const droneHigh = own(context.createOscillator())
    droneHigh.type = 'sawtooth'; droneHigh.frequency.value = 55.45
    droneLow.connect(droneFilter)
    droneHigh.connect(droneFilter)
    const droneDrift = own(context.createOscillator())
    droneDrift.frequency.value = 0.045
    const droneDepth = own(context.createGain())
    droneDepth.gain.value = 70
    droneDrift.connect(droneDepth).connect(droneFilter.frequency)
    for (const source of [noiseSource, breathCycle, droneLow, droneHigh, droneDrift]) { sources.add(source); source.start() }
    return { context, master, ambience, voice, noise, nodes, sources, sounds: new Set() }
  }

  function soundScope(current: Graph, duration: number, voice: boolean, delay = 0): SoundScope {
    const scope = { nodes: new Set<AudioNode>(), sources: new Set<AudioScheduledSourceNode>(),
      start: current.context.currentTime + delay, duration, voice, envelope: (_time: number) => 0 }
    current.sounds.add(scope)
    return scope
  }
  function ownSound<T extends AudioNode>(scope: SoundScope, node: T) { scope.nodes.add(node); return node }
  function startSound(current: Graph, scope: SoundScope, source: AudioScheduledSourceNode) {
    scope.sources.add(source)
    current.sources.add(source)
    source.onended = () => {
      current.sources.delete(source)
      scope.sources.delete(source)
      if (!scope.sources.size) {
        scope.nodes.forEach(node => node.disconnect())
        scope.nodes.clear()
        current.sounds.delete(scope)
      }
    }
    source.start(scope.start)
    source.stop(scope.start + scope.duration)
  }
  function noiseSource(current: Graph, scope: SoundScope) {
    const source = ownSound(scope, current.context.createBufferSource())
    source.buffer = current.noise
    source.loop = true
    return source
  }
  function panner(current: Graph, scope: SoundScope) {
    const node = ownSound(scope, current.context.createStereoPanner())
    node.pan.value = dependencies.random() * 1.4 - 0.7
    node.connect(current.ambience)
    return node
  }
  // A drop lands in a shallow pool: a short click, then a bubble whose pitch rises as it closes.
  function drip(current: Graph, delay = 0, size = 1) {
    const scope = soundScope(current, 0.32, false, delay)
    const context = current.context
    const at = scope.start
    const pitch = 620 + dependencies.random() * 760
    const bubble = ownSound(scope, context.createOscillator())
    bubble.frequency.setValueAtTime(pitch, at)
    bubble.frequency.exponentialRampToValueAtTime(pitch * 2.3, at + 0.045)
    const bubbleGain = ownSound(scope, context.createGain())
    bubbleGain.gain.setValueAtTime(0, at)
    bubbleGain.gain.linearRampToValueAtTime(levels.drip * size, at + 0.003)
    bubbleGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18)
    const click = noiseSource(current, scope)
    const clickFilter = ownSound(scope, context.createBiquadFilter())
    clickFilter.type = 'highpass'; clickFilter.frequency.value = 2400
    const clickGain = ownSound(scope, context.createGain())
    clickGain.gain.setValueAtTime(0, at)
    clickGain.gain.linearRampToValueAtTime(levels.drip * size * 0.35, at + 0.001)
    clickGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.012)
    const pan = panner(current, scope)
    bubble.connect(bubbleGain).connect(pan)
    click.connect(clickFilter).connect(clickGain).connect(pan)
    startSound(current, scope, bubble)
    startSound(current, scope, click)
  }
  // Something wet shifts inside the walls: a resonant squelch with a few rising bubbles.
  function gurgle(current: Graph) {
    const scope = soundScope(current, 0.9, false)
    const context = current.context
    const at = scope.start
    const pan = panner(current, scope)
    const squelch = noiseSource(current, scope)
    const band = ownSound(scope, context.createBiquadFilter())
    band.type = 'bandpass'; band.Q.value = 7
    band.frequency.setValueAtTime(260, at)
    band.frequency.exponentialRampToValueAtTime(820, at + 0.22)
    band.frequency.exponentialRampToValueAtTime(300, at + 0.6)
    const squelchGain = ownSound(scope, context.createGain())
    squelchGain.gain.setValueAtTime(0, at)
    squelchGain.gain.linearRampToValueAtTime(levels.squelch, at + 0.04)
    squelchGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.62)
    squelch.connect(band).connect(squelchGain).connect(pan)
    const bubble = ownSound(scope, context.createOscillator())
    const bubbleGain = ownSound(scope, context.createGain())
    bubbleGain.gain.setValueAtTime(0, at)
    let onset = at + 0.05
    for (let count = 3 + Math.floor(dependencies.random() * 4); count > 0 && onset < at + 0.75; count--) {
      const pitch = 120 + dependencies.random() * 170
      bubble.frequency.setValueAtTime(pitch, onset)
      bubble.frequency.exponentialRampToValueAtTime(pitch * 1.9, onset + 0.055)
      bubbleGain.gain.setValueAtTime(0, onset)
      bubbleGain.gain.linearRampToValueAtTime(levels.bubble, onset + 0.006)
      bubbleGain.gain.exponentialRampToValueAtTime(0.0001, onset + 0.07)
      onset += 0.075 + dependencies.random() * 0.08
    }
    bubble.connect(bubbleGain).connect(pan)
    startSound(current, scope, squelch)
    startSound(current, scope, bubble)
  }
  // The ceiling membrane stretches: a low strained tone that swells and sags.
  function groan(current: Graph) {
    const scope = soundScope(current, 2.6, false)
    const context = current.context
    const at = scope.start
    const membrane = ownSound(scope, context.createOscillator())
    membrane.type = 'sawtooth'
    membrane.frequency.setValueAtTime(64 + dependencies.random() * 14, at)
    membrane.frequency.linearRampToValueAtTime(46 + dependencies.random() * 8, at + 2.4)
    const wobble = ownSound(scope, context.createOscillator())
    wobble.frequency.value = 5.5
    const wobbleDepth = ownSound(scope, context.createGain())
    wobbleDepth.gain.value = 1.6
    wobble.connect(wobbleDepth).connect(membrane.frequency)
    const band = ownSound(scope, context.createBiquadFilter())
    band.type = 'bandpass'; band.Q.value = 3
    band.frequency.setValueAtTime(280, at)
    band.frequency.linearRampToValueAtTime(520, at + 1)
    band.frequency.linearRampToValueAtTime(240, at + 2.4)
    const gain = ownSound(scope, context.createGain())
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(levels.groan, at + 0.7)
    gain.gain.linearRampToValueAtTime(levels.groan * 0.7, at + 1.8)
    gain.gain.linearRampToValueAtTime(0, at + 2.5)
    membrane.connect(band).connect(gain).connect(panner(current, scope))
    startSound(current, scope, membrane)
    startSound(current, scope, wobble)
  }

  function tick() {
    if (!graph || disposed || status._tag !== 'Running') return
    const now = graph.context.currentTime
    if (now >= nextDrip) {
      drip(graph)
      if (dependencies.random() < 0.35) drip(graph, 0.11 + dependencies.random() * 0.12, 0.45)
      nextDrip = now + 2.2 + dependencies.random() * 4.6
    }
    if (now >= nextGurgle) { gurgle(graph); nextGurgle = now + 6 + dependencies.random() * 9 }
    if (now >= nextGroan) { groan(graph); nextGroan = now + 17 + dependencies.random() * 16 }
    let voice = 0
    for (const sound of graph.sounds) if (sound.voice) voice = Math.max(voice, sound.envelope(now))
    if (voice > 0.015) duckUntil = now + 0.24
    graph.ambience.gain.setTargetAtTime(ambienceLevel(now < duckUntil), now, 0.09)
    dependencies.onVoice(voice)
    timer = dependencies.schedule(tick, 50)
  }

  function clearShortSounds(current: Graph) {
    for (const sound of current.sounds) {
      sound.sources.forEach(source => {
        source.onended = null
        source.stop()
        current.sources.delete(source)
      })
      sound.nodes.forEach(node => node.disconnect())
      sound.nodes.clear(); sound.sources.clear()
    }
    current.sounds.clear()
  }

  async function reconcile() {
    if (!graph || disposed) return
    const current = graph
    const shouldRun = visible && !muted
    if (!shouldRun) {
      stopTimer()
      dependencies.onVoice(0)
      current.master.gain.setTargetAtTime(0, current.context.currentTime, 0.008)
      await fadeBeforeSuspend()
      if (disposed || graph !== current) return
      if (visible && !muted) return reconcile()
      clearShortSounds(current)
      await current.context.suspend()
    }
    else { cancelFade(); await current.context.resume() }
    if (disposed || graph !== current) return
    if (shouldRun !== (visible && !muted)) return reconcile()
    if (shouldRun) {
      current.master.gain.setTargetAtTime(mix.master, current.context.currentTime, 0.05)
      publish({ _tag: 'Running' })
      if (timer === undefined) {
        const now = current.context.currentTime
        nextDrip = now + 1.4; nextGurgle = now + 4.5; nextGroan = now + 10
        tick()
      }
    }
    else publish({ _tag: 'Suspended', reason: muted ? 'muted' : 'hidden' })
  }
  const handleFailure = (error: unknown) => {
    if (disposed) return
    stopTimer(); dependencies.onVoice(0); dependencies.onError(error); publish({ _tag: 'Unavailable' })
  }

  function playMascot(kind: 'open' | 'reply', replyLength = 120) {
    const current = graph
    if (!current || status._tag !== 'Running' || muted || !visible || disposed) return
    // One voice at a time keeps rapid replies quiet and the face envelope unambiguous.
    for (const sound of current.sounds) if (sound.voice) {
      sound.sources.forEach(source => { source.onended = null; source.stop(); current.sources.delete(source) })
      sound.nodes.forEach(node => node.disconnect())
      sound.sources.clear(); sound.nodes.clear(); current.sounds.delete(sound)
    }
    const phrase = createVoicePhrase(kind, replyLength, dependencies.random)
    const { duration } = phrase
    const scope = soundScope(current, duration, true)
    scope.envelope = time => phraseVoiceEnvelope(time, scope.start, phrase.syllables)
    const context = current.context
    const at = scope.start
    // Vocal folds: a strained saw, a sub an octave down, and a fly's 27 Hz flutter.
    const folds = ownSound(scope, context.createOscillator())
    folds.type = 'sawtooth'
    const sub = ownSound(scope, context.createOscillator())
    sub.type = 'square'
    for (const syllable of phrase.syllables) {
      const onset = at + syllable.start
      for (const [oscillator, scale] of [[folds, 1], [sub, 0.5]] as const) {
        oscillator.frequency.setValueAtTime(syllable.pitch * scale, onset)
        oscillator.frequency.linearRampToValueAtTime(syllable.pitch * scale * 1.16, onset + syllable.duration * 0.3)
        oscillator.frequency.exponentialRampToValueAtTime(syllable.pitch * scale * 0.72, onset + syllable.duration)
      }
    }
    const flutter = ownSound(scope, context.createOscillator())
    flutter.frequency.value = 27
    const flutterDepth = ownSound(scope, context.createGain())
    flutterDepth.gain.value = 8
    flutter.connect(flutterDepth).connect(folds.frequency)
    const subGain = ownSound(scope, context.createGain())
    subGain.gain.value = 0.35
    const grit = ownSound(scope, context.createWaveShaper())
    grit.curve = gritCurve
    grit.oversample = '2x'
    folds.connect(grit)
    sub.connect(subGain).connect(grit)
    // Two moving formants make each syllable a vowel, so phrases sound spoken rather than hummed.
    const mouth = ownSound(scope, context.createGain())
    const formants = [{ q: 5, level: 1 }, { q: 7, level: 0.6 }].map(({ q, level }, index) => {
      const filter = ownSound(scope, context.createBiquadFilter())
      filter.type = 'bandpass'; filter.Q.value = q
      filter.frequency.setValueAtTime(vowels[4][index]!, at)
      const gain = ownSound(scope, context.createGain())
      gain.gain.value = level
      grit.connect(filter).connect(gain).connect(mouth)
      return filter
    })
    for (const syllable of phrase.syllables) {
      const vowel = vowels[Math.floor(dependencies.random() * vowels.length)]!
      formants.forEach((filter, index) => filter.frequency.setTargetAtTime(vowel[index]!, at + syllable.start, 0.03))
    }
    // One envelope drives both the sound and the face, so the mouth moves only while he is audible.
    const loudness = ownSound(scope, context.createGain())
    const points = Math.max(2, Math.ceil(duration * 120) + 1)
    loudness.gain.setValueCurveAtTime(Float32Array.from({ length: points }, (_, index) => scope.envelope(at + index / (points - 1) * duration)), at, duration)
    mouth.connect(loudness).connect(current.voice)
    // Mandibles click at the start of some syllables.
    const click = noiseSource(current, scope)
    const clickFilter = ownSound(scope, context.createBiquadFilter())
    clickFilter.type = 'highpass'; clickFilter.frequency.value = 2600
    const clickGain = ownSound(scope, context.createGain())
    clickGain.gain.setValueAtTime(0, at)
    for (const syllable of phrase.syllables) {
      if (dependencies.random() >= 0.4) continue
      const onset = at + syllable.start
      clickGain.gain.setValueAtTime(0, onset)
      clickGain.gain.linearRampToValueAtTime(levels.click, onset + 0.002)
      clickGain.gain.exponentialRampToValueAtTime(0.0001, onset + 0.025)
      clickGain.gain.setValueAtTime(0, onset + 0.026)
    }
    click.connect(clickFilter).connect(clickGain).connect(current.voice)
    duckUntil = at + 0.24
    current.ambience.gain.setTargetAtTime(ambienceLevel(true), at, 0.045)
    for (const source of [folds, sub, flutter, click]) startSound(current, scope, source)
  }

  publish(status)
  return {
    async activate() {
      if (disposed || muted) return
      // The caller must call activate from a trusted pointer or keyboard handler.
      await Promise.resolve().then(async () => {
        if (!graph) graph = createGraph(dependencies.createContext())
        await reconcile()
      }).catch(handleFailure)
    },
    setMuted(value: boolean) {
      muted = value
      if (!graph) { publish({ _tag: 'Idle' }); return }
      graph.master.gain.setTargetAtTime(value ? 0 : mix.master, graph.context.currentTime, 0.025)
      void reconcile().catch(handleFailure)
    },
    setVisible(value: boolean) { visible = value; void reconcile().catch(handleFailure) },
    setTalking(value: boolean) {
      talking = value
      if (graph) {
        graph.ambience.gain.setTargetAtTime(ambienceLevel(false), graph.context.currentTime, 0.15)
        if (!talking) {
          for (const sound of graph.sounds) if (sound.voice) {
            sound.voice = false
            sound.sources.forEach(source => source.stop(graph!.context.currentTime + 0.025))
          }
          dependencies.onVoice(0)
        }
      }
    },
    playMascot,
    setMix(value: SceneAudioMix) {
      mix = parseSceneAudioMix(value)
      if (!graph) return
      const now = graph.context.currentTime
      graph.master.gain.setTargetAtTime(muted || !visible ? 0 : mix.master, now, 0.06)
      graph.voice.gain.setTargetAtTime(mix.voice * levels.voice, now, 0.06)
      graph.ambience.gain.setTargetAtTime(ambienceLevel(now < duckUntil), now, 0.09)
    },
    async dispose() {
      disposed = true
      stopTimer(); cancelFade(); dependencies.onVoice(0)
      const current = graph
      graph = undefined
      if (!current) return
      current.sources.forEach(source => { source.onended = null; source.stop() })
      current.sounds.forEach(scope => { scope.nodes.forEach(node => node.disconnect()); scope.nodes.clear(); scope.sources.clear() })
      current.nodes.forEach(node => node.disconnect())
      current.sources.clear(); current.sounds.clear(); current.nodes.clear()
      if (current.context.state !== 'closed') await current.context.close()
    },
  }
}
