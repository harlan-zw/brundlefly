<script setup lang="ts">
import { onMounted, onScopeDispose, shallowRef, watch } from 'vue'
import { useDocumentVisibility, useEventListener, useIntervalFn } from '@vueuse/core'
import { createSceneAudio, createVoicePhrase, defaultSceneAudioMix, phraseVoiceEnvelope } from '#shared/scene-audio'
import type { SceneAudioMix, SceneAudioState } from '#shared/scene-audio'
import { ambienceForSet } from '#shared/set-ambience'
import type { ActionSound } from '#shared/action-sounds'
import type { SetName } from '@brundlefly/brand/shared/scene-set'

// `set` is the set that stands. The sound follows it: each set names its ambience, and a change of set is a cross-fade.
const { quiet = false, talking, replyCount, replyLength = 120, mix = defaultSceneAudioMix, set = 'lair' } = defineProps<{ quiet?: boolean, talking: boolean, replyCount: number, replyLength?: number, mix?: SceneAudioMix, set?: SetName }>()
const emit = defineEmits<{ state: [value: SceneAudioState], voice: [envelope: number] }>()
const state = shallowRef<SceneAudioState>({ muted: false, status: { _tag: 'Idle' } })
const visibility = useDocumentVisibility()
let audio: ReturnType<typeof createSceneAudio> | undefined
let pendingVoice: 'open' | 'reply' | undefined
let mounted = false

// A line with no sound still moves his mouth. The voice's own syllables run on a wall clock, so one source drives the face at a time.
// The mouth level updates every 50 ms, as the audible voice does. Each update redraws the scene, so a faster clock would draw it twice a frame.
let mime: { started: number, duration: number, envelope: (elapsed: number) => number } | undefined
const { pause: restMouth, resume: moveMouth } = useIntervalFn(() => {
  if (!mime) { restMouth(); return }
  const elapsed = (performance.now() - mime.started) / 1000
  if (elapsed < mime.duration) { emit('voice', mime.envelope(elapsed)); return }
  stopMime()
}, 50, { immediate: false })
function stopMime() {
  if (!mime) return
  mime = undefined
  restMouth()
  emit('voice', 0)
}
function startMime(kind: 'open' | 'reply') {
  const phrase = createVoicePhrase(kind, replyLength, Math.random)
  mime = { started: performance.now(), duration: phrase.duration, envelope: elapsed => phraseVoiceEnvelope(elapsed, 0, phrase.syllables) }
  moveMouth()
}
function requestVoice(kind: 'open' | 'reply') {
  stopMime()
  if (!state.value.muted && state.value.status._tag === 'Running') { audio?.playMascot(kind, replyLength); return }
  // Sound that is off, or not yet allowed by the browser, leaves the line silent. Sound that starts later takes over.
  if (!state.value.muted) pendingVoice = kind
  startMime(kind)
}
function toggle() {
  if (!audio) return
  audio.setMuted(!state.value.muted)
  if (!state.value.muted) void audio.activate()
}
function typingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')))
}
function gesture(event: PointerEvent | KeyboardEvent) {
  if (!event.isTrusted || !mounted) return
  if (event instanceof KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) return
    if (event.key.toLowerCase() === 'm' && !typingTarget(event.target)) {
      event.preventDefault()
      toggle()
      return
    }
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(event.key)) return
  }
  if (!state.value.muted && state.value.status._tag !== 'Running' && state.value.status._tag !== 'Unavailable') void audio?.activate()
}
useEventListener('pointerdown', gesture, { capture: true })
useEventListener('keydown', gesture, { capture: true })
watch(visibility, value => audio?.setVisible(value === 'visible'))
watch(() => talking, value => {
  audio?.setTalking(value)
  if (value) requestVoice('open')
  else { pendingVoice = undefined; stopMime() }
})
watch(() => replyCount, (value, previous) => { if (talking && value > previous) requestVoice('reply') })
watch(() => mix, value => audio?.setMix(value), { deep: true })
watch(() => set, value => audio?.setAmbience(ambienceForSet(value)))
onMounted(() => {
  audio = createSceneAudio({
    createContext: () => new AudioContext({ latencyHint: 'interactive' }),
    random: Math.random,
    schedule: (callback, delay) => window.setTimeout(callback, delay),
    cancel: timer => window.clearTimeout(timer),
    onState: value => {
      state.value = value
      emit('state', value)
      if (value.muted || value.status._tag === 'Suspended' || value.status._tag === 'Unavailable') pendingVoice = undefined
      if (value.status._tag === 'Running' && pendingVoice) {
        const kind = pendingVoice
        pendingVoice = undefined
        stopMime()
        audio?.playMascot(kind, replyLength)
      }
    },
    onVoice: (envelope) => { if (!mime) emit('voice', envelope) },
    onError: error => console.error('Brundlefly scene audio failed.', error),
  })
  // A phone that joined the office experiment in a room of people starts silent. The visitor can still turn the sound on.
  if (quiet) audio.setMuted(true)
  audio.setVisible(visibility.value === 'visible')
  audio.setMix(mix)
  audio.setAmbience(ambienceForSet(set))
  audio.setTalking(talking)
  mounted = true
})
onScopeDispose(() => {
  mounted = false
  pendingVoice = undefined
  mime = undefined
  emit('voice', 0)
  void audio?.dispose().catch(error => console.error('Brundlefly scene audio cleanup failed.', error))
})
// `keepTime` takes the scene's time, so the office tube buzzes when its light flickers.
// `playAction` plays a short sound for something he does: the scene asks for the switch and the strike of the office tubes.
defineExpose({ toggle, keepTime: (seconds: number) => audio?.setSceneTime(seconds), playAction: (action: ActionSound) => audio?.playAction(action) })
</script>

<template />
