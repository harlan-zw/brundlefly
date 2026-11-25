<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useIntervalFn, useVibrate } from '@vueuse/core'
import { creatureKinds, creatures, loadedPercent, specimenCount } from '#shared/office-experiment'
import type { Creature, Experiment, Tally } from '#shared/office-experiment'
import { unrest } from '#shared/office-unrest'

// The desk computer's screen: the dashboard of a home lab that runs one service, the specimen loader.
// The scene gives the place of the glass. Each key adds one specimen for everyone, and every device shows the same load.
const { experiment, connected, online, shown, revealed = false } = defineProps<{ experiment: Experiment, connected: number, online: boolean, shown: boolean, revealed?: boolean }>()
// `leave` asks for the room again. `enter` opens the cave after the reveal.
const emit = defineEmits<{ tap: [kind: Creature], leave: [], enter: [] }>()
const digits = new Intl.NumberFormat('en')
const count = computed(() => specimenCount(experiment))
const percent = computed(() => loadedPercent(experiment))
const critical = computed(() => experiment.criticalAt !== null)
// Near the target the chamber is not steady, and its log says so. COPY.md owns the two lines.
const stage = computed(() => unrest(experiment).stage)
const warnings = { Calm: '', Unstable: 'chamber: pressure above limit', Warning: 'chamber: WARNING: containment at risk' }
const { vibrate } = useVibrate({ pattern: 8 })
function press(kind: Creature) {
  if (!online || critical.value) return
  emit('tap', kind)
  vibrate()
}
// A pointer presses on the way down, so two thumbs can work the keys. The keyboard and a screen reader press with a click.
const click = (kind: Creature, event: MouseEvent) => { if (event.detail === 0) press(kind) }

// Once a second the dashboard reads the room: the people in the office, and the specimens each creature gained in that second.
// Every chart on the screen draws these readings, so nothing on it is decoration.
const samples = 40
const flat = () => Array.from({ length: samples }, () => 0)
const people = ref(Array.from({ length: samples }, () => connected))
const rates = ref<Record<Creature, number[]>>({ snail: flat(), beetle: flat(), fly: flat(), cricket: flat() })
let read: { run: number, tally: Tally } = { run: experiment.run, tally: experiment.tally }
useIntervalFn(() => {
  people.value = [...people.value.slice(1), connected]
  // A new run starts its charts from nothing.
  const before = read.run === experiment.run ? read.tally : experiment.tally
  rates.value = Object.fromEntries(creatureKinds.map(kind => [kind, [...rates.value[kind].slice(1), Math.max(0, experiment.tally[kind] - before[kind])]])) as Record<Creature, number[]>
  read = { run: experiment.run, tally: experiment.tally }
}, 1000)
const total = computed(() => rates.value.snail.map((_, index) => creatureKinds.reduce((sum, kind) => sum + rates.value[kind][index]!, 0)))
// The rate over the last three seconds, so the figure does not jump with every reading.
const rate = computed(() => Math.round(total.value.slice(-3).reduce((sum, value) => sum + value, 0) / 3))
// A chart's line in a box 100 wide and 20 high. `least` is the smallest top of the scale, so a quiet chart stays low.
// Each point of a rate is the mean of three readings: a phone delivers the count in bursts, and the line should show the room, not the bursts.
const smooth = (values: readonly number[]) => values.map((_, index) => { const near = values.slice(Math.max(0, index - 2), index + 1); return near.reduce((sum, value) => sum + value, 0) / near.length })
const line = (values: readonly number[], least: number) => {
  const top = Math.max(least, ...values)
  return values.map((value, index) => `${(index / (values.length - 1) * 100).toFixed(1)},${(19 - value / top * 17).toFixed(1)}`).join(' ')
}
const peopleLine = computed(() => line(people.value, 4))
const totalLine = computed(() => line(smooth(total.value), 8))
// The four creatures share one scale, so their charts compare.
const shared = computed(() => Math.max(4, ...creatureKinds.flatMap(kind => smooth(rates.value[kind]))))
const kindLine = (kind: Creature) => line(smooth(rates.value[kind]), shared.value)

// The last change of the count, as one line of a log.
const last = ref('')
watch(() => experiment.tally, (now, before) => {
  const gained = creatureKinds.filter(kind => now[kind] > before[kind]).map(kind => `+${now[kind] - before[kind]} ${creatures[kind]}`)
  if (gained.length) last.value = gained.join('  ')
})
// The fault names the count at which the run went critical, as a kernel names its clock.
const stamp = (step: number) => `[${String(count.value).padStart(5)}.0000${step}]`
</script>

<template>
  <div class="computer">
  <section class="counter" :class="{ shown }" :data-stage="stage" aria-label="Specimen loader" :inert="!shown">
    <!-- The run goes critical: lock phones on an unmistakable in-world alarm so every eye snaps up to the room. -->
    <div v-if="critical" class="panic" role="alert">
      <p class="alarm-badge">CHAMBER OVERLOAD</p>
      <p class="alarm-look">LOOK UP NOW</p>
      <p class="alarm-sub">{{ stamp(0) }} Do not press any key. Chamber 01 is breaching.</p>
      <button v-if="revealed" class="enter-cave" type="button" @click="emit('enter')">
        Enter the 18th Dimension
      </button>
    </div>
    <div v-else class="board">
      <header>
        <p class="host"><i class="lamp" :class="{ live: online }" aria-hidden="true" /><strong>chamber-01</strong><span>MISSION: IMPRESS ALIEN JAYDE (30)</span></p>
        <p class="people" role="status">
          <svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><polyline :points="peopleLine" /></svg>
          {{ online ? `${connected} in the office` : 'Reconnecting…' }}
        </p>
      </header>
      <div class="load" :data-level="percent >= 90 ? 'high' : percent >= 75 ? 'warm' : 'calm'">
        <p class="percent" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="percent" :aria-valuetext="`${percent}% of specimens loaded`">
          <strong>{{ percent }}<small>%</small></strong>
        </p>
        <p class="detail"><span>of specimens loaded</span><span>{{ digits.format(count) }} / {{ digits.format(experiment.target) }}</span></p>
        <p class="rate" aria-hidden="true">
          <svg viewBox="0 0 100 20" preserveAspectRatio="none"><polygon :points="`0,20 ${totalLine} 100,20`" /><polyline :points="totalLine" /></svg>
          <span>+{{ rate }}/s</span>
        </p>
        <div class="bar" aria-hidden="true"><i :style="{ width: `${Math.min(100, 100 * count / experiment.target)}%` }" /></div>
      </div>
      <div class="keys">
        <button v-for="kind in creatureKinds" :key="kind" type="button" :data-kind="kind" :disabled="!online" :aria-label="`Add a ${kind}. ${experiment.tally[kind]} so far.`"
          @pointerdown.prevent="press(kind)" @click="click(kind, $event)">
          <span class="key-head" aria-hidden="true"><span class="glyph">{{ creatures[kind] }}</span><strong>{{ digits.format(experiment.tally[kind]) }}</strong></span>
          <svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><polygon :points="`0,20 ${kindLine(kind)} 100,20`" /><polyline :points="kindLine(kind)" /></svg>
        </button>
      </div>
      <!-- A warning takes the whole line, so a phone shows all of it. -->
      <p v-if="stage !== 'Calm'" class="log"><strong class="warn" role="status">{{ warnings[stage] }}</strong></p>
      <p v-else class="log" aria-hidden="true"><span>$ tail -f chamber.log</span>{{ last }}</p>
    </div>
    <div class="static" aria-hidden="true" />
  </section>
  <!-- The way back to the room stands under the glass, on the monitor's own plastic, where a thumb finds it. -->
  <button class="leave" :class="{ shown: shown && !critical }" type="button" :inert="!shown || critical" @click="emit('leave')"><span aria-hidden="true">←</span> Back to the room</button>
  </div>
</template>

<style scoped>
/* The screen fills the glass, so its sizes follow the width of the glass. Without WebGL it stands in the middle of the page. */
.counter { --ground: #0a100e; --panel: #101a16; --rule: #24382f; --text: #cfe3d2; --dim: #7d9584; --green: #7ee787; --amber: #e3b341; --cyan: #56d4dd; --rose: #ff8b7e;
  position: fixed; z-index: 3; left: var(--crt-left, calc(50vw - min(40vw, 17rem))); top: var(--crt-top, 30vh); width: var(--crt-width, min(80vw, 34rem)); height: var(--crt-height, auto);
  container-type: inline-size; box-sizing: border-box; display: flex; overflow: hidden; color: var(--text); background: var(--ground); border-radius: 2.5% / 3.5%; box-shadow: inset 0 0 1rem #05140b99;
  font-family: var(--font-mono, ui-monospace, monospace); opacity: 0; pointer-events: none; transition: opacity .2s ease-out; }
.counter.shown { opacity: var(--crt-ready, 1); pointer-events: auto; }
/* The tube is old. Fine static jumps over the picture a few times a second. The static is its own drawing, so no image loads. */
.static { position: absolute; inset: 0; z-index: 2; overflow: hidden; pointer-events: none; }
.static::before { content: ''; position: absolute; inset: -50%; opacity: .1; mix-blend-mode: screen; animation: counter-static .56s steps(1) infinite;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1.5 -.4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
@keyframes counter-static { 0% { translate: 0 0; } 12% { translate: -7% 4%; } 25% { translate: 5% -9%; } 37% { translate: -11% -3%; } 50% { translate: 8% 7%; } 62% { translate: -4% 11%; } 75% { translate: 10% -6%; } 87% { translate: -9% 9%; } }
/* Scan lines lie over the picture, and a faint band of light rolls down the tube. Their pitch follows the size of the glass. */
.static::after { content: ''; position: absolute; inset: 0; animation: counter-roll 6s linear infinite;
  background: repeating-linear-gradient(#0000 0 .7cqw, #00000026 .7cqw 1cqw), linear-gradient(#fff0, #ffffff10 50%, #fff0) 0 -30% / 100% 24% no-repeat; }
@keyframes counter-roll { to { background-position: 0 0, 0 130%; } }
/* The static rises as the computer fails. */
.counter:has(.panic) .static::before { opacity: .24; }
/* Near the target the tube picks up more static, and the picture jumps now and then. In the warning the picture jumps more often. */
.counter[data-stage='Unstable'] .static::before { opacity: .16; } .counter[data-stage='Warning'] .static::before { opacity: .22; }
.counter[data-stage='Unstable'] .board { animation: counter-jolt 5s steps(1) infinite; } .counter[data-stage='Warning'] .board { animation: counter-jolt 2.4s steps(1) infinite; }
@keyframes counter-jolt { 0%, 4%, 100% { translate: 0 0; } 1% { translate: .8cqw -.3cqw; } 2% { translate: -.6cqw .2cqw; } 3% { translate: .3cqw 0; } }
.leave { position: fixed; z-index: 3; left: calc(var(--crt-left, 50vw - 5.5rem) + var(--crt-width, 11rem) / 2); top: calc(var(--crt-top, 30vh) + var(--crt-height, 20rem) + max(10px, var(--crt-height, 0px) * .07)); translate: -50% 0;
  display: flex; align-items: center; gap: .5em; min-height: 44px; padding: 0 1.1em; color: #2c2a1f; background: linear-gradient(#efe6c3, #d6cba3); border: 1px solid #8f8565; border-bottom-width: 3px; border-radius: 6px;
  box-shadow: 0 2px 8px #0006; font: 600 15px/1 var(--font-mono, ui-monospace, monospace); white-space: nowrap; cursor: pointer; touch-action: manipulation; opacity: 0; pointer-events: none; transition: opacity .2s ease-out; }
.leave.shown { opacity: var(--crt-ready, 1); pointer-events: auto; }
.leave:hover { background: linear-gradient(#f7efd0, #e0d5ae); }
.leave:active { translate: -50% 1px; border-bottom-width: 2px; }
.leave:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
p { margin: 0; }
svg { display: block; overflow: visible; }
polyline { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
polygon { fill: currentColor; opacity: .16; }
/* The glass is the container, so only what is inside it can take its sizes from it. */
.board { flex: 1; display: flex; flex-direction: column; justify-content: space-between; gap: 1.6cqw; min-width: 0; padding: 3cqw 3.4cqw 2.4cqw; font-size: 3.1cqw; line-height: 1.2;
  /* The phosphor glows a little past each letter. */
  text-shadow: 0 0 1.4cqw color-mix(in srgb, currentColor 40%, transparent); }
header { display: flex; align-items: center; justify-content: space-between; gap: 2cqw; }
.host { display: flex; align-items: center; gap: 1.6cqw; min-width: 0; white-space: nowrap; }
.host strong { color: var(--green); }
.host span { color: var(--dim); overflow: hidden; text-overflow: ellipsis; }
/* The lamp of a service that is up. It is amber while the connection is down. */
.lamp { flex: none; width: 1.8cqw; height: 1.8cqw; border-radius: 50%; background: var(--amber); }
.lamp.live { background: var(--green); box-shadow: 0 0 1.4cqw var(--green); animation: counter-lamp 2.4s ease-in-out infinite; }
@keyframes counter-lamp { 50% { opacity: .45; } }
.people { display: flex; align-items: center; gap: 1.6cqw; color: var(--cyan); white-space: nowrap; font-variant-numeric: tabular-nums; }
.people svg { width: 17cqw; height: 4.4cqw; }
.load { --level: var(--green); display: grid; grid-template-columns: auto 1fr 30%; align-items: center; gap: 1.4cqw 2.6cqw; padding: 2cqw 2.6cqw 2.4cqw; background: var(--panel); border: 1px solid var(--rule); border-radius: 1.6cqw; }
/* The load turns amber at three quarters and rose at nine tenths. */
.load[data-level='warm'] { --level: var(--amber); } .load[data-level='high'] { --level: var(--rose); }
.percent strong { color: var(--level); font-size: 12.5cqw; line-height: .9; letter-spacing: -.05em; font-variant-numeric: tabular-nums; }
.percent small { font-size: .5em; letter-spacing: 0; }
.detail { display: flex; flex-direction: column; gap: .8cqw; color: var(--dim); white-space: nowrap; font-variant-numeric: tabular-nums; }
.detail span:last-child { color: var(--text); }
.rate { position: relative; color: var(--green); }
.rate svg { width: 100%; height: 8.6cqw; }
.rate span { position: absolute; left: 0; top: -.6cqw; font-size: 2.7cqw; font-variant-numeric: tabular-nums; }
/* The bar is cut into cells, as the load bars of a terminal are. */
.bar { grid-column: 1 / -1; height: 3cqw; background: #18261f; mask-image: repeating-linear-gradient(90deg, #000 0 1.5cqw, transparent 1.5cqw 2cqw); }
.bar i { display: block; height: 100%; background: var(--level); transition: width .15s linear; }
.keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.6cqw; }
.keys button { display: flex; flex-direction: column; justify-content: space-between; gap: 1cqw; min-width: 0; min-height: 44px; height: 21cqw; padding: 1.6cqw 1.8cqw 1.4cqw; color: var(--kind); background: var(--panel);
  border: 1px solid var(--rule); border-bottom-color: color-mix(in srgb, var(--kind) 55%, var(--rule)); border-radius: 1.6cqw; font: inherit; cursor: pointer; touch-action: manipulation; user-select: none; -webkit-tap-highlight-color: transparent; }
.keys button[data-kind='snail'] { --kind: var(--amber); } .keys button[data-kind='beetle'] { --kind: var(--green); } .keys button[data-kind='fly'] { --kind: var(--cyan); } .keys button[data-kind='cricket'] { --kind: var(--rose); }
/* A pressed key lights in its creature's colour. */
.keys button:active:enabled { translate: 0 1px; border-color: var(--kind); background: color-mix(in srgb, var(--kind) 18%, var(--panel)); }
.keys button:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
.keys button:disabled { cursor: default; opacity: .55; }
.key-head { display: flex; align-items: center; justify-content: space-between; gap: 1cqw; }
.glyph { font-size: 6.4cqw; line-height: 1; }
.key-head strong { color: var(--text); font-size: 3.6cqw; font-variant-numeric: tabular-nums; }
.keys button svg { width: 100%; height: 6.4cqw; }
.log { display: flex; gap: 2cqw; overflow: hidden; color: var(--text); font-size: 2.7cqw; white-space: nowrap; }
.log span { color: var(--dim); }
.log .warn { color: var(--amber); font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
/* The warning blinks once a second. */
.counter[data-stage='Warning'] .log .warn { color: var(--rose); animation: counter-warn 1s steps(1) infinite; }
@keyframes counter-warn { 50% { opacity: .35; } }
.panic { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: 3cqw; padding: 4cqw; color: #f4ebe8; background: radial-gradient(circle at 50% 45%, #2b0907, #090404 72%); font-size: 3cqw; line-height: 1.3; }
.alarm-badge { padding: 1cqw 2.4cqw; border: 2px solid var(--rose); color: var(--rose); font-size: 3.6cqw; font-weight: 700; letter-spacing: .12em; animation: counter-warn 1s steps(1) infinite; }
.alarm-look { color: #fff; font-size: 11cqw; font-weight: 800; line-height: 1; letter-spacing: .04em; text-shadow: 0 0 2.4cqw var(--rose); }
.alarm-sub { color: #d7c0bb; font-size: 2.8cqw; max-width: 34ch; }
.enter-cave { margin-top: 2cqw; min-height: 44px; padding: 1.8cqw 3.4cqw; color: var(--ground); background: var(--green); border: 1px solid var(--green); border-radius: 6px; font: 700 3cqw/1.2 var(--font-mono, ui-monospace, monospace); cursor: pointer; touch-action: manipulation; }
.enter-cave:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
/* On a narrow portrait phone the glass is too small for thumbs. The view goes all the way into the tube, and the screen fills the phone.
   Its sizes have a floor in pixels, so no text a visitor reads is smaller than 13px. */
@media (max-width: 640px) and (orientation: portrait) {
  polyline { stroke-width: 2; }
  .counter { left: 0; top: 0; width: 100%; height: 100dvh; border-radius: 0; box-shadow: inset 0 0 3rem #000b;
    /* Fast taps do not zoom the page or select text. */
    touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
  /* The static layer is smaller on a phone. Its jumps move it by 16% of the screen at most, so a margin of 25% still covers the screen. */
  .static::before { inset: -25%; }
  /* The way back stands at the top, far from the keys, so a busy thumb does not leave the computer by accident. */
  .leave { left: max(16px, env(safe-area-inset-left)); top: max(16px, env(safe-area-inset-top)); translate: none; }
  .leave:active { translate: 0 1px; }
  /* The board keeps a row at the top for the way back. */
  .board { justify-content: flex-start; gap: 12px; padding: calc(max(16px, env(safe-area-inset-top)) + 56px) max(16px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    font-size: clamp(14px, 4cqw, 17px); line-height: 1.25; }
  /* The header stays one line. The chart of people takes the space that the words leave. On a very narrow phone the name of the service gives way. */
  header { gap: 10px; font-size: clamp(13px, 3.7cqw, 16px); }
  .host { gap: 8px; }
  .lamp { width: 9px; height: 9px; }
  .people { flex: 1 1 0; justify-content: flex-end; gap: 8px; }
  .people svg { flex: 1 1 auto; width: 24px; max-width: 96px; height: 18px; }
  /* The load takes the height that the keys leave, and its chart of the rate grows into it. */
  .load { flex: 1 1 auto; grid-template-columns: auto 1fr; grid-template-rows: auto 1fr auto; gap: 10px 14px; padding: 12px 14px 14px; border-radius: 8px; }
  .percent strong { font-size: clamp(52px, 17cqw, 84px); }
  .detail { gap: 4px; }
  .rate { grid-column: 1 / -1; align-self: stretch; min-height: clamp(36px, 12cqw, 60px); }
  .rate svg { height: 100%; }
  .rate span { top: -2px; font-size: max(13px, 3.4cqw); }
  .bar { height: 12px; mask-image: repeating-linear-gradient(90deg, #000 0 6px, transparent 6px 8px); }
  /* The keys take the lower half of the screen, where thumbs reach. On a short screen they give up height first. */
  .keys { flex: 0 1 50dvh; min-height: 0; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .keys button { height: auto; min-height: 72px; gap: 6px; padding: 12px 14px 10px; overflow: hidden; border-bottom-width: 3px; border-radius: 10px; }
  .key-head { flex-direction: column; align-items: flex-start; gap: 4px; }
  .glyph { font-size: clamp(36px, 12cqw, 56px); }
  .key-head strong { font-size: clamp(24px, 8cqw, 36px); }
  .keys button svg { flex: 1 1 0; min-height: 16px; max-height: 50%; height: auto; }
  .log { gap: 10px; font-size: max(13px, 3.6cqw); }
  .panic { gap: 18px; padding: max(24px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left));
    font-size: clamp(15px, 4.4cqw, 19px); line-height: 1.4; overflow-wrap: anywhere; }
  .alarm-badge { padding: 6px 14px; font-size: clamp(16px, 5cqw, 22px); }
  .alarm-look { font-size: clamp(42px, 14cqw, 68px); }
  .alarm-sub { font-size: clamp(14px, 4cqw, 18px); }
  .enter-cave { padding: 12px 20px; font-size: clamp(15px, 4.2cqw, 18px); }
}
/* A short phone, or a phone with its browser bars open, has less height for the keys. Each key then puts its creature beside its count. */
@media (max-width: 640px) and (orientation: portrait) and (max-height: 680px) {
  .key-head { flex-direction: row; align-items: center; justify-content: space-between; gap: 6px; }
  .glyph { font-size: clamp(30px, 9cqw, 40px); }
  .key-head strong { font-size: clamp(22px, 7cqw, 30px); }
}
@media (prefers-reduced-motion: reduce) { .counter, .leave, .bar i { transition: none; } .static::before, .static::after, .lamp.live, .board, .log .warn, .alarm-badge { animation: none !important; } }
</style>
