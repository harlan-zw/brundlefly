<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useIntervalFn, useTimeoutFn } from '@vueuse/core'
import { useHead } from '#imports'
import { creatures, phase, specimenCount, targetLimits } from '#shared/office-experiment'
import type { Phase } from '#shared/office-experiment'
import { useOfficeExperiment } from '../composables/useOfficeExperiment'

// The presenter's control panel. It watches the room, so the room does not count it as a visitor.
useHead({
  title: 'Presenter | Brundlefly',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }, { property: 'og:url', content: 'https://brundlefly.dev/presenter' }],
  link: [{ rel: 'canonical', href: 'https://brundlefly.dev/presenter' }],
})

const { experiment, connected, online, clock, reset, setTarget, goCritical } = useOfficeExperiment(() => true, 'watcher')

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
const readout = computed(() => {
  const state = experiment.value
  if (!state) return undefined
  const count = specimenCount(state)
  return { run: state.run, tally: state.tally, target: state.target, count, phase: phase(state, now.value), progress: Math.min(1, count / Math.max(1, state.target)) }
})

const phaseNotes: Record<Phase, string> = {
  Quiet: 'No specimens yet.',
  Counting: 'Visitors add specimens.',
  Critical: 'The critical scene plays for everyone.',
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
function submitTarget() {
  if (typeof draft.value !== 'number' || !Number.isFinite(draft.value)) return
  setTarget(draft.value)
  edited.value = false
}
</script>

<template>
  <main class="presenter">
    <div class="panel">
      <header class="top">
        <h1>Presenter</h1>
        <a href="/office" target="_blank" rel="noopener">Open the office<span class="hidden-label"> (opens in a new tab)</span></a>
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
    </div>
  </main>
</template>

<style scoped>
/* The body does not scroll, so the panel scrolls inside the viewport. */
.presenter { block-size: 100dvh; overflow-y: auto; overscroll-behavior: contain; background: var(--color-night); color: var(--color-cream); font-family: var(--font-sans); }
.panel { box-sizing: border-box; display: grid; gap: 24px; align-content: start; max-inline-size: 64rem; margin-inline: auto; padding: 24px 16px 48px; }
h1, h2, p, dl, dd { margin: 0; }

.top { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
h1 { font: 700 2.25rem/1 var(--font-display); letter-spacing: .01em; }
.top a { display: inline-flex; align-items: center; min-block-size: 44px; font: 500 15px var(--font-mono); color: var(--color-cream); text-decoration: underline; text-underline-offset: .3em; }
.top a:hover { color: var(--color-wing); }
.hidden-label { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

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
.readout[data-phase="Critical"] .phase strong { color: var(--color-flesh); }
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

@media (min-width: 900px) {
  .panel { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); align-items: start; gap: 24px 32px; padding: 48px 32px; }
  .top, .connection { grid-column: 1 / -1; }
  section { padding: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .track i, button { transition: none; }
}
</style>
