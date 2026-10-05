<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { defaultSceneAudioMix } from '#shared/scene-audio'
import type { SceneAudioMix, SceneAudioState } from '#shared/scene-audio'
import type { ConversationMood } from '#shared/conversation'
import WorldScene from './_WorldScene.client.vue'
import SpeechDialog from './_SpeechDialog.vue'
import SceneAudio from './_SceneAudio.vue'
import SceneLoading from './_SceneLoading.vue'
const talking = ref(false)
const replies = ref(0)
const replyLength = ref(120)
const voice = ref(0)
const mood = ref<ConversationMood>('neutral')
const thinking = ref(false)
const beat = ref('')
const reaction = ref(0)
const audio = shallowRef<InstanceType<typeof SceneAudio>>()
const sound = ref<SceneAudioState>({ muted: false, status: { _tag: 'Idle' } })
const mix = ref<SceneAudioMix>({ ...defaultSceneAudioMix })
</script>

<template>
  <main aria-label="Brundlefly">
    <ClientOnly>
      <WorldScene :paused="talking" :speaking="voice" :mood="mood" :thinking="thinking" :beat="beat" :reaction="reaction" @talk="talking = true" @mix="mix = $event" />
      <SceneAudio ref="audio" :talking="talking" :reply-count="replies" :reply-length="replyLength" :mix="mix" @state="sound = $event" @voice="voice = $event" />
      <template #fallback><SceneLoading /></template>
    </ClientOnly>
    <SpeechDialog :open="talking" :muted="sound.muted" :sound-available="sound.status._tag !== 'Unavailable'" @close="talking = false; mood = 'neutral'" @reply="replyLength = $event.length; replies++" @reaction="mood = $event.mood; beat = $event.beat; reaction++" @pending="thinking = $event" @sound="audio?.toggle()" />
  </main>
</template>
