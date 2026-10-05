export type SceneAudioStatus =
  | { _tag: 'Idle' }
  | { _tag: 'Running' }
  | { _tag: 'Suspended', reason: 'muted' | 'hidden' }
  | { _tag: 'Unavailable' }
export type SceneAudioState = { muted: boolean, status: SceneAudioStatus }
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
  context: AudioContext, master: GainNode, ambience: GainNode, noise: AudioBuffer,
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

export function createSceneAudio(dependencies: SceneAudioDependencies) {
  let graph: Graph | undefined
  let timer: number | undefined
  let muted = false
  let visible = true
  let talking = false
  let disposed = false
  let nextDrip = 0
  let status: SceneAudioStatus = { _tag: 'Idle' }
  const publish = (next: SceneAudioStatus) => { status = next; dependencies.onState({ muted, status }) }
  const stopTimer = () => { if (timer !== undefined) dependencies.cancel(timer); timer = undefined }

  function createGraph(context: AudioContext): Graph {
    const nodes = new Set<AudioNode>()
    const sources = new Set<AudioScheduledSourceNode>()
    const own = <T extends AudioNode>(node: T) => { nodes.add(node); return node }
    const master = own(context.createGain())
    master.gain.value = 0.055
    const limiter = own(context.createDynamicsCompressor())
    limiter.threshold.value = -22
    limiter.knee.value = 12
    limiter.ratio.value = 12
    limiter.attack.value = 0.015
    limiter.release.value = 0.22
    master.connect(limiter).connect(context.destination)
    const ambience = own(context.createGain())
    ambience.gain.value = 0.75
    ambience.connect(master)
    const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
    const samples = noise.getChannelData(0)
    let previous = 0
    for (let index = 0; index < samples.length; index++) {
      previous = previous * 0.87 + (dependencies.random() * 2 - 1) * 0.13
      samples[index] = previous
    }
    const noiseSource = own(context.createBufferSource())
    noiseSource.buffer = noise
    noiseSource.loop = true
    const room = own(context.createBiquadFilter())
    room.type = 'lowpass'; room.frequency.value = 210; room.Q.value = 0.7
    const roomGain = own(context.createGain())
    roomGain.gain.value = 0.2
    noiseSource.connect(room).connect(roomGain).connect(ambience)
    const breath = own(context.createBiquadFilter())
    breath.type = 'bandpass'; breath.frequency.value = 430; breath.Q.value = 0.65
    const breathGain = own(context.createGain())
    breathGain.gain.value = 0.047
    noiseSource.connect(breath).connect(breathGain).connect(ambience)
    const breathLfo = own(context.createOscillator())
    breathLfo.frequency.value = 0.095
    const breathDepth = own(context.createGain())
    breathDepth.gain.value = 0.03
    breathLfo.connect(breathDepth).connect(breathGain.gain)
    const rumble = own(context.createOscillator())
    rumble.type = 'sine'; rumble.frequency.value = 44
    const rumbleGain = own(context.createGain())
    rumbleGain.gain.value = 0.13
    rumble.connect(rumbleGain).connect(ambience)
    for (const source of [noiseSource, breathLfo, rumble]) { sources.add(source); source.start() }
    return { context, master, ambience, noise, nodes, sources, sounds: new Set() }
  }

  function soundScope(current: Graph, duration: number, voice: boolean): SoundScope {
    const scope = { nodes: new Set<AudioNode>(), sources: new Set<AudioScheduledSourceNode>(),
      start: current.context.currentTime, duration, voice, envelope: (_time: number) => 0 }
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
  function drip(current: Graph) {
    const scope = soundScope(current, 0.35, false)
    const context = current.context
    const oscillator = ownSound(scope, context.createOscillator())
    oscillator.frequency.setValueAtTime(280 + dependencies.random() * 90, scope.start)
    oscillator.frequency.exponentialRampToValueAtTime(75, scope.start + 0.22)
    const filter = ownSound(scope, context.createBiquadFilter())
    filter.type = 'lowpass'; filter.frequency.value = 650
    const gain = ownSound(scope, context.createGain())
    gain.gain.setValueAtTime(0.0001, scope.start)
    gain.gain.exponentialRampToValueAtTime(0.055, scope.start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, scope.start + scope.duration)
    const pan = ownSound(scope, context.createStereoPanner())
    pan.pan.value = dependencies.random() * 1.2 - 0.6
    oscillator.connect(filter).connect(gain).connect(pan).connect(current.ambience)
    startSound(current, scope, oscillator)
  }

  function tick() {
    if (!graph || disposed || status._tag !== 'Running') return
    const now = graph.context.currentTime
    if (now >= nextDrip) {
      drip(graph)
      nextDrip = now + 3.7 + dependencies.random() * 5.2
    }
    let voice = 0
    for (const sound of graph.sounds) if (sound.voice) voice = Math.max(voice, sound.envelope(now))
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
      clearShortSounds(current)
      dependencies.onVoice(0)
      await current.context.suspend()
    }
    else await current.context.resume()
    if (disposed || graph !== current) return
    if (shouldRun !== (visible && !muted)) return reconcile()
    if (shouldRun) {
      current.master.gain.setTargetAtTime(0.055, current.context.currentTime, 0.05)
      publish({ _tag: 'Running' })
      if (timer === undefined) { nextDrip = current.context.currentTime + 2.8; tick() }
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
    const frequency = 104
    const throat = ownSound(scope, context.createBiquadFilter())
    throat.type = 'bandpass'; throat.Q.value = 1.7
    throat.frequency.setValueAtTime(420, scope.start)
    throat.frequency.linearRampToValueAtTime(740, scope.start + duration * 0.32)
    throat.frequency.linearRampToValueAtTime(330, scope.start + duration)
    const envelope = ownSound(scope, context.createGain())
    envelope.gain.setValueAtTime(0.0001, scope.start)
    for (const syllable of phrase.syllables) {
      const onset = scope.start + syllable.start
      envelope.gain.setValueAtTime(0.0001, onset)
      envelope.gain.exponentialRampToValueAtTime(0.22 * syllable.strength, onset + 0.045)
      envelope.gain.exponentialRampToValueAtTime(0.0001, onset + syllable.duration)
    }
    throat.connect(envelope).connect(current.master)
    const croak = ownSound(scope, context.createOscillator())
    croak.type = 'sawtooth'
    for (const syllable of phrase.syllables) {
      const onset = scope.start + syllable.start
      croak.frequency.setValueAtTime(syllable.pitch, onset)
      croak.frequency.linearRampToValueAtTime(syllable.pitch * 1.16, onset + syllable.duration * 0.3)
      croak.frequency.exponentialRampToValueAtTime(syllable.pitch * 0.72, onset + syllable.duration)
    }
    const trill = ownSound(scope, context.createOscillator())
    trill.frequency.value = 27
    const trillDepth = ownSound(scope, context.createGain())
    trillDepth.gain.value = 8
    trill.connect(trillDepth).connect(croak.frequency)
    const soft = ownSound(scope, context.createOscillator())
    soft.type = 'triangle'; soft.frequency.value = frequency * 1.48
    const softGain = ownSound(scope, context.createGain())
    softGain.gain.value = 0.2
    croak.connect(throat)
    soft.connect(softGain).connect(throat)
    for (const source of [croak, trill, soft]) startSound(current, scope, source)
  }

  publish(status)
  return {
    async activate() {
      if (disposed || muted) return
      // The caller must call activate from a trusted pointer or keyboard handler.
      await Promise.resolve().then(async () => {
        if (!graph) {
          const context = dependencies.createContext()
          graph = createGraph(context)
          graph.ambience.gain.value = talking ? 0.34 : 0.75
        }
        await reconcile()
      }).catch(handleFailure)
    },
    setMuted(value: boolean) {
      muted = value
      if (!graph) { publish({ _tag: 'Idle' }); return }
      graph.master.gain.setTargetAtTime(value ? 0 : 0.055, graph.context.currentTime, 0.025)
      void reconcile().catch(handleFailure)
    },
    setVisible(value: boolean) { visible = value; void reconcile().catch(handleFailure) },
    setTalking(value: boolean) {
      talking = value
      if (graph) {
        graph.ambience.gain.setTargetAtTime(talking ? 0.34 : 0.75, graph.context.currentTime, 0.15)
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
    async dispose() {
      disposed = true
      stopTimer(); dependencies.onVoice(0)
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
