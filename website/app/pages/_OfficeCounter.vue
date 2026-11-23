<script setup lang="ts">
import { computed, ref } from 'vue'
import { useVibrate } from '@vueuse/core'
import { creatureKinds, creatures, specimenCount } from '#shared/office-experiment'
import type { Creature, Experiment } from '#shared/office-experiment'

// The specimen counter on the glass of the desk computer. The scene gives the place of the glass, and each key adds one specimen for everyone.
const { experiment, connected, online, shown } = defineProps<{ experiment: Experiment, connected: number, online: boolean, shown: boolean }>()
const emit = defineEmits<{ tap: [kind: Creature] }>()
const count = computed(() => specimenCount(experiment))
const critical = computed(() => experiment.criticalAt !== null)
const digits = new Intl.NumberFormat('en')
const { vibrate } = useVibrate({ pattern: 8 })
// Each press sends one creature up from its key, so a fast hand sees every tap land.
type Pop = { id: number, kind: Creature, drift: number }
const pops = ref<Pop[]>([])
let popped = 0
function press(kind: Creature) {
  if (!online || critical.value) return
  emit('tap', kind)
  vibrate()
  pops.value = [...pops.value.slice(-11), { id: popped++, kind, drift: Math.round((Math.random() - 0.5) * 60) }]
}
// A pointer presses on the way down, so two thumbs can work the keys. The keyboard and a screen reader press with a click.
const click = (kind: Creature, event: MouseEvent) => { if (event.detail === 0) press(kind) }
</script>

<template>
  <section class="counter" :class="{ shown, critical }" aria-label="Specimen counter" :inert="!shown">
    <header>
      <strong>{{ critical ? 'Critical' : 'Specimen counter' }}</strong>
      <span role="status">{{ online ? `${connected} in the office` : 'Reconnecting…' }}</span>
    </header>
    <p class="count"><strong>{{ digits.format(count) }}</strong> <small>/ {{ digits.format(experiment.target) }}</small></p>
    <div class="track" aria-hidden="true"><i :style="{ width: `${Math.min(100, 100 * count / experiment.target)}%` }" /></div>
    <div class="keys">
      <button v-for="kind in creatureKinds" :key="kind" type="button" :disabled="!online || critical"
        :aria-label="`Add a ${kind}. ${experiment.tally[kind]} so far.`" @pointerdown.prevent="press(kind)" @click="click(kind, $event)">
        <span class="glyph" aria-hidden="true">{{ creatures[kind] }}</span>
        <small aria-hidden="true">{{ digits.format(experiment.tally[kind]) }}</small>
        <i v-for="pop in pops.filter(pop => pop.kind === kind)" :key="pop.id" class="pop" :style="{ '--drift': `${pop.drift}px` }" aria-hidden="true"
          @animationend="pops = pops.filter(other => other.id !== pop.id)">{{ creatures[kind] }}</i>
      </button>
    </div>
  </section>
</template>

<style scoped>
/* The counter fills the glass, so its sizes follow the width of the glass. Without WebGL it stands in the middle of the page. */
.counter { position: fixed; z-index: 3; left: var(--crt-left, calc(50vw - min(40vw, 17rem))); top: var(--crt-top, 30vh); width: var(--crt-width, min(80vw, 34rem)); height: var(--crt-height, auto);
  container-type: inline-size; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; overflow: hidden; padding: 0 5.5%;
  color: #deecd4; background: radial-gradient(ellipse at 45% 35%, #20392c, #11251e 70%, #0b1914); border-radius: 2.5% / 3.5%; box-shadow: inset 0 0 1rem #05140b99;
  font-family: var(--font-mono, monospace); opacity: 0; pointer-events: none; transition: opacity .2s ease-out; }
.counter.shown { opacity: var(--crt-ready, 1); pointer-events: auto; }
header { display: flex; justify-content: space-between; align-items: baseline; gap: .4em; padding-bottom: 1.4cqw; border-bottom: 1px solid #658369; font-size: 4.4cqw; line-height: 1.2; }
header strong { color: #e0efd5; letter-spacing: -.02em; }
header span { color: #bfdfc1; font-size: max(11px, 3cqw); white-space: nowrap; }
.count { display: flex; align-items: baseline; gap: 2cqw; margin: 2.6cqw 0 2cqw; line-height: 1; font-variant-numeric: tabular-nums; }
.count strong { color: #ddf4d4; font-size: 13.4cqw; letter-spacing: -.05em; }
.count small { color: #98b39b; font-size: 4cqw; }
.track { flex: none; height: 1.3cqw; margin-bottom: 2.6cqw; background: #39463b; }
.track i { display: block; height: 100%; background: #96c79c; transition: width .12s linear; }
.keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.4cqw; }
button { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 44px; height: 15cqw; padding: 1cqw .5cqw;
  color: inherit; background: #263f32; border: 1px solid #8ca88f; border-bottom-width: 3px; border-radius: 3px; box-shadow: inset 0 1px #82958033;
  font: inherit; cursor: pointer; touch-action: manipulation; user-select: none; -webkit-tap-highlight-color: transparent; }
button:active:enabled { translate: 0 1px; background: #406747; }
button:focus-visible { outline: 2px solid #e8d293; outline-offset: 2px; }
button:disabled { cursor: default; border-color: #596e5e; }
button:disabled .glyph { opacity: .55; }
.glyph { font-size: 6.4cqw; line-height: 1.1; }
button small { color: #d6e1cc; font-size: max(11px, 3.2cqw); font-variant-numeric: tabular-nums; }
.pop { position: absolute; left: 50%; top: 0; font-style: normal; font-size: 5cqw; pointer-events: none; animation: counter-pop .55s ease-out both; }
@keyframes counter-pop { from { opacity: 1; transform: translate(-50%, 0) scale(.7); } to { opacity: 0; transform: translate(calc(-50% + var(--drift)), -12cqw) scale(1.1); } }
.critical { color: #f0d2c4; background: radial-gradient(ellipse at 45% 35%, #3f211b, #2a1512 70%, #1c0d0b); }
.critical header { border-color: #8a5144; } .critical header strong, .critical .count strong { color: #f0b59c; }
.critical .track i { background: #f0b59c; }
@media (prefers-reduced-motion: reduce) { .counter, .track i { transition: none; } .pop { display: none; } }
</style>
