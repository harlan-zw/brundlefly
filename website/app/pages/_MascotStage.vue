<script setup lang="ts">
import { defineAsyncComponent, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from '#app'
import { defaultSceneAudioMix } from '#shared/scene-audio'
import type { SceneAudioMix, SceneAudioState } from '#shared/scene-audio'
import type { ConversationMood } from '#shared/conversation'
import type { SetName } from '@brundlefly/brand/shared/scene-set'
import { pathForSet, setForPath } from '#shared/travel'
import SpeechDialog from './_SpeechDialog.vue'
import SceneAudio from './_SceneAudio.vue'
import SceneLoading from './_SceneLoading.vue'
// The mascot, his sound, and his conversation. The stage lives above the pages, so a journey between the sets keeps one scene and one conversation.
// The address names the set the visitor wants. The scene travels there and reports the set that stands.
const route = useRoute()
const router = useRouter()
const wanted = ref<SetName>(setForPath(route.path) ?? 'lair')
const shown = ref<SetName>(wanted.value)
// Back and forward change the address, and he follows.
watch(() => route.path, (path) => {
  const place = setForPath(path)
  if (place) wanted.value = place
})
// The address follows the set after the scene has changed it. A set whose artwork did not load is given up, and the address stays.
const arrive = (set: SetName, outcome: 'arrived' | 'stayed') => {
  shown.value = set
  if (outcome === 'stayed') wanted.value = set
  if (setForPath(route.path) !== set) void router.push({ path: pathForSet(set), query: route.query })
}
const WorldScene = defineAsyncComponent(() => import('./_WorldScene.client.vue'))
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
// Whether this visit found the office dark, with him at the switch. A later change chooses his greeting by it.
const foundDark = ref(false)
</script>

<template>
  <main aria-label="Brundlefly" :data-found-dark="foundDark">
    <ClientOnly>
      <WorldScene :set="wanted" :paused="talking" :speaking="voice" :mood="mood" :thinking="thinking" :beat="beat" :reaction="reaction" @talk="talking = true" @mix="mix = $event" @shown="arrive" @time="audio?.keepTime($event)" @entrance="foundDark = $event" @action="audio?.playAction($event)" />
      <SceneAudio ref="audio" :set="shown" :talking="talking" :reply-count="replies" :reply-length="replyLength" :mix="mix" @state="sound = $event" @voice="voice = $event" />
      <template #fallback><SceneLoading /></template>
    </ClientOnly>
    <SpeechDialog :open="talking" :place="shown" :travelling="wanted !== shown" :muted="sound.muted" :sound-available="sound.status._tag !== 'Unavailable'" @close="talking = false; mood = 'neutral'" @reply="replyLength = $event.length; replies++" @reaction="mood = $event.mood; beat = $event.beat; reaction++" @pending="thinking = $event" @sound="audio?.toggle()" @travel="wanted = $event" />
  </main>
</template>
