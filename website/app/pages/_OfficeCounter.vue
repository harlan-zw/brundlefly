<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useIntervalFn, useVibrate } from '@vueuse/core'
import { creatureKinds, creatures, loadedPercent, specimenCount } from '#shared/office-experiment'
import type { Creature, Experiment } from '#shared/office-experiment'

// The desk computer's screen: a desktop from the late 1990s with one program, the specimen loader.
// The scene gives the place of the glass. Each key adds one specimen for everyone, and every device shows the same load.
const { experiment, connected, online, shown } = defineProps<{ experiment: Experiment, connected: number, online: boolean, shown: boolean }>()
const emit = defineEmits<{ tap: [kind: Creature] }>()
const digits = new Intl.NumberFormat('en')
const count = computed(() => specimenCount(experiment))
const percent = computed(() => loadedPercent(experiment))
const critical = computed(() => experiment.criticalAt !== null)
// The load bar fills in whole blocks, as the progress bars of that desktop did.
const blockCount = 24
const blocks = computed(() => Math.min(blockCount, Math.floor(blockCount * count.value / experiment.target)))
// Each creature's bar runs against the leader, so the four keys are a race.
const lead = computed(() => Math.max(1, ...creatureKinds.map(kind => experiment.tally[kind])))
const { vibrate } = useVibrate({ pattern: 8 })
function press(kind: Creature) {
  if (!online || critical.value) return
  emit('tap', kind)
  vibrate()
}
// A pointer presses on the way down, so two thumbs can work the keys. The keyboard and a screen reader press with a click.
const click = (kind: Creature, event: MouseEvent) => { if (event.detail === 0) press(kind) }

// Every new specimen flies from the folder to the chamber, whoever added it. A burst shows a few of them, not all.
type Flight = { id: number, kind: Creature, lift: number }
const flights = ref<Flight[]>([])
let flown = 0
watch(() => experiment.tally, (now, before) => {
  if (experiment.criticalAt !== null) return
  const fresh = creatureKinds.filter(kind => now[kind] > before[kind]).slice(0, Math.max(0, 6 - flights.value.length))
  if (fresh.length) flights.value = [...flights.value, ...fresh.map(kind => ({ id: flown++, kind, lift: Math.round(Math.random() * 100) }))]
})

// The people in the office, once a second, as the line of a system monitor.
const samples = 40
const history = ref<number[]>(Array.from({ length: samples }, () => connected))
useIntervalFn(() => { history.value = [...history.value.slice(1), connected] }, 1000)
const chart = computed(() => {
  const top = Math.max(4, ...history.value)
  return history.value.map((value, index) => `${index / (samples - 1) * 100},${(1 - value / top) * 18 + 1}`).join(' ')
})
</script>

<template>
  <section class="counter" :class="{ shown }" aria-label="Specimen loader" :inert="!shown">
    <!-- The run goes critical, and the computer fails as that desktop failed. -->
    <div v-if="critical" class="crash" role="alert">
      <p class="crash-name"><span>CHAMBER</span></p>
      <p>A fatal exception 0E has occurred at 0028:C0011E36 in VXD CHAMBER(01). All specimens will be loaded at once.</p>
      <p>* Hold still.<br>* Do not press any key. It will not help.</p>
      <p>Loading everything <i class="caret" aria-hidden="true">_</i></p>
    </div>
    <template v-else>
      <div class="window">
        <header class="title">
          <strong>Specimen Loader</strong>
          <span class="title-buttons" aria-hidden="true"><i>_</i><i>□</i><i>×</i></span>
        </header>
        <div class="body">
          <div class="copy" aria-hidden="true">
            <span>📁</span>
            <span class="flight"><i v-for="flight in flights" :key="flight.id" :style="{ '--lift': `${flight.lift}%` }" @animationend="flights = flights.filter(other => other.id !== flight.id)">{{ creatures[flight.kind] }}</i></span>
            <span>⚗️</span>
          </div>
          <div class="well progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="percent" :aria-valuetext="`${percent}% of specimens loaded`">
            <i v-for="block in blocks" :key="block" />
          </div>
          <p class="loaded"><strong>{{ percent }}% of specimens loaded</strong><span>{{ digits.format(count) }} / {{ digits.format(experiment.target) }}</span></p>
          <div class="keys">
            <button v-for="kind in creatureKinds" :key="kind" type="button" :disabled="!online" :aria-label="`Add a ${kind}. ${experiment.tally[kind]} so far.`"
              @pointerdown.prevent="press(kind)" @click="click(kind, $event)">
              <span class="glyph" aria-hidden="true">{{ creatures[kind] }}</span>
              <span class="well race" :data-kind="kind" aria-hidden="true"><i :style="{ width: `${100 * experiment.tally[kind] / lead}%` }" /></span>
              <small aria-hidden="true">{{ digits.format(experiment.tally[kind]) }}</small>
            </button>
          </div>
        </div>
      </div>
      <footer class="taskbar">
        <span class="start" aria-hidden="true"><b /> Start</span>
        <span class="task" aria-hidden="true">Specimen Loader</span>
        <span class="well tray" role="status">
          <svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><polyline :points="chart" /></svg>
          {{ online ? `${connected} in the office` : 'Reconnecting…' }}
        </span>
      </footer>
    </template>
  </section>
</template>

<style scoped>
/* The screen fills the glass, so its sizes follow the width of the glass. Without WebGL it stands in the middle of the page. */
.counter { --face: #c0c0c0; --raised: inset -1px -1px #0a0a0a, inset 1px 1px #fff, inset -2px -2px #808080, inset 2px 2px #dfdfdf; --sunken: inset -1px -1px #fff, inset 1px 1px #808080, inset -2px -2px #dfdfdf, inset 2px 2px #0a0a0a;
  position: fixed; z-index: 3; left: var(--crt-left, calc(50vw - min(40vw, 17rem))); top: var(--crt-top, 30vh); width: var(--crt-width, min(80vw, 34rem)); height: var(--crt-height, auto);
  container-type: inline-size; box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; color: #000; background: #008080; border-radius: 2.5% / 3.5%;
  font: 14px/1.2 Tahoma, 'MS Sans Serif', Geneva, Verdana, sans-serif; opacity: 0; pointer-events: none; transition: opacity .2s ease-out; }
.counter.shown { opacity: var(--crt-ready, 1); pointer-events: auto; }
p { margin: 0; }
/* The glass is the container, so only what is inside it can take its sizes from it. */
.window, .taskbar { font-size: 3.5cqw; }
.window { flex: 1; display: flex; flex-direction: column; min-height: 0; margin: 1.6cqw 1.6cqw 1cqw; padding: 3px; background: var(--face); box-shadow: var(--raised); }
.title { flex: none; display: flex; align-items: center; justify-content: space-between; height: 6.6cqw; padding: 0 1cqw 0 1.6cqw; color: #fff; background: linear-gradient(90deg, #000080, #1084d0); }
.title strong { font-size: 3.7cqw; letter-spacing: .01em; }
.title-buttons { display: flex; gap: .6cqw; }
.title-buttons i { display: grid; place-items: center; width: 5cqw; height: 4.4cqw; color: #000; background: var(--face); box-shadow: var(--raised); font: 700 3cqw/1 Tahoma, Verdana, sans-serif; }
.body { flex: 1; display: flex; flex-direction: column; justify-content: space-between; gap: 1.4cqw; min-height: 0; padding: 2cqw 2.4cqw 2.2cqw; }
/* A specimen leaves the folder and lands in the chamber, as a file once flew between two folders. */
.copy { display: grid; grid-template-columns: auto 1fr auto; align-items: center; height: 7.6cqw; font-size: 6cqw; line-height: 1; }
.flight { position: relative; height: 100%; }
.flight i { position: absolute; left: 0; top: 10%; font-style: normal; font-size: 4.6cqw; animation: counter-flight .8s cubic-bezier(.3, 0, .6, 1) both; }
@keyframes counter-flight { from { left: 0; translate: 0 0; opacity: 1; } 50% { translate: 0 calc(-12% - var(--lift) * .5); } to { left: calc(100% - 5cqw); translate: 0 0; opacity: .2; } }
.well { background: #fff; box-shadow: var(--sunken); }
.progress { flex: none; display: flex; gap: .55cqw; height: 5.6cqw; padding: .9cqw; box-sizing: border-box; }
.progress i { flex: 0 0 calc((100% - 23 * .55cqw) / 24); background: #000080; }
.loaded { display: flex; justify-content: space-between; align-items: baseline; gap: 2cqw; font-variant-numeric: tabular-nums; }
.loaded strong { font-size: 4.3cqw; }
.loaded span { font-size: 3.2cqw; white-space: nowrap; }
.keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.6cqw; }
button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .7cqw; min-height: 44px; height: 20cqw; padding: 1.2cqw 1.6cqw; color: #000; background: var(--face); border: 0; box-shadow: var(--raised);
  font: inherit; cursor: pointer; touch-action: manipulation; user-select: none; -webkit-tap-highlight-color: transparent; }
/* A pressed key sinks, and what is on it moves with it. */
button:active:enabled { box-shadow: var(--sunken); padding: 1.5cqw 1.3cqw .9cqw 1.9cqw; }
button:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }
button:disabled { cursor: default; }
button:disabled .glyph { filter: grayscale(1); opacity: .6; }
.glyph { font-size: 7.4cqw; line-height: 1; }
.race { display: block; width: 100%; height: 2.4cqw; padding: 2px; box-sizing: border-box; }
.race i { display: block; height: 100%; background: #000080; transition: width .25s ease-out; }
.race[data-kind='snail'] i { background: #808000; } .race[data-kind='beetle'] i { background: #008000; } .race[data-kind='cricket'] i { background: #800000; }
button small { font-size: 3.3cqw; font-variant-numeric: tabular-nums; }
.taskbar { flex: none; display: flex; align-items: center; gap: 1.2cqw; height: 8cqw; padding: .8cqw 1cqw .6cqw; box-sizing: border-box; background: var(--face); box-shadow: inset 0 1px #dfdfdf, inset 0 2px #fff; }
.start, .task { display: flex; align-items: center; gap: 1cqw; height: 100%; padding: 0 1.8cqw; box-shadow: var(--raised); font-weight: 700; white-space: nowrap; }
/* The four panes of the start button's flag. */
.start b { width: 3cqw; height: 3cqw; background: conic-gradient(#f00 0 25%, #0a0 0 50%, #fc0 0 75%, #00f 0); }
.task { flex: 1; min-width: 0; overflow: hidden; font-weight: 400; box-shadow: var(--sunken); background: repeating-conic-gradient(#fff 0 25%, var(--face) 0 50%) 0 0 / 2px 2px; }
.tray { display: flex; align-items: center; gap: 1.2cqw; height: 100%; padding: 0 1.6cqw 0 .9cqw; background: var(--face); font-size: 3.1cqw; white-space: nowrap; font-variant-numeric: tabular-nums; }
.tray svg { width: 22cqw; height: 5cqw; background: #000; }
.tray polyline { fill: none; stroke: #0f0; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.crash { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 3.2cqw; padding: 0 7cqw; color: #fff; background: #0000aa; font: 3.5cqw/1.35 var(--font-mono, monospace); }
.crash-name { text-align: center; }
.crash-name span { padding: 0 1.6cqw; color: #0000aa; background: #aaa; }
.caret { font-style: normal; animation: counter-caret 1s steps(2, jump-none) infinite; }
@keyframes counter-caret { to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .counter, .race i { transition: none; } .flight { visibility: hidden; } .caret { animation: none; } }
</style>
