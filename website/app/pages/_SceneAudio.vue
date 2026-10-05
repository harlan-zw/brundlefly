<script setup lang="ts">
import { onMounted, onScopeDispose, shallowRef, watch } from 'vue'
import { useDocumentVisibility, useEventListener } from '@vueuse/core'
import { createSceneAudio, defaultSceneAudioMix } from '#shared/scene-audio'
import type { SceneAudioMix, SceneAudioState } from '#shared/scene-audio'

const { talking, replyCount, replyLength = 120, mix = defaultSceneAudioMix } = defineProps<{ talking: boolean, replyCount: number, replyLength?: number, mix?: SceneAudioMix }>()
const emit = defineEmits<{ state: [value: SceneAudioState], voice: [envelope: number] }>()
const state = shallowRef<SceneAudioState>({ muted: false, status: { _tag: 'Idle' } })
const visibility = useDocumentVisibility()
let audio: ReturnType<typeof createSceneAudio> | undefined
let pendingVoice: 'open' | 'reply' | undefined
let mounted = false

function requestVoice(kind: 'open' | 'reply') {
  if (state.value.muted) return
  if (state.value.status._tag === 'Running') audio?.playMascot(kind, replyLength)
  else pendingVoice = kind
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
  else pendingVoice = undefined
})
watch(() => replyCount, (value, previous) => { if (talking && value > previous) requestVoice('reply') })
watch(() => mix, value => audio?.setMix(value), { deep: true })
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
        audio?.playMascot(kind, replyLength)
      }
    },
    onVoice: envelope => emit('voice', envelope),
    onError: error => console.error('Brundlefly scene audio failed.', error),
  })
  audio.setVisible(visibility.value === 'visible')
  audio.setMix(mix)
  audio.setTalking(talking)
  mounted = true
})
onScopeDispose(() => {
  mounted = false
  pendingVoice = undefined
  emit('voice', 0)
  void audio?.dispose().catch(error => console.error('Brundlefly scene audio cleanup failed.', error))
})
defineExpose({ toggle })
</script>

<template />
