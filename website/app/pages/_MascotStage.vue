<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from '#app'
import { defaultSceneAudioMix } from '#shared/scene-audio'
import type { SceneAudioMix, SceneAudioState } from '#shared/scene-audio'
import type { ConversationMood } from '#shared/conversation'
import type { SetName } from '@brundlefly/brand/shared/scene-set'
import { useEventListener, useIntervalFn, useLocalStorage, useMediaQuery, useTimeoutFn } from '@vueuse/core'
import { pathForSet } from '#shared/travel'
import type { SceneVisit } from '#shared/travel'
import { criticalSceneSeconds, phase, specimenCount } from '#shared/office-experiment'
import type { Creature, Experiment } from '#shared/office-experiment'
import { criticalDarkAt } from '#shared/office-critical'
import { caveLines, countingLine, criticalLines, leadingCreature, leadShiftLine, lineSeconds, showGreetingLine } from '#shared/office-script'
import type { Spoken } from '#shared/office-script'
import { clickerAction, readClickerKey } from '#shared/show-deck'
import type { ActionSound } from '#shared/action-sounds'
import { useOfficeExperiment } from '../composables/useOfficeExperiment'
import { usePartyTrack } from '../composables/usePartyTrack'
import type { Station } from '../office-stage'
import BackToRoom from './_BackToRoom.vue'
import OfficeCounter from './_OfficeCounter.vue'
import OverheadLine from './_OverheadLine.vue'
import ShowSlides from './_ShowSlides.vue'
import SpeechDialog from './_SpeechDialog.vue'
import SceneAudio from './_SceneAudio.vue'
import SceneLoading from './_SceneLoading.vue'
// The mascot, his sound, and his conversation. The stage lives above the pages, so a journey between the sets keeps one scene and one conversation.
// A public journey changes the address. An experiment journey stays on its entrance page.
const { visit } = defineProps<{ visit: SceneVisit }>()
const route = useRoute()
const router = useRouter()
const presenting = visit._tag !== 'Public'
const joined = visit._tag === 'Attendee'
const wanted = ref<SetName>(visit._tag === 'Public' ? visit.set : 'office')
const shown = ref<SetName>(wanted.value)
watch(() => visit, (next) => {
  if (next._tag === 'Public') wanted.value = next.set
})
// The address follows the set after the scene has changed it. A set whose artwork did not load is given up, and the address stays.
const arrive = (set: SetName, outcome: 'arrived' | 'stayed') => {
  shown.value = set
  if (outcome === 'stayed') wanted.value = set
  if (visit._tag === 'Public' && visit.set !== set) void router.push({ path: pathForSet(set), query: route.query })
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
const office = useOfficeExperiment(() => presenting && (wanted.value === 'office' || shown.value === 'office'))
const { experiment } = office
const station = ref<Station>(joined ? 'computer' : 'room')
// `/projector` opens on the five PenGPT notebook slides over the preloaded 3D office so one presenter clicker runs the whole act.
// Pass `?office` (or `?tune`) to open straight on the 3D office without slides.
// Static prerendering has no query string, so `slide` opens on client mount to avoid an SSR hydration mismatch.
const tuning = computed(() => presenting && !joined && ('tune' in route.query || (import.meta.client && new URLSearchParams(window.location.search).has('tune'))))
const skipSlides = computed(() => tuning.value || 'office' in route.query || (import.meta.client && new URLSearchParams(window.location.search).has('office')))
const showMode = computed(() => presenting && !joined && !skipSlides.value)
const slide = ref<number | null>(null)
const shownComputer = ref(false)
const ended = ref(false)
onMounted(() => {
  if (showMode.value && !critical.value) slide.value = 0
})
watch(station, (next, prev) => {
  if (next === 'computer') shownComputer.value = true
  else if (prev === 'code' && next === 'room') shownComputer.value = false
})
function greetShow() {
  if (presenting && !joined && !talking.value && !critical.value && slide.value === null) say(showGreetingLine)
}
// On a phone held upright the computer's screen fills the page. The scene behind it then draws nothing, and his lines wait for the room.
const phone = useMediaQuery('(max-width: 640px) and (orientation: portrait)')
const covered = computed(() => (phone.value && station.value === 'computer' && run.value !== null && shown.value === 'office' && !talking.value) || slide.value !== null)
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
const caveOpen = presenting
  ? useLocalStorage('brundlefly-cave-open', false, { initOnMounted: true, onError: cause => console.warn('The local store is unavailable. The way to the cave stays closed after this visit.', cause) })
  : ref(true)
const run = computed(() => experiment.value && left.value !== experiment.value.run ? experiment.value : null)
// The scene is in its critical moment. He is busy, and the stations and the dialog wait.
const critical = computed(() => run.value !== null && run.value.criticalAt !== null)
// True for `/join` phones once the presenter has triggered the cave reveal and its chorus has landed.
const phoneRevealed = ref(false)
const { pause: stopRevealWatch, resume: watchReveal } = useIntervalFn(() => {
  const state = run.value
  if (!state || state.revealAt === null) { phoneRevealed.value = false; return stopRevealWatch() }
  if (office.clock() >= state.revealAt) { phoneRevealed.value = true; stopRevealWatch() }
}, 250, { immediate: false })
watch(() => [joined, run.value?.run, run.value?.revealAt] as const, ([isJoined, , revealAt]) => {
  if (!isJoined || revealAt === null || revealAt === undefined) { phoneRevealed.value = false; stopRevealWatch(); return }
  if (office.clock() >= revealAt) { phoneRevealed.value = true; stopRevealWatch() }
  else { phoneRevealed.value = false; watchReveal() }
}, { immediate: true })
function enterCaveFromPhone() {
  const state = run.value
  if (!state || state.revealAt === null) return
  station.value = 'room'
  leave(state)
}
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
// Leaving the last slide fades out into the 3D office over 0.9s; guard Next briefly so an eager click doesn't skip the room reveal.
let slideFadeUntil = 0
if (presenting) {
  useEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !talking.value) { station.value = 'room'; return }
    if (joined || talking.value || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
    if (tuning.value && station.value === 'code' && event.key.startsWith('Arrow')) return
    const target = event.target
    // Do not exclude `button`: the 3D scene's full-viewport interaction layer is a `<button>` that holds focus after clicking to unlock audio.
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), .scene-controls, dialog'))) return
    const key = readClickerKey(event.key)
    if (!key) return
    if (key === 'Next' && slide.value === null && performance.now() < slideFadeUntil) { event.preventDefault(); return }
    const state = run.value
    const criticalAge = state && state.criticalAt !== null ? (office.clock() - state.criticalAt) / 1000 : undefined
    const revealAt = experiment.value?.revealAt ?? null
    const revealedAge = revealAt !== null ? (office.clock() - revealAt) / 1000 : undefined
    const action = clickerAction(key, { show: showMode.value, slide: slide.value, station: station.value, set: wanted.value, ended: ended.value, shownComputer: shownComputer.value, experiment: state, criticalAge, revealedAge })
    if (action._tag === 'None') return
    event.preventDefault()
    if (action._tag === 'Slide') {
      if (slide.value !== null && action.index === null) slideFadeUntil = performance.now() + 1000
      if (action.index !== null) shownComputer.value = false
      slide.value = action.index
    }
    else if (action._tag === 'Station') station.value = action.station
    else if (action._tag === 'End') endShow()
    else office.reveal()
  }, { capture: true })
}

// What he says over his head. A line stays for a few seconds and opens no dialog.
const line = ref('')
const { start: holdLine, stop: dropLine } = useTimeoutFn(() => { line.value = '' }, () => lineSeconds(line.value) * 1000, { immediate: false })
// He never speaks with still hands: each line names a gesture, and the scene performs it as the line appears.
function say({ text, beat: gesture }: Spoken) {
  if (ended.value || slide.value !== null) return
  line.value = text
  holdLine()
  audio.value?.speak(text.length)
  if (!gesture) return
  beat.value = gesture
  reaction.value++
}
// He counts aloud at the first specimen, at each milestone, and when a new creature overtakes the lead mid-run.
let lastLeadShift = 0
let leadShiftRun = -1
let lastPair: readonly [Creature, Creature] | undefined
let pingPongCount = 0
const leadHits: Record<Creature, number> = { snail: 0, beetle: 0, fly: 0, cricket: 0 }
watch(run, (now, before) => {
  if (now && now.criticalAt === null) counted = now.run
  if (now && now.run !== leadShiftRun) {
    leadShiftRun = now.run
    lastLeadShift = 0
    lastPair = undefined
    pingPongCount = 0
    leadHits.snail = leadHits.beetle = leadHits.fly = leadHits.cricket = 0
  }
  if (!now || !before || now.run !== before.run || now.criticalAt !== null) return
  const beforeCount = specimenCount(before)
  const afterCount = specimenCount(now)
  const prevLead = leadingCreature(before)
  const lead = leadingCreature(now)
  const spoken = countingLine(beforeCount, afterCount, now.target, lead)
  if (spoken) { if (!talking.value) say(spoken); return }
  if (beforeCount > 0 && prevLead !== lead && performance.now() - lastLeadShift >= 6500) {
    const pingPong = lastPair !== undefined && lastPair[0] === lead && lastPair[1] === prevLead
    const occurrence = pingPong ? pingPongCount : leadHits[lead]
    const shifted = leadShiftLine(prevLead, lead, afterCount / Math.max(1, now.target), occurrence, pingPong)
    if (shifted && !talking.value) {
      lastLeadShift = performance.now()
      lastPair = [prevLead, lead]
      if (pingPong) pingPongCount++
      else leadHits[lead]++
      say(shifted)
    }
  }
})
// The critical scene, timed from the server's clock. His lines fall at their moments, and the cave follows the dark.
let spoken = 0
// The presenter's song, if this browser holds one. It fades in under the critical scene, and its chorus hits as the cave appears.
// The song is asked for as the scene starts, so a fade as long as the scene can run in full. The default fade is that long.
// A phone holds no song, so this does nothing there.
const song = presenting ? usePartyTrack() : undefined
const songActive = computed(() => song?.status.value === 'Waiting' || song?.status.value === 'Playing')
const sceneAudioSuspended = computed(() => songActive.value || slide.value !== null || ended.value)
let sung = false
function endShow() {
  if (ended.value) return
  ended.value = true
  song?.stop(2.5)
  party.value = null
  keepParty()
  caveTimers.splice(0).forEach(clearTimeout)
  line.value = ''
  dropLine()
  talking.value = false
}
// A visitor who turns the sound off, and a presenter who starts a new run, both end the song.
watch(() => sound.value.muted, (muted) => { if (muted) song?.stop(1) })
watch(() => experiment.value?.run, (now, before) => {
  if (before === undefined || now === undefined || now === before) return
  ended.value = false
  song?.stop(1)
  if (!joined) {
    if (shown.value === 'lair') {
      wanted.value = 'office'
      snailed.value = false
      party.value = null
      keepParty()
    }
    station.value = 'room'
    shownComputer.value = false
    if (showMode.value) slide.value = 0
  }
  if (joined) station.value = 'computer'
})
let lastHoldPulse = 0
const { pause: endScene, resume: playScene } = useIntervalFn(() => {
  const state = run.value
  if (!state || state.criticalAt === null) return endScene()
  const now = office.clock()
  const age = (now - state.criticalAt) / 1000
  for (; spoken < criticalLines.length && age >= criticalLines[spoken]!.at; spoken++) if (age < criticalLines[spoken]!.at + 2) say(criticalLines[spoken]!)
  if (state.revealAt !== null) {
    if (!sung && !sound.value.muted) { sung = true; song?.play((state.revealAt - now) / 1000, true) }
    if (age >= criticalDarkAt) leave(state)
    return
  }
  // Hold in pitch black after `criticalDarkAt` with a gentle rising hum pulse until the presenter triggers reveal.
  if (age >= criticalDarkAt && !sound.value.muted && now - lastHoldPulse >= 1200) {
    lastHoldPulse = now
    audio.value?.playAction('HoldPulse')
  }
}, 100, { immediate: false })
watch(() => run.value?.revealAt ?? null, (revealAt) => {
  const state = run.value
  if (joined || revealAt === null || !state || state.criticalAt === null) return
  const now = office.clock()
  if (!sung && !sound.value.muted) { sung = true; song?.play((revealAt - now) / 1000, true) }
  if ((now - state.criticalAt) / 1000 >= criticalDarkAt) leave(state)
})
const caveTimers: ReturnType<typeof setTimeout>[] = []
// The run that sent this visitor to the cave, until they arrive there.
let finished: Experiment | undefined
function leave(state: Experiment) {
  endScene()
  left.value = state.run
  snailed.value = true
  // The cave appears when `revealAt` arrives (or at the end of the critical scene if already past), and the celebration runs from there.
  const hit = state.revealAt ?? ((state.criticalAt ?? office.clock()) + criticalSceneSeconds * 1000)
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
  slide.value = null
  // Phones that came by `/join` stay locked on the computer's overload alarm so eyes stay on the room and phones never spoil the reveal.
  if (joined) { station.value = 'computer'; return }
  station.value = 'room'
  // The scene is over. A projector that joins after the reveal goes straight to the cave.
  if (phase(state, office.clock()) === 'Over') { if (counted === state.run) leave(state); else left.value = state.run; return }
  spoken = 0
  sung = false
  lastHoldPulse = 0
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
  for (const spoken of caveLines(state)) caveTimers.push(setTimeout(() => { if (shown.value === 'lair' && !talking.value) say(spoken) }, spoken.at * 1000))
}
onScopeDispose(() => caveTimers.forEach(clearTimeout))
// Each creature lands with its own small sound. Many land at once, so the sounds keep a short gap.
const landings: Record<Creature, ActionSound> = { snail: 'JarBubbles', beetle: 'KeyClick', fly: 'FlyBuzz', cricket: 'CricketChirp' }
let lastLanding = 0
function landed(kind: Creature) {
  if (ended.value || slide.value !== null) return
  if (performance.now() - lastLanding < 70) return
  lastLanding = performance.now()
  audio.value?.playAction(landings[kind])
}
</script>

<template>
  <main aria-label="Brundlefly" :data-found-dark="foundDark">
    <ClientOnly>
      <WorldScene :set="wanted" :paused="talking" :speaking="voice" :mood="mood" :thinking="thinking" :beat="beat" :reaction="reaction" :presenting="presenting" :experiment="run" :station="station" :server-clock="office.clock" :connected="office.connected.value" :joined="joined" :cut="cut" :cave-snails="snailed" :party="party" :covered="covered" :hold-entrance="showMode && slide !== null"
        @talk="talk" @mix="mix = $event" @shown="arrive" @time="audio?.keepTime($event)" @entrance="foundDark = $event" @greet="greetShow" @action="audio?.playAction($event)" @station="look" @landed="landed" @view="viewed" />
      <SceneAudio ref="audio" :quiet="joined" :suspended="sceneAudioSuspended" :set="shown" :talking="talking" :reply-count="replies" :reply-length="replyLength" :mix="mix" @state="sound = $event" @voice="voice = $event" />
      <template #fallback><SceneLoading /></template>
    </ClientOnly>
    <template v-if="presenting">
      <ClientOnly>
        <Transition name="slides-fade">
          <ShowSlides v-if="slide !== null" :slide="slide" />
        </Transition>
      </ClientOnly>
      <OfficeCounter v-if="run && shown === 'office'" :experiment="run" :connected="office.connected.value" :online="office.online.value" :shown="station === 'computer' && !talking && slide === null" :revealed="phoneRevealed" @tap="tap" @leave="station = 'room'" @enter="enterCaveFromPhone" />
      <BackToRoom :shown="station === 'code' && !talking && !critical && slide === null" @leave="station = 'room'" />
      <OverheadLine :text="talking || covered || ended ? '' : line" />
      <div v-if="!joined" class="show-curtain" :class="{ active: ended }" aria-hidden="true" />
    </template>
    <SpeechDialog :open="talking" :place="shown" :found-dark="foundDark" :travelling="wanted !== shown" :muted="sound.muted" :sound-available="sound.status._tag !== 'Unavailable'" :cave-open="caveOpen" @close="talking = false; mood = 'neutral'" @reply="replyLength = $event.length; replies++" @reaction="mood = $event.mood; beat = $event.beat; reaction++" @pending="thinking = $event" @sound="audio?.toggle()" @travel="wanted = $event" />
  </main>
</template>

<style scoped>
.slides-fade-leave-active { transition: opacity .9s ease-in-out; pointer-events: none; }
.slides-fade-leave-to { opacity: 0; }
.slides-fade-enter-active { transition: opacity .35s ease-out; }
.slides-fade-enter-from { opacity: 0; }
.show-curtain { position: fixed; inset: 0; z-index: 50; background: #000; opacity: 0; pointer-events: none; transition: opacity 2.5s ease-in-out; }
.show-curtain.active { opacity: 1; pointer-events: auto; }
</style>
