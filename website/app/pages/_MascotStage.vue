<script setup lang="ts">
import { computed, defineAsyncComponent, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from '#app'
import { defaultSceneAudioMix } from '#shared/scene-audio'
import type { SceneAudioMix, SceneAudioState } from '#shared/scene-audio'
import type { ConversationMood } from '#shared/conversation'
import type { SetName } from '@brundlefly/brand/shared/scene-set'
import { useEventListener, useIntervalFn, useLocalStorage, useMediaQuery, useTimeoutFn } from '@vueuse/core'
import { joinedByPath, pathForSet, setForPath } from '#shared/travel'
import { criticalSceneSeconds, phase, specimenCount } from '#shared/office-experiment'
import type { Creature, Experiment } from '#shared/office-experiment'
import { crashSeconds, criticalDarkAt, criticalSpurtAt } from '#shared/office-critical'
import { caveLines, countingLine, criticalLines, lineSeconds } from '#shared/office-script'
import type { ActionSound } from '#shared/action-sounds'
import { useOfficeExperiment } from '../composables/useOfficeExperiment'
import { usePartyTrack } from '../composables/usePartyTrack'
import type { Station } from '../office-stage'
import BackToRoom from './_BackToRoom.vue'
import OfficeCounter from './_OfficeCounter.vue'
import OverheadLine from './_OverheadLine.vue'
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

// The office experiment. Every visitor in the office shares one specimen counter, and the room goes critical for all of them at once.
// A visitor who came by the join code starts at the computer, in a lit room, with the sound off.
const joined = joinedByPath(route.path)
const office = useOfficeExperiment(() => wanted.value === 'office' || shown.value === 'office')
const { experiment } = office
const station = ref<Station>(joined ? 'computer' : 'room')
// On a phone held upright the computer's screen fills the page. The scene behind it then draws nothing, and his lines wait for the room.
const phone = useMediaQuery('(max-width: 640px) and (orientation: portrait)')
const covered = computed(() => phone.value && station.value === 'computer' && run.value !== null && shown.value === 'office' && !talking.value)
// The run whose critical scene took this visitor to the cave. The office is the plain office for them until the next run.
const left = ref<number>()
// The run this visitor saw while it counted. Its critical scene is theirs, also when they see the end of it late.
let counted: number | undefined
// A journey without the walk to the way out: the critical scene has made the picture dark already.
const cut = ref(false)
// The chamber spat snails, and some came to the cave with the visitor.
const snailed = ref(false)
// The celebration in the cave: the server time when the music's chorus hits, and its tempo. Every device dances from that moment. Only the projector has the music.
const party = ref<{ at: number, bpm: number } | null>(null)
const { start: endPartyLater, stop: keepParty } = useTimeoutFn(() => { party.value = null }, () => partyRemaining.value, { immediate: false })
const partyRemaining = ref(0)
// The experiment is the way to the cave. A visitor who has been through its critical scene can follow him there again from the office.
// The page reads the stored answer after it mounts, so its first picture matches the one the server drew.
const caveOpen = useLocalStorage('brundlefly-cave-open', false, { initOnMounted: true, onError: cause => console.warn('The local store is unavailable. The way to the cave stays closed after this visit.', cause) })
const run = computed(() => experiment.value && left.value !== experiment.value.run ? experiment.value : null)
// The scene is in its critical moment. He is busy, and the stations and the dialog wait.
const critical = computed(() => run.value !== null && run.value.criticalAt !== null)
function talk() {
  if (critical.value) return
  station.value = 'room'
  talking.value = true
}
// A fast thumb can miss a key. A tap beside the keys soon after a tap on them stays at the computer.
let lastTap = 0
function tap(kind: Creature) {
  lastTap = performance.now()
  office.tap(kind)
}
function look(to: Station) {
  if (critical.value || (to === 'room' && station.value === 'computer' && performance.now() - lastTap < 1500)) return
  station.value = to
}
useEventListener('keydown', (event: KeyboardEvent) => { if (event.key === 'Escape' && !talking.value) station.value = 'room' })

// What he says over his head. A line stays for a few seconds and opens no dialog.
const line = ref('')
const { start: holdLine, stop: dropLine } = useTimeoutFn(() => { line.value = '' }, () => lineSeconds(line.value) * 1000, { immediate: false })
function say(text: string) {
  line.value = text
  holdLine()
}
// He counts aloud at the first specimen and at each milestone. A state that arrives with a count already is no milestone.
watch(run, (now, before) => {
  if (now && now.criticalAt === null) counted = now.run
  if (!now || !before || now.run !== before.run || now.criticalAt !== null) return
  const text = countingLine(specimenCount(before), specimenCount(now), now.target)
  if (text && !talking.value) say(text)
})
// The critical scene, timed from the server's clock. His lines fall at their moments, and the cave follows the dark.
let spoken = 0
// The presenter's song, if this browser holds one. It fades in from the moment the chamber spits snails, and its chorus hits as the cave appears.
// A phone holds no song, so this does nothing there.
const song = usePartyTrack()
let sung = false
// A visitor who turns the sound off, and a presenter who starts a new run, both end the song.
watch(() => sound.value.muted, (muted) => { if (muted) song.stop(1) })
watch(() => experiment.value?.run, (now, before) => { if (before !== undefined && now !== undefined && now !== before) song.stop(1) })
const { pause: endScene, resume: playScene } = useIntervalFn(() => {
  const state = run.value
  if (!state || state.criticalAt === null) return endScene()
  const age = (office.clock() - state.criticalAt) / 1000
  for (; spoken < criticalLines.length && age >= criticalLines[spoken]!.at; spoken++) if (age < criticalLines[spoken]!.at + 2) say(criticalLines[spoken]!.text)
  if (age >= crashSeconds) station.value = 'room'
  if (!sung && age >= criticalSpurtAt && !sound.value.muted) { sung = true; song.play(criticalSceneSeconds - age) }
  if (age >= criticalDarkAt) leave(state)
}, 100, { immediate: false })
const caveTimers: ReturnType<typeof setTimeout>[] = []
// The run that sent this visitor to the cave, until they arrive there.
let finished: Experiment | undefined
function leave(state: Experiment) {
  endScene()
  left.value = state.run
  snailed.value = true
  // The cave appears as the scene ends, and the celebration runs from there. A visitor who comes after it finds a quiet cave.
  const hit = (state.criticalAt ?? office.clock()) + criticalSceneSeconds * 1000
  // The room gives the tempo and the length, so every device dances as one.
  const { bpm, playFor, fadeOut } = office.party.value
  partyRemaining.value = hit + (playFor + fadeOut) * 1000 - office.clock()
  keepParty()
  if (partyRemaining.value > 0) { party.value = { at: hit, bpm }; endPartyLater() }
  caveOpen.value = true
  cut.value = true
  wanted.value = 'lair'
  line.value = ''
  dropLine()
  // In the cave he speaks to the visitor who woke there.
  finished = state
}
watch(() => run.value?.criticalAt ?? null, (at) => {
  const state = run.value
  if (at === null || !state) return
  talking.value = false
  // A visitor at the computer stays there for a moment and sees its screen fail. Everyone else looks at the room at once.
  if (station.value !== 'computer') station.value = 'room'
  // The scene is over. A visitor who joined by the code, or who saw this run count and lost the connection at its end, goes straight to the cave.
  // Any other late visitor finds the plain office.
  if (phase(state, office.clock()) === 'Over') { if (joined || counted === state.run) leave(state); else left.value = state.run; return }
  spoken = 0
  sung = false
  playScene()
  // The chamber hums from the start of the scene. A visitor who comes in the middle of it hears no hum cut short.
  if ((office.clock() - at) / 1000 < 1) audio.value?.playAction('ChamberHum')
}, { immediate: true })
watch(shown, (set) => { if (set === 'lair') cut.value = false })
// He speaks once the visitor can see the cave.
function viewed(set: SetName) {
  const state = finished
  if (set !== 'lair' || !state) return
  finished = undefined
  for (const { at, text } of caveLines(state)) caveTimers.push(setTimeout(() => { if (shown.value === 'lair' && !talking.value) say(text) }, at * 1000))
}
onScopeDispose(() => caveTimers.forEach(clearTimeout))
// Each creature lands with its own small sound. Many land at once, so the sounds keep a short gap.
const landings: Record<Creature, ActionSound> = { snail: 'JarBubbles', beetle: 'KeyClick', fly: 'FlyBuzz', cricket: 'CricketChirp' }
let lastLanding = 0
function landed(kind: Creature) {
  if (performance.now() - lastLanding < 70) return
  lastLanding = performance.now()
  audio.value?.playAction(landings[kind])
}
</script>

<template>
  <main aria-label="Brundlefly" :data-found-dark="foundDark">
    <ClientOnly>
      <WorldScene :set="wanted" :paused="talking" :speaking="voice" :mood="mood" :thinking="thinking" :beat="beat" :reaction="reaction" :experiment="run" :station="station" :server-clock="office.clock" :connected="office.connected.value" :joined="joined" :cut="cut" :cave-snails="snailed" :party="party" :covered="covered"
        @talk="talk" @mix="mix = $event" @shown="arrive" @time="audio?.keepTime($event)" @entrance="foundDark = $event" @action="audio?.playAction($event)" @station="look" @landed="landed" @view="viewed" />
      <SceneAudio ref="audio" :quiet="joined" :set="shown" :talking="talking" :reply-count="replies" :reply-length="replyLength" :mix="mix" @state="sound = $event" @voice="voice = $event" />
      <template #fallback><SceneLoading /></template>
    </ClientOnly>
    <OfficeCounter v-if="run && shown === 'office'" :experiment="run" :connected="office.connected.value" :online="office.online.value" :shown="station === 'computer' && !talking" @tap="tap" @leave="station = 'room'" />
    <BackToRoom :shown="station === 'code' && !talking && !critical" @leave="station = 'room'" />
    <OverheadLine :text="talking || covered ? '' : line" />
    <SpeechDialog :open="talking" :place="shown" :found-dark="foundDark" :travelling="wanted !== shown" :muted="sound.muted" :sound-available="sound.status._tag !== 'Unavailable'" :cave-open="caveOpen" @close="talking = false; mood = 'neutral'" @reply="replyLength = $event.length; replies++" @reaction="mood = $event.mood; beat = $event.beat; reaction++" @pending="thinking = $event" @sound="audio?.toggle()" @travel="wanted = $event" />
  </main>
</template>
