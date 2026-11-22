<script setup lang="ts">
import { defineAsyncComponent, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from '#app'
import { defaultSceneAudioMix } from '#shared/scene-audio'
import type { SceneAudioMix, SceneAudioState } from '#shared/scene-audio'
import type { ConversationMood } from '#shared/conversation'
import type { SetName } from '@brundlefly/brand/shared/scene-set'
import { pathForSet, setForPath } from '#shared/travel'
import OfficeExperiment from './_OfficeExperiment.vue'
import { useOfficeExperiment } from '../composables/useOfficeExperiment'
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
// Whether this visit found the office dark, with him at the switch. His greeting then speaks of the lights.
const foundDark = ref(false)
const mode = () => 'rehearse' in route.query ? 'rehearse' : 'present' in route.query ? 'present' : 'guest'
const office = useOfficeExperiment(() => wanted.value === 'office', mode)
const exploring = ref(false)
const { room, station } = office
watch(() => room.value?.id, id => { exploring.value = false; if (id) talking.value = false })
let lastShot = 0
watch(() => room.value?.drops.at(-1), (drop, previous) => {
  if (!office.host.value || !drop || drop === previous || office.clock() - drop.at > 700 || performance.now() - lastShot < 60) return
  lastShot = performance.now()
  audio.value?.playAction(({ snail: 'JarBubbles', beetle: 'KeyClick', fly: 'FlyBuzz', cricket: 'CricketChirp' } as const)[drop.kind])
})
function wake() {
  talking.value = false
  wanted.value = 'lair'
  if (document.querySelector('.world-scene[data-renderer="Fallback"]')) arrive('lair', 'arrived')
}
function reset() { wanted.value = 'office' }
const talk = () => { if (!room.value || exploring.value) talking.value = true }
</script>

<template>
  <main aria-label="Brundlefly" :data-found-dark="foundDark">
    <ClientOnly>
      <WorldScene :experiment="exploring ? null : room" :station="station" :office-clock="office.clock" @station="station = $event" :set="wanted" :paused="talking" :speaking="voice" :mood="mood" :thinking="thinking" :beat="beat" :reaction="reaction" @talk="talk" @mix="mix = $event" @shown="arrive" @time="audio?.keepTime($event)" @entrance="foundDark = $event" @action="audio?.playAction($event)" />
      <SceneAudio ref="audio" :audience="!!room && mode() === 'guest' && !exploring" :set="shown" :talking="talking" :reply-count="replies" :reply-length="replyLength" :mix="mix" @state="sound = $event" @voice="voice = $event" />
      <template #fallback><SceneLoading /></template>
    </ClientOnly>
    <OfficeExperiment v-if="!exploring" :office="office" :awake-in-cave="shown === 'lair'" :presenter="mode() !== 'guest' && (wanted === 'office' || !!room)" :muted="sound.muted"
      @sound="audio?.toggle()" @wake="wake" @leave="exploring = true" @reset="reset" />
    <SpeechDialog :open="talking" :place="shown" :found-dark="foundDark" :travelling="wanted !== shown" :muted="sound.muted" :sound-available="sound.status._tag !== 'Unavailable'" @close="talking = false; mood = 'neutral'" @reply="replyLength = $event.length; replies++" @reaction="mood = $event.mood; beat = $event.beat; reaction++" @pending="thinking = $event" @sound="audio?.toggle()" @travel="wanted = $event" />
  </main>
</template>
