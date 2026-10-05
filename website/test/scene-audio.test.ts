import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSceneAudio, createVoicePhrase, phraseVoiceEnvelope, sceneVoiceEnvelope } from '../shared/scene-audio.ts'
import type { SceneAudioState } from '../shared/scene-audio.ts'

test('the procedural face envelope rests outside the voice and releases to zero', () => {
  assert.equal(sceneVoiceEnvelope(4.9, 5, 0.62), 0)
  assert.equal(sceneVoiceEnvelope(5, 5, 0.62), 0)
  assert.equal(sceneVoiceEnvelope(5.62, 5, 0.62), 0)
  assert.ok(sceneVoiceEnvelope(5.11, 5, 0.62) > sceneVoiceEnvelope(5.57, 5, 0.62))
  for (const time of [5.02, 5.11, 5.37, 5.57]) {
    const envelope = sceneVoiceEnvelope(time, 5, 0.62)
    assert.ok(envelope >= 0 && envelope <= 1)
  }
})

test('reply phrases scale with text and rest between bounded syllables', () => {
  const short = createVoicePhrase('reply', 0, () => 0.5)
  const long = createVoicePhrase('reply', 1000, () => 0.5)
  assert.equal(short.duration, 3)
  assert.equal(long.duration, 8)
  assert.equal(createVoicePhrase('open', 1000, () => 0.5).duration, 1.2)
  assert.equal(createVoicePhrase('reply', Infinity, () => 0.5).duration, createVoicePhrase('reply', 120, () => 0.5).duration)
  const first = short.syllables[0]!
  assert.ok(phraseVoiceEnvelope(first.start + 0.12, 0, short.syllables) > 0)
  assert.equal(phraseVoiceEnvelope(first.start + first.duration + 0.01, 0, short.syllables), 0)
  assert.equal(phraseVoiceEnvelope(8, 0, long.syllables), 0)
  for (let time = 0; time < 8; time += 0.05) assert.ok(phraseVoiceEnvelope(time, 0, long.syllables) <= 1)
})

test('replies replace old voices and mute, visibility, and disposal release resources', async () => {
  let active = 0
  let disconnected = 0
  let scheduled = 0
  let cancelled = 0
  let state = 'suspended'
  const voices: number[] = []
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} })
  const node = () => {
    let started = false
    let stopped = false
    return {
      gain: param(), frequency: param(), Q: param(), pan: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
      connect(next: unknown) { return next }, disconnect() { disconnected++ },
      start() { started = true; active++ }, stop(at?: number) { if (at === undefined && started && !stopped) { stopped = true; active-- } },
    }
  }
  const context = {
    currentTime: 0, sampleRate: 20, destination: node(), get state() { return state },
    createGain: node, createDynamicsCompressor: node, createBiquadFilter: node, createOscillator: node,
    createBufferSource: node, createStereoPanner: node,
    createBuffer: () => ({ getChannelData: () => new Float32Array(40) }),
    async resume() { state = 'running' }, async suspend() { state = 'suspended' }, async close() { state = 'closed' },
  }
  const audio = createSceneAudio({
    createContext: () => context as unknown as AudioContext, random: () => 0.5,
    schedule: () => { scheduled++; return scheduled }, cancel: () => { cancelled++ },
    onState: () => {}, onVoice: value => voices.push(value), onError: error => { throw error },
  })
  await audio.activate()
  assert.equal(active, 3)
  audio.playMascot('reply', 400)
  assert.equal(active, 6)
  audio.playMascot('reply', 30)
  assert.equal(active, 6)
  audio.setMuted(true)
  await Promise.resolve()
  assert.equal(active, 3)
  assert.equal(state, 'suspended')
  assert.ok(disconnected > 0 && cancelled > 0)
  assert.equal(voices.at(-1), 0)
  audio.setMuted(false)
  await Promise.resolve()
  assert.equal(state, 'running')
  audio.setVisible(false)
  await Promise.resolve()
  assert.equal(state, 'suspended')
  await audio.dispose()
  assert.equal(state, 'closed')
  assert.equal(active, 0)
})

test('idle and muted scenes create no audio context or background timer', async () => {
  let created = 0
  let scheduled = 0
  const states: SceneAudioState[] = []
  const audio = createSceneAudio({
    createContext: () => { created++; throw new Error('No context expected') },
    random: () => 0.5,
    schedule: () => { scheduled++; return 1 },
    cancel: () => {},
    onState: state => states.push(state),
    onVoice: () => {},
    onError: error => { throw error },
  })
  audio.setVisible(false)
  audio.setMuted(true)
  await audio.activate()
  await audio.dispose()
  assert.equal(created, 0)
  assert.equal(scheduled, 0)
  assert.equal(states.at(-1)?.muted, true)
})

test('an unsupported audio context reports unavailable without a silent failure', async () => {
  const failure = new Error('Audio context unsupported')
  const states: SceneAudioState[] = []
  const errors: unknown[] = []
  const audio = createSceneAudio({
    createContext: () => { throw failure },
    random: () => 0.5,
    schedule: () => 1,
    cancel: () => {},
    onState: state => states.push(state),
    onVoice: () => {},
    onError: error => errors.push(error),
  })
  await audio.activate()
  assert.equal(states.at(-1)?.status._tag, 'Unavailable')
  assert.equal(errors[0], failure)
  await audio.dispose()
})
