<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import type { SceneAudioState } from '#shared/scene-audio'
import WorldScene from './_WorldScene.client.vue'
import SpeechDialog from './_SpeechDialog.vue'
import SceneAudio from './_SceneAudio.vue'
import SceneLoading from './_SceneLoading.vue'
const talking = ref(false)
const replies = ref(0)
const replyLength = ref(120)
const voice = ref(0)
const audio = shallowRef<InstanceType<typeof SceneAudio>>()
const sound = ref<SceneAudioState>({ muted: false, status: { _tag: 'Idle' } })
</script>

<template>
  <main aria-label="Brundlefly">
    <ClientOnly>
      <WorldScene :paused="talking" :speaking="voice" @talk="talking = true" />
      <SceneAudio ref="audio" :talking="talking" :reply-count="replies" :reply-length="replyLength" @state="sound = $event" @voice="voice = $event" />
      <template #fallback><SceneLoading /></template>
    </ClientOnly>
    <SpeechDialog :open="talking" :muted="sound.muted" :sound-available="sound.status._tag !== 'Unavailable'" @close="talking = false" @reply="replyLength = $event.length; replies++" @sound="audio?.toggle()" />
  </main>
</template>
