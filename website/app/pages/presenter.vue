<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { useIntervalFn, useTimeoutFn, useTimestamp } from '@vueuse/core'
import { useHead } from '#imports'
import { creatures, criticalSceneSeconds, phase, revealSwellSeconds, specimenCount, targetLimits } from '#shared/office-experiment'
import type { Phase } from '#shared/office-experiment'
import { formatClock, parseClock, partyFileBytes, partyLimits, tapRestartMs, tapTempo } from '#shared/party-track'
import type { PartyTrack } from '#shared/party-track'
import { useOfficeExperiment } from '../composables/useOfficeExperiment'
import { usePartyTrack } from '../composables/usePartyTrack'
import type { PartyFailure, PartyStatus } from '../composables/usePartyTrack'
import { useShowPhotos } from '../composables/useShowPhotos'
import type { ShowPhotoSlot } from '../composables/useShowPhotos'

// The presenter's control panel. It watches the room, so the room does not count it as a visitor.
useHead({
  title: 'Presenter | Brundlefly',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }, { property: 'og:url', content: 'https://brundlefly.dev/presenter' }],
  link: [{ rel: 'canonical', href: 'https://brundlefly.dev/presenter' }],
})

const { experiment, connected, online, clock, reset, setTarget, goCritical, reveal, setParty } = useOfficeExperiment(() => true, 'watcher')

// Server time, read again every half second. Then `Critical` turns to `Over` without a new message.
const now = shallowRef(clock())
useIntervalFn(() => { now.value = clock() }, 500)

// The first connection says "Connecting". A later loss says "Reconnecting".
const wasOnline = ref(false)
watch(online, (value) => { if (value) wasOnline.value = true })
const connection = computed(() => online.value ? 'Connected' : wasOnline.value ? 'Reconnecting…' : 'Connecting…')

// The numbers are live only while the connection is open and the server has sent a state.
const live = computed(() => online.value && experiment.value !== null)
const locked = computed(() => experiment.value !== null && experiment.value.criticalAt !== null)
const canReveal = computed(() => live.value && experiment.value !== null && experiment.value.criticalAt !== null && experiment.value.revealAt === null)
const readout = computed(() => {
  const state = experiment.value
  if (!state) return undefined
  const count = specimenCount(state)
  return { run: state.run, tally: state.tally, target: state.target, count, phase: phase(state, now.value), progress: Math.min(1, count / Math.max(1, state.target)) }
})

const phaseNotes: Record<Phase, string> = {
  Quiet: 'No specimens yet.',
  Counting: 'Visitors add specimens.',
  Critical: 'The critical scene plays for the room.',
  Holding: 'The room is dark. Reveal the cave when ready.',
  Over: 'The run is over. Reset the experiment to start a new run.',
}
const digits = new Intl.NumberFormat('en')

// A guarded action needs two selections. The first arms it. The second runs it, if it comes within a few seconds.
type Guarded = 'reset' | 'critical'
const run: Record<Guarded, () => void> = { reset, critical: goCritical }
const armed = shallowRef<{ action: Guarded, at: number } | null>(null)
const { start: holdArm, stop: stopArm } = useTimeoutFn(() => { armed.value = null }, 4000, { immediate: false })
function disarm() {
  stopArm()
  armed.value = null
}
function press(action: Guarded) {
  const at = Date.now()
  if (armed.value?.action !== action) {
    armed.value = { action, at }
    holdArm()
    return
  }
  // A double click sends its second click in under 400 ms. That click does not confirm.
  if (at - armed.value.at < 400) return
  disarm()
  run[action]()
}
// A change to the room or the connection cancels an armed action.
watch([live, locked, () => experiment.value?.run], disarm)

// The presenter's draft target. A state message changes it only while the presenter has not edited it.
const draft = ref<number | string>(targetLimits.initial)
const edited = ref(false)
watch(() => experiment.value?.target, (target) => {
  if (target !== undefined && !edited.value) draft.value = target
}, { immediate: true })
// Targets for one tap: a few specimens for a test alone, and the sizes of a small, house-party, and full room.
const presets = [10, 100, targetLimits.initial, 3000]
function usePreset(value: number) {
  edited.value = false
  draft.value = value
  setTarget(value)
}
function submitTarget() {
  if (typeof draft.value !== 'number' || !Number.isFinite(draft.value)) return
  setTarget(draft.value)
  edited.value = false
}

// Local-only slide portraits for Slide 1, 2, and 4 on `/projector?show`. Stay in this browser and never upload.
const { photos, choose: choosePhoto, remove: removePhoto } = useShowPhotos()
const photoNotice = ref('')
async function pickPhoto(slot: ShowPhotoSlot, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const ok = await choosePhoto(slot, file)
  input.value = ''
  photoNotice.value = ok ? 'Photo stored.' : 'Choose an image file, such as JPG, PNG, or WebP.'
}

// The celebration track. The file stays in this browser. The office page in this browser plays it when the cave appears.
const party = usePartyTrack()
// The room shares the song's tempo and times with every device, so they all dance in step. The song itself stays here.
// The settings go out when they change, and again when the connection returns.
watch([party.track, online], ([track, live]) => {
  if (!track || !live) return
  const { chorusAt, bpm, leadIn, playFor, fadeOut } = track
  setParty({ chorusAt, bpm, leadIn, playFor, fadeOut })
})
const { track: song, status: songStatus, duration: songLength } = party
const storageRefused = computed(() => songStatus.value === 'Unavailable' && !song.value)

type Setting = Exclude<keyof PartyTrack, 'name'>
const settings: readonly Setting[] = ['chorusAt', 'bpm', 'leadIn', 'playFor', 'fadeOut']
// A number field's model can hold a number. Each draft is read as text.
const drafts = reactive<Record<Setting, string | number>>({ chorusAt: '', bpm: '', leadIn: '', playFor: '', fadeOut: '' })
const problems = reactive<Partial<Record<Setting, string>>>({})
const shown = (setting: Setting, value: number) => setting === 'chorusAt' ? formatClock(value) : String(value)
// A stored change shows in every field, except a field that holds a mistake the presenter is fixing.
watch(song, (track) => {
  if (!track) return
  for (const setting of settings) if (!problems[setting]) drafts[setting] = shown(setting, track[setting])
}, { immediate: true })

type Reading = { _tag: 'Ok', value: number } | { _tag: 'Err', message: string }
function readSetting(setting: Setting, text: string): Reading {
  const { least, most } = partyLimits[setting]
  if (setting === 'chorusAt') {
    const value = parseClock(text)
    if (value === undefined) return { _tag: 'Err', message: 'Use seconds, or minutes and seconds, for example 83 or 1:23.' }
    if (value > most) return { _tag: 'Err', message: `Use a time up to ${formatClock(most)}.` }
    if (songLength.value !== null && value >= songLength.value) return { _tag: 'Err', message: `The file ends at ${formatClock(songLength.value)}. Use an earlier time.` }
    return { _tag: 'Ok', value }
  }
  const value = text.trim() === '' ? Number.NaN : Number(text)
  if (Number.isFinite(value) && value >= least && value <= most) return { _tag: 'Ok', value }
  return { _tag: 'Err', message: `Use ${digits.format(least)} to ${digits.format(most)} ${setting === 'bpm' ? 'BPM' : 'seconds'}.` }
}

const notice = ref('')
const failures: Record<PartyFailure, string> = {
  NotAudio: 'This browser cannot play that file. Choose an audio file, such as MP3, M4A, or WAV.',
  TooLarge: `That file is larger than ${digits.format(partyFileBytes / 1024 / 1024)} MB. Choose a smaller file.`,
  StorageRefused: 'The browser refused to store the track. Allow site storage for this page, then try again.',
  NoTrack: 'Choose a track first.',
}
/** Stores the settings that read well. A setting that does not read keeps its message and is not stored. */
async function commit(...chosen: Setting[]) {
  const track = song.value
  if (!track) return
  const changes: Partial<PartyTrack> = {}
  for (const setting of chosen) {
    const reading = readSetting(setting, String(drafts[setting]))
    if (reading._tag === 'Err') {
      problems[setting] = reading.message
      continue
    }
    delete problems[setting]
    if (reading.value === track[setting]) drafts[setting] = shown(setting, reading.value)
    else changes[setting] = reading.value
  }
  if (Object.keys(changes).length === 0) return
  const result = await party.update(changes)
  if (result._tag === 'Err') notice.value = failures[result.reason]
}

const choosing = ref(false)
async function pick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  choosing.value = true
  // A new song keeps the timing of the room. Its chorus and tempo start again from the defaults.
  const kept = song.value
  const result = await party.choose(file, kept ? { leadIn: kept.leadIn, playFor: kept.playFor, fadeOut: kept.fadeOut } : {})
  choosing.value = false
  input.value = ''
  if (result._tag === 'Err') {
    notice.value = failures[result.reason]
    return
  }
  for (const setting of settings) delete problems[setting]
  if (song.value) for (const setting of settings) drafts[setting] = shown(setting, song.value[setting])
  notice.value = 'Track stored.'
}
async function removeTrack() {
  const result = await party.remove()
  notice.value = result._tag === 'Ok' ? 'Track removed.' : failures[result.reason]
}

// A chorus near the start of the file leaves less music than the fade in needs.
const shortFade = computed(() => {
  const track = song.value
  if (!track || track.chorusAt >= track.leadIn) return undefined
  if (track.chorusAt === 0) return 'The chorus is at the start of the file, so the music starts at full level. Set where the chorus starts.'
  return `The file has ${digits.format(track.chorusAt)} seconds before the chorus, so the fade in is ${digits.format(track.chorusAt)} seconds long.`
})

// Tap tempo. The taps count until a gap of more than two seconds. The tempo is stored when the taps stop.
const taps = shallowRef<readonly number[]>([])
const tapped = computed(() => tapTempo(taps.value))
const { start: keepTapped } = useTimeoutFn(() => { void commit('bpm') }, tapRestartMs, { immediate: false })
function tap() {
  const at = performance.now()
  const last = taps.value.at(-1)
  taps.value = last === undefined || at - last > tapRestartMs ? [at] : [...taps.value.slice(-15), at]
  const bpm = tapTempo(taps.value)
  if (bpm === undefined) return
  drafts.bpm = String(bpm)
  delete problems.bpm
  keepTapped()
}
const tapNote = computed(() => taps.value.length === 0 ? 'Tap at least four times on the beat.' : tapped.value === undefined ? 'Keep tapping on the beat.' : `${tapped.value} BPM`)

const sounding = computed(() => songStatus.value === 'Waiting' || songStatus.value === 'Playing')
const playbackNotes: Record<PartyStatus, string> = {
  Idle: 'Ready.',
  Waiting: 'Waiting to start.',
  Playing: 'Playing.',
  Unavailable: 'The browser refused to play the track. Select “Test from the fade” again, or choose another file.',
}
// The test plays what the room will hear: the fade is cut to the length of the critical scene, as it is there.
// It also says when the cave would appear, so the presenter can hear whether the right word of the song lands on that moment.
const testHit = ref<number | null>(null)
const stamp = useTimestamp({ interval: 100 })
function testFade() {
  if (!song.value) return
  const lead = Math.min(song.value.leadIn, criticalSceneSeconds)
  testHit.value = Date.now() + lead * 1000
  party.play(lead)
}
watch(sounding, (now) => { if (!now) testHit.value = null })
const untilHit = computed(() => testHit.value === null ? null : (testHit.value - stamp.value) / 1000)
</script>

<template>
  <main class="presenter">
    <div class="panel">
      <header class="top">
        <h1>Presenter</h1>
        <div class="links">
          <a href="/projector?show" target="_blank" rel="noopener">Open show<span class="hidden-label"> (opens in a new tab)</span></a>
          <a href="/projector" target="_blank" rel="noopener">Open the office<span class="hidden-label"> (opens in a new tab)</span></a>
        </div>
      </header>
      <p class="connection" role="status" :data-online="online">
        <i aria-hidden="true" />{{ connection }}
      </p>

      <section class="readout" aria-labelledby="readout-title" :data-stale="!live" :data-phase="readout?.phase">
        <h2 id="readout-title">
          Office experiment
        </h2>
        <template v-if="readout">
          <dl class="meta">
            <div><dt>Run</dt><dd>{{ digits.format(readout.run) }}</dd></div>
            <div><dt>Visitors</dt><dd>{{ digits.format(connected) }}</dd></div>
            <div v-if="!online" class="stale">
              Last known values
            </div>
          </dl>
          <p class="phase">
            <strong>{{ readout.phase }}</strong><span>{{ phaseNotes[readout.phase] }}</span>
          </p>
          <dl class="numbers">
            <div><dt>Specimens</dt><dd>{{ digits.format(readout.count) }}</dd></div>
            <div><dt>Target</dt><dd>{{ digits.format(readout.target) }}</dd></div>
          </dl>
          <div class="track" aria-hidden="true">
            <i :style="{ inlineSize: `${readout.progress * 100}%` }" />
          </div>
          <dl class="tally">
            <div v-for="(glyph, kind) in creatures" :key="kind">
              <dt>{{ glyph }}</dt><dd>{{ digits.format(readout.tally[kind]) }}</dd>
            </div>
          </dl>
        </template>
        <p v-else class="waiting">
          No numbers yet. They appear when the connection opens.
        </p>
      </section>

      <section class="controls" aria-labelledby="controls-title">
        <h2 id="controls-title">
          Controls
        </h2>
        <form class="control" @submit.prevent="submitTarget">
          <label for="presenter-target">New target</label>
          <div class="field">
            <input
              id="presenter-target" v-model.number="draft" type="number" inputmode="numeric" required step="1"
              :min="targetLimits.least" :max="targetLimits.most" :disabled="!live || locked" aria-describedby="presenter-target-help"
              @input="edited = true"
            >
            <button type="submit" class="primary" :disabled="!live || locked">
              Set target
            </button>
          </div>
          <div class="presets" role="group" aria-label="Quick targets">
            <button v-for="value in presets" :key="value" type="button" :disabled="!live || locked" @click="usePreset(value)">
              {{ digits.format(value) }}
            </button>
          </div>
          <p id="presenter-target-help" class="help">
            <template v-if="locked">
              After critical, reset the experiment to change the target.
            </template>
            <template v-else>
              Use {{ digits.format(targetLimits.least) }} to {{ digits.format(targetLimits.most) }}. A target at or below the count sends the run critical at once.
            </template>
          </p>
        </form>

        <div class="control">
          <button
            type="button" class="primary reveal-btn" :disabled="!canReveal"
            aria-describedby="presenter-reveal-help" @click="reveal"
          >
            Reveal cave now
          </button>
          <p id="presenter-reveal-help" class="help">
            Leaves the blackout hold, starts the {{ revealSwellSeconds }}-second song swell, and reveals the cave.
          </p>
        </div>

        <div class="control">
          <button
            type="button" class="guarded" :data-armed="armed?.action === 'critical'" :disabled="!live || locked"
            aria-describedby="presenter-critical-help" @click="press('critical')" @keydown.escape="disarm"
          >
            {{ armed?.action === 'critical' ? 'Select again to go critical' : 'Go critical now' }}
          </button>
          <p id="presenter-critical-help" class="help">
            Sends the run critical at the current count.
          </p>
        </div>

        <div class="control">
          <button
            type="button" class="guarded" :data-armed="armed?.action === 'reset'" :disabled="!live"
            aria-describedby="presenter-reset-help" @click="press('reset')" @keydown.escape="disarm"
          >
            {{ armed?.action === 'reset' ? 'Select again to reset' : 'Reset experiment' }}
          </button>
          <p id="presenter-reset-help" class="help">
            Starts a new run with zero specimens. The target stays.
          </p>
        </div>
      </section>

      <section class="celebration" aria-labelledby="celebration-title">
        <h2 id="celebration-title">
          Celebration track
        </h2>
        <p class="help">
          The file stays in this browser and is never uploaded. Choose it in the browser that drives the projector. Phones in the room stay silent.
        </p>

        <div class="control">
          <label for="party-file">Track file</label>
          <input id="party-file" type="file" accept="audio/*" :disabled="choosing || storageRefused" :data-stored="Boolean(song)" aria-describedby="party-notice" @change="pick">
          <p v-if="storageRefused" class="problem">
            This browser refused to store the track. Private windows often do this. Use a normal window, then reload this page.
          </p>
          <div v-else-if="song" class="chosen">
            <p class="name">
              {{ song.name }}<span v-if="songLength !== null" class="length">{{ formatClock(Math.round(songLength)) }}</span>
            </p>
            <button type="button" @click="removeTrack">
              Remove track
            </button>
          </div>
          <p v-else class="empty">
            No track chosen. Choose a song to play when the cave appears.
          </p>
          <p id="party-notice" class="help" role="status">
            {{ notice }}
          </p>
        </div>

        <form v-if="song" class="control settings" novalidate @submit.prevent="commit(...settings)">
          <div class="setting wide">
            <label for="party-chorus">Chorus starts at</label>
            <input
              id="party-chorus" v-model="drafts.chorusAt" type="text" autocomplete="off" spellcheck="false"
              :aria-invalid="Boolean(problems.chorusAt)" :aria-describedby="`party-chorus-help${problems.chorusAt ? ' party-chorus-problem' : ''}${shortFade ? ' party-short-fade' : ''}`"
              @change="commit('chorusAt')"
            >
            <p v-if="problems.chorusAt" id="party-chorus-problem" class="problem">
              {{ problems.chorusAt }}
            </p>
            <p id="party-chorus-help" class="help">
              Seconds, or minutes and seconds, for example 1:23.5.
            </p>
            <p v-if="shortFade" id="party-short-fade" class="help warning">
              {{ shortFade }}
            </p>
          </div>

          <div class="setting wide">
            <label for="party-bpm">Tempo (BPM)</label>
            <div class="field">
              <input
                id="party-bpm" v-model="drafts.bpm" type="number" inputmode="decimal" step="any" :min="partyLimits.bpm.least" :max="partyLimits.bpm.most"
                :aria-invalid="Boolean(problems.bpm)" :aria-describedby="`party-tap${problems.bpm ? ' party-bpm-problem' : ''}`" @change="commit('bpm')"
              >
              <button type="button" class="tap" @click="tap">
                Tap tempo
              </button>
            </div>
            <p v-if="problems.bpm" id="party-bpm-problem" class="problem">
              {{ problems.bpm }}
            </p>
            <p id="party-tap" class="help" role="status">
              {{ tapNote }}
            </p>
          </div>

          <div v-for="[setting, label] in ([['leadIn', 'Fade in (seconds)'], ['playFor', 'Plays for (seconds)'], ['fadeOut', 'Fade out (seconds)']] as const)" :key="setting" class="setting">
            <label :for="`party-${setting}`">{{ label }}</label>
            <input
              :id="`party-${setting}`" v-model="drafts[setting]" type="number" inputmode="decimal" step="any" :min="partyLimits[setting].least" :max="partyLimits[setting].most"
              :aria-invalid="Boolean(problems[setting])" :aria-describedby="problems[setting] ? `party-${setting}-problem` : undefined" @change="commit(setting)"
            >
            <p v-if="problems[setting]" :id="`party-${setting}-problem`" class="problem">
              {{ problems[setting] }}
            </p>
          </div>

          <p class="help wide">
            The chorus hits when the cave appears, {{ revealSwellSeconds }} seconds after you reveal from the blackout hold (at least {{ criticalSceneSeconds }} seconds after critical).
          </p>
        </form>

        <div v-if="song" class="control">
          <div class="actions">
            <button type="button" class="primary" :disabled="sounding" @click="testFade">
              Test from the fade
            </button>
            <button type="button" :disabled="!sounding" @click="party.stop(1)">
              Stop
            </button>
          </div>
          <p class="playback" role="status" :data-status="songStatus">
            {{ playbackNotes[songStatus] }}
          </p>
          <p v-if="untilHit !== null" class="cue" :data-shown="untilHit <= 0" aria-live="off">
            {{ untilHit > 0 ? `The cave appears in ${Math.ceil(untilHit)} s.` : 'The cave is showing.' }}
          </p>
          <p class="help">
            Before the talk, select anything on the <a href="/projector" target="_blank" rel="noopener">office page</a> once, so the browser lets it play sound.
          </p>
        </div>
      </section>

      <section class="photos" aria-labelledby="photos-title">
        <h2 id="photos-title">
          Slide photos
        </h2>
        <p class="help">
          Optional photos for Slide 1, 2, and 4 on <a href="/projector?show" target="_blank" rel="noopener">the show page</a>. They stay in this browser and replace the sketched portraits.
        </p>
        <div v-for="[slot, label] in ([['scientist', 'My photo'], ['brundle', 'Brundle before photo']] as const)" :key="slot" class="control">
          <label :for="`show-photo-${slot}`">{{ label }}</label>
          <input :id="`show-photo-${slot}`" type="file" accept="image/*" :data-stored="Boolean(photos[slot])" @change="pickPhoto(slot, $event)">
          <div v-if="photos[slot]" class="chosen">
            <img :src="photos[slot]!" :alt="label" class="thumb">
            <button type="button" @click="removePhoto(slot)">
              Remove photo
            </button>
          </div>
        </div>
        <p v-if="photoNotice" class="help" role="status">
          {{ photoNotice }}
        </p>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* The body does not scroll, so the panel scrolls inside the viewport. */
.presenter { block-size: 100dvh; overflow-y: auto; overscroll-behavior: contain; background: var(--color-night); color: var(--color-cream); font-family: var(--font-sans); }
.panel { box-sizing: border-box; display: grid; gap: 24px; align-content: start; max-inline-size: 64rem; margin-inline: auto; padding: 24px 16px 48px; }
h1, h2, p, dl, dd { margin: 0; }

.top { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.links { display: flex; align-items: center; gap: 20px; }
h1 { font: 700 2.25rem/1 var(--font-display); letter-spacing: .01em; }
.top a { display: inline-flex; align-items: center; min-block-size: 44px; font: 500 15px var(--font-mono); color: var(--color-cream); text-decoration: underline; text-underline-offset: .3em; }
.top a:hover { color: var(--color-wing); }
.hidden-label { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.reveal-btn { inline-size: 100%; }

.connection { display: flex; align-items: center; gap: 10px; font: 500 15px var(--font-mono); color: var(--color-wing); }
.connection i { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--color-flesh); }
.connection[data-online="true"] { color: var(--color-cream); }
.connection[data-online="true"] i { background: var(--color-eye); }

section { display: grid; gap: 20px; align-content: start; padding: 20px 16px; border: 1px solid var(--color-chitin); background: var(--ui-bg-muted); }
h2 { font: 500 13px var(--font-mono); letter-spacing: .12em; text-transform: uppercase; color: var(--color-wing); }
dt { font: 500 13px var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--color-wing); }
dd { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

.meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 24px; }
.meta > div { display: flex; align-items: baseline; gap: 8px; }
.meta dd { font-size: 20px; font-weight: 500; }
.meta .stale { font: 500 13px var(--font-mono); color: var(--color-night); background: var(--color-wing); padding: 2px 8px; }

.phase { display: grid; gap: 4px; }
.phase strong { font: 700 clamp(2.5rem, 11vw, 3.5rem)/1 var(--font-display); letter-spacing: .01em; }
.phase span { color: var(--color-wing); }
.readout[data-phase="Quiet"] .phase strong { color: var(--color-wing); }
.readout[data-phase="Critical"] .phase strong, .readout[data-phase="Holding"] .phase strong { color: var(--color-flesh); }
.readout[data-phase="Over"] .phase strong { color: var(--color-wing); }

.numbers { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.numbers > div { display: grid; gap: 6px; min-inline-size: 0; }
.numbers dd { font-size: clamp(2.25rem, 10vw, 4.5rem); font-weight: 500; line-height: 1; letter-spacing: -.03em; }
.numbers > div + div dd { color: var(--color-wing); }

.track { block-size: 6px; background: var(--color-chitin); overflow: hidden; }
.track i { display: block; block-size: 100%; background: var(--color-cream); transition: inline-size .3s ease-out; }
.readout[data-phase="Critical"] .track i, .readout[data-phase="Over"] .track i { background: var(--color-flesh); }

.tally { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.tally > div { display: grid; justify-items: center; gap: 4px; padding: 10px 4px; border: 1px solid var(--color-chitin); background: var(--color-night); }
.tally dt { font: 1.75rem/1.1 sans-serif; letter-spacing: 0; text-transform: none; }
.tally dd { font-size: clamp(15px, 4.4vw, 20px); font-weight: 500; }

/* Old numbers stay readable but never look live. */
.readout[data-stale="true"] dd, .readout[data-stale="true"] .phase, .readout[data-stale="true"] .track { opacity: .45; }
.waiting { color: var(--color-wing); font-size: 17px; line-height: 1.5; padding-block: 24px; }

.control { display: grid; gap: 8px; }
.presets { display: flex; flex-wrap: wrap; gap: 8px; }
.presets button { flex: 1; min-width: 64px; }
.control + .control { padding-block-start: 20px; border-block-start: 1px solid var(--color-chitin); }
label { font: 500 13px var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--color-wing); }
.field { display: flex; gap: 8px; }
input { flex: 1; min-inline-size: 0; box-sizing: border-box; min-block-size: 48px; padding: 8px 12px; font: 500 20px var(--font-mono); font-variant-numeric: tabular-nums; color: var(--color-cream); background: var(--color-night); border: 1px solid var(--color-olive); border-radius: 0; }
input:disabled { color: var(--color-wing); border-color: var(--color-chitin); }
.help { font-size: 14px; line-height: 1.5; color: var(--color-wing); }

button { min-block-size: 48px; padding: 10px 16px; font: 500 16px/1.2 var(--font-mono); color: var(--color-cream); background: transparent; border: 1px solid var(--color-olive); border-radius: 0; cursor: pointer; transition: background-color .15s, border-color .15s, color .15s; }
button:disabled { cursor: not-allowed; opacity: .4; }
.primary { color: var(--color-night); background: var(--color-cream); border-color: var(--color-cream); white-space: nowrap; }
.primary:enabled:hover { background: var(--color-wing); border-color: var(--color-wing); }
.guarded { inline-size: 100%; text-align: start; }
.guarded:enabled:hover { background: var(--ui-bg-elevated); }
/* An armed action changes colour and label, so a second selection is a clear choice. */
.guarded[data-armed="true"], .guarded[data-armed="true"]:enabled:hover { background: var(--color-bruise); border-color: var(--color-flesh); box-shadow: inset 4px 0 var(--color-flesh); }

/* The celebration track. Its parts follow the controls above it. */
.chosen { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
.name { min-inline-size: 0; font: 500 17px/1.4 var(--font-mono); overflow-wrap: anywhere; }
.length { margin-inline-start: 12px; color: var(--color-wing); font-variant-numeric: tabular-nums; }
.empty { font-size: 17px; line-height: 1.5; color: var(--color-wing); }
.problem { font-size: 14px; line-height: 1.5; color: var(--color-flesh); }
.warning { color: var(--color-cream); }
/* The stored track's name stands below the field, so the browser's own file note is hidden. */
input[type="file"] { flex: none; justify-self: start; max-inline-size: 100%; min-block-size: 0; padding: 0; border: 0; background: none; font-size: 0; color: transparent; }
input[type="file"]::file-selector-button { min-block-size: 48px; margin: 0; padding: 10px 16px; font: 500 16px/1.2 var(--font-mono); color: var(--color-night); background: var(--color-cream); border: 1px solid var(--color-cream); border-radius: 0; cursor: pointer; }
input[type="file"]:enabled:hover::file-selector-button { background: var(--color-wing); border-color: var(--color-wing); }
input[type="file"][data-stored="true"]::file-selector-button { color: var(--color-cream); background: transparent; border-color: var(--color-olive); }
input[type="file"][data-stored="true"]:enabled:hover::file-selector-button { background: var(--ui-bg-elevated); }
input[aria-invalid="true"] { border-color: var(--color-flesh); }
/* The three timing fields share one row, also at 360 px. Labels can wrap, and the fields stay level. */
.settings { grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: end; gap: 16px 12px; }
.settings .wide { grid-column: 1 / -1; }
.setting { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; min-inline-size: 0; }
.tap { white-space: nowrap; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.actions button { flex: 1 1 auto; }
.playback { font: 500 15px var(--font-mono); }
.playback[data-status="Playing"] { color: var(--color-eye); }
.playback[data-status="Unavailable"] { font: 400 14px/1.5 var(--font-sans); color: var(--color-flesh); }
/* The cue of the test: a count to the moment the cave would appear, then one clear change of colour at that moment. */
.cue { margin: 0; padding: 6px 10px; width: fit-content; font: 500 15px var(--font-mono); color: var(--color-wing); border: 1px solid currentColor; }
.cue[data-shown="true"] { color: var(--color-night); background: var(--color-eye); border-color: var(--color-eye); }
.celebration :is(button, input):focus-visible, .photos :is(button, input):focus-visible { outline: 2px solid var(--color-cream); outline-offset: 2px; }
.thumb { inline-size: 72px; block-size: 72px; object-fit: cover; border: 1px solid var(--color-olive); }

@media (min-width: 900px) {
  .panel { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); align-items: start; gap: 24px 32px; padding: 48px 32px; }
  .top, .connection { grid-column: 1 / -1; }
  section { padding: 24px; }
  /* The readout fills the left column. The celebration track and slide photos sit under the controls. */
  .readout { grid-row: span 3; }
  .celebration, .photos { grid-column: 2; }
}
@media (prefers-reduced-motion: reduce) {
  .track i, button { transition: none; }
}
</style>
