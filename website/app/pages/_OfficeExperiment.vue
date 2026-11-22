<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { creatures, critical, warning, voteTotals } from '#shared/office-experiment'
import type { Creature } from '#shared/office-experiment'
import type { useOfficeExperiment } from '../composables/useOfficeExperiment'
const props = defineProps<{ office: ReturnType<typeof useOfficeExperiment>, presenter: boolean, muted: boolean, awakeInCave: boolean }>()
const emit = defineEmits<{ sound: [], wake: [], leave: [], reset: [] }>()
const { room, readyAt, host, stage, station, count, connected, online, error, now, rehearsal, tap } = props.office
const key = ref('')
const dismissed = ref('')
const awakeAt = ref(0)
const totals = computed(() => voteTotals(room.value))
const firstFault = computed(() => room.value?.drops.find(drop => drop.size > 1))
const end = computed(() => room.value?.drops.at(-1)?.at ?? 0)
const show = computed(() => room.value && dismissed.value !== room.value.id && (!props.presenter || host.value))
const age = computed(() => now.value - end.value)
const line = computed(() => {
  if (stage.value === 'awake') return !props.awakeInCave ? '' : now.value - awakeAt.value < 2400 ? 'There you are.' : 'One.'
  if (stage.value === 'critical') return 'That hum. Take your hand off the desk.'
  if (firstFault.value) return now.value - firstFault.value.at < 4300 ? 'Hang on. Everybody press beetle.' : 'Right. I’m going to need a bucket.'
  if (stage.value === 'calibration') return 'One. We agree.'
  if (stage.value === 'running') return ''
  if (station.value === 'computer') return 'Start with the snail. I can check that one by eye.'
  return connected.value ? 'You brought help. Good. Last time you had to press the button with your chin.' : 'There’s your mug. Same ring on the desk. I set up our counter.'
})
watch(stage, next => {
  if (next === 'awake') emit('wake')
}, { immediate: true })
watch(() => props.awakeInCave, awake => { if (awake) awakeAt.value = now.value })
watch(() => room.value?.id, id => { if (id) dismissed.value = '' })
function press(kind: Creature) { tap(kind) }
function close() {
  if (host.value) { props.office.close(); emit('reset') }
  else { dismissed.value = room.value?.id ?? ''; emit('leave') }
}
function authenticate() { props.office.authenticate(key.value); key.value = '' }
useEventListener('keydown', event => { if (event.key === 'Escape' && show.value) station.value = 'desk' })
</script>
<template>
  <section v-if="show || presenter" class="experiment" aria-label="Office experiment" :data-phase="stage" :data-view="station" :data-warning="count >= warning">
    <template v-if="show">
      <div v-if="stage === 'critical'" class="outage" :class="{ dark: age > 4250, shake: age > 1900 && age < 4100 }" aria-hidden="true" />
      <p v-if="line" class="voice" role="status"><b>Brundlefly</b>{{ line }}</p>
      <div v-if="station === 'board' && (stage === 'lobby' || stage === 'running')" class="board">
        <img src="/brand/office/experiment/whiteboard-join.png" alt="Scan to join the office">
        <a href="/office" target="_blank" rel="noopener">brundlefly.dev/office</a>
      </div>
      <article v-if="stage !== 'awake'" class="console" :class="{ compact: station !== 'computer' }" aria-label="Specimen counter">
        <header><strong>Specimen counter</strong><span><i :class="{ live: online }" />{{ rehearsal ? '20 simulated' : online ? connected + ' connected' : 'Reconnecting…' }}</span></header>
        <div class="meter" :aria-label="count + ' specimens'">
          <strong>{{ count }} <small>/ {{ critical }}</small></strong>
          <dl class="limits"><div><dt>Warning</dt><dd>{{ warning }}</dd></div><div><dt>Critical</dt><dd>{{ critical }}</dd></div></dl>
        </div>
        <div class="track" aria-hidden="true"><i :style="{ width: 100 * count / critical + '%' }" /><u /></div>
          <footer><span>Votes</span><span v-if="stage === 'running' && now < readyAt">Next vote in {{ Math.ceil((readyAt - now) / 1000) }}s</span></footer>
        <div class="votes">
          <button v-for="(emoji, kind) in creatures" :key="kind" type="button"
            :disabled="!online || now < readyAt || !(stage === 'running' || (host && stage === 'lobby' && station === 'computer' && kind === 'snail'))"
            :aria-label="'Add a ' + kind + ', ' + totals[kind] + ' votes'" @click="press(kind)">
            <span class="glyph" aria-hidden="true">{{ emoji }}</span>
            <small>{{ totals[kind] }}</small>
            <span v-if="totals[kind]" :key="totals[kind]" class="confetti" aria-hidden="true">
              <i v-for="n in 3" :key="n" :style="{ '--drift': (n - 2) * 28 + 'px', '--turn': (n - 2) * 32 + 'deg' }">{{ emoji }}</i>
            </span>
          </button>
        </div>

      </article>
      <nav v-if="host && (stage === 'lobby' || stage === 'running')" aria-label="Office views">
        <button :aria-pressed="station === 'board'" @click="station = 'board'">Board</button><button :aria-pressed="station === 'computer'" @click="station = 'computer'">Computer</button><button :aria-pressed="station === 'desk'" @click="station = 'desk'">Desk</button>
        <button @click="emit('sound')">{{ muted ? 'Sound on' : 'Sound off' }}</button>
      </nav>
      <button v-if="stage === 'awake' && awakeInCave" class="finish" @click="close">{{ host ? 'Reset experiment' : 'Explore the cave' }}</button>
    </template>
    <form v-else class="setup" @submit.prevent="host ? office.open() : authenticate()">
      <h2>Office experiment</h2>
      <label v-if="!host">Presenter key<input v-model="key" type="password" autocomplete="off" required></label>
      <p v-if="error" role="alert">{{ error }}</p>
      <button :disabled="!online">{{ host ? 'Open the office' : online ? 'Sign in' : 'Connecting…' }}</button>
    </form>
  </section>
</template>
<style scoped>
.experiment { position: fixed; inset: 0; pointer-events: none; z-index: 5; color: #e8e6c9; font: 14px/1.35 var(--font-mono, monospace); }
button, a, input, nav, form, article { pointer-events: auto; }
button, input, .board a { border: 1px solid #747b67; background: #18221f; color: #eef2d9; padding: .52rem .75rem; font: inherit; }
button { cursor: pointer; } button:disabled { cursor: default; color: #a9b2a1; }
button:enabled:hover, button:enabled:focus-visible { background: #365347; }
.setup, .console { background: #101815 url('/brand/office/experiment/crt-glass.png') center/100% 100%; border: 2px solid #64746a; box-shadow: 3px 4px 0 #0a0d0a, inset 0 0 0 2px #28312c; }
.setup { position: absolute; top: 52%; left: 50%; transform: translate(-50%,-50%); padding: 1.6rem; display: grid; gap: 1rem; }
.setup h2 { font: bold 1.3rem var(--font-mono,monospace); margin: 0; }
.setup label, .setup input { display: block; }
.voice { position: absolute; z-index: 2; left: clamp(.5rem, calc(var(--speaker-x,42%) - min(15.5ch,41vw)), calc(100% - min(31ch,82vw) - .5rem)); top: var(--speaker-y,12%); width: min(31ch,82vw); box-sizing: border-box; margin: 0; padding: .62rem .9rem; background: #efe8ce; color: #222821; border: 2px solid #252a23; box-shadow: 3px 3px #191d18; font: 600 clamp(14px,1.65vw,23px)/1.24 system-ui,sans-serif; }
.voice b { display: block; font: 700 10px/1.5 monospace; text-transform: uppercase; color: #52624c; letter-spacing: .08em; }
.voice::after { content: ''; position: absolute; bottom: -8px; left: 44%; border: 8px solid transparent; border-top-color: #efe8ce; border-bottom: 0; }
.board { position: absolute; top: 46%; left: 50%; transform: translate(-50%,-50%); display: grid; justify-items: center; width: min(47vh, 76vw); }
.board img { width: 100%; image-rendering: pixelated; box-shadow: 0 1px 6px #111; }
.board a { background: #eee5cb; color: #15201a; font-weight: bold; }
.console { position: absolute; bottom: max(4.1rem,env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); padding: 1.05rem 1.3rem .65rem; width: min(26rem,calc(100% - 1rem)); box-sizing: border-box; }
.console.compact { left: auto; right: .8rem; transform: none; bottom: 1rem; width: min(19rem,95vw); }
header, .meter { display: flex; justify-content: space-between; align-items: center; gap: .65rem; }
header { color: #bfdfc1; } header span, .meter span, footer { font-size: .74rem; }
header i { display: inline-block; width: 6px; height: 6px; margin-right: 5px; border-radius: 50%; background: #a06b49; } header i.live { background: #a3da8f; }
.meter { margin: .38rem 0; } .meter strong { font: bold 1.9rem monospace; font-variant-numeric: tabular-nums; } .meter small { font-size: 1rem; color: #a3b29c; } .meter span { text-align: right; }
.track { position: relative; height: 4px; background: #39463b; margin: .5rem 0 .75rem; } .track i { display:block; height:100%; background:#96c79c; } .track u { position:absolute; left:25%; top:-2px; height:8px; width:2px; background:#e4b671; }
.votes { display: grid; grid-template-columns: repeat(4, 1fr); gap: .35rem; }
.votes button { display: grid; justify-items: center; position: relative; padding: .38rem .1rem; min-height: 44px; background: #202f28; border: 1px solid #596e5e; border-bottom: 3px solid #405347; }
.glyph { font-size: 1.55rem; } .votes small { font-variant-numeric:tabular-nums; color:#d6e1cc; } footer { text-align:center; margin-top:.25rem; color:#acb8a8; }
.confetti { position:absolute; left:50%; top:.2rem; pointer-events:none; } .confetti i { position:absolute; font-style:normal; animation:sprinkle .62s ease-out both; }
@keyframes sprinkle { from { opacity:.98; transform:translate(-50%,0) scale(.7); } to { opacity:0; transform:translate(calc(-50% + var(--drift)),-3rem) rotate(var(--turn)); } }
nav, .finish { position:absolute; bottom:1rem; left:.8rem; } nav { display:flex; gap:3px; }
.outage { position:absolute; inset:0; background: transparent; z-index:3; transition:background .35s; } .outage.shake { background:rgb(80 130 62 / .18); } .outage.dark { background:#050805; }
.experiment[data-phase=awake] .voice { top:20%; left:50%; transform:translateX(-50%); }
@media(min-width:721px) and (min-height:541px) { .experiment[data-view=computer] .console { top:51%; bottom:auto; transform:translate(-50%,-50%); } }
@media(max-width:720px) { .console,.console.compact { bottom:3.6rem; width:calc(100% - 1rem); left:.5rem; right:auto; transform:none; padding:.75rem .85rem .4rem; } nav { bottom:.5rem; } .board { top:36%; width:min(32vh,64vw); } .voice { top:7%; left:50%; transform:translateX(-50%); } }
@media(max-height:540px) and (orientation:landscape) { .console,.console.compact { width:17rem; left:auto; right:.5rem; transform:none; bottom:.5rem; } .board { left:27%; width:min(52vh,34vw); } .voice { top:3%; } }
@media(prefers-reduced-motion:reduce) { .confetti { inset:0; border:2px solid #c9ebba; animation:picked .45s step-end both; } .confetti i { display:none; } @keyframes picked { to { opacity:0; } } .outage { transition:none; } .outage.shake { background:transparent; } }

/* The close view lives in the CRT aperture. Keep the desk controls large enough for a phone. */
.console { background: radial-gradient(ellipse at 45% 35%,#20392c,#11251e 70%,#0b1914); color:#deecd4; font-family:monospace; }
.console header { border-bottom:1px solid #658369; padding-bottom:.45em; gap:.4em; }
.console header strong { color:#e0efd5; letter-spacing:-.025em; }
.console header span { white-space:nowrap; }
.limits { display:grid; gap:.13em; margin:0; font-size:.86em; }
.limits div { display:flex; align-items:baseline; justify-content:space-between; gap:.75em; }
.limits dt { color:#b8c9b5; }
.limits dd { margin:0; font-weight:700; font-variant-numeric:tabular-nums; }
.console .meter strong { color:#ddf4d4; line-height:1; }
.console footer { display:flex; justify-content:space-between; align-items:baseline; text-align:left; margin:.05em 0 .32em; }
.console footer span:first-child { text-transform:uppercase; letter-spacing:.13em; font-weight:bold; }
.console .votes button { border-radius:3px; background:#263f32; box-shadow:inset 0 1px #82958033; }
.console .votes button:enabled { border-color:#8ca88f; }
.console .votes button:enabled:active { transform:translateY(1px); background:#406747; }
.console .votes button:disabled .glyph { opacity:.62; }
.experiment[data-phase=lobby] .votes button:enabled { background:#3d5d40; outline:1px solid #b0cd8c; }
.console button:focus-visible, nav button:focus-visible { outline:2px solid #e8d293; outline-offset:2px; }
.experiment[data-warning=true] .track i { background:#e8bd77; }
nav button[aria-pressed=true], nav button[aria-pressed=true]:enabled:hover, nav button[aria-pressed=true]:enabled:focus-visible { color:#17251c; background:#ccdbc0; }
.experiment[data-view=computer] .console:not(.compact) { left:var(--crt-left,50%); top:var(--crt-top,32%); bottom:auto; right:auto;
  width:var(--crt-width,min(78vw,34rem)); height:var(--crt-height,auto); transform:none; visibility:var(--crt-visible,visible);
  container-type:inline-size; border:0; border-radius:2.5% / 3.5%; overflow:hidden; box-shadow:inset 0 0 1rem #05140b99;
  padding:0; display:flex; flex-direction:column; justify-content:center; }
.experiment[data-view=computer] .console > * { margin-left:5.5%; margin-right:5.5%; }
.experiment[data-view=computer] .console header { font-size:4.6cqw; line-height:1.2; }
.experiment[data-view=computer] .console header span { font-size:max(11px,3.05cqw); }
.experiment[data-view=computer] .meter { margin-top:3.4cqw; margin-bottom:2.5cqw; }
.experiment[data-view=computer] .meter strong { font-size:13.4cqw; letter-spacing:-.055em; font-family:monospace; }
.experiment[data-view=computer] .meter small { color:#98b39b; font-size:4cqw; letter-spacing:0; }
.experiment[data-view=computer] .limits { font-size:max(11px,3.2cqw); }
.experiment[data-view=computer] .track { height:1.25cqw; flex:none; margin-top:0; margin-bottom:2.5cqw; }
.experiment[data-view=computer] footer { font-size:max(11px,3.1cqw); }
.experiment[data-view=computer] .votes { gap:1.3cqw; }
.experiment[data-view=computer] .votes button { min-height:44px; height:14.5cqw; padding:1cqw .5cqw; display:flex; flex-direction:column; justify-content:center; align-items:center; }
.experiment[data-view=computer] .glyph { font-size:6.2cqw; line-height:1.1; }
.experiment[data-view=computer] .votes small { font-size:max(11px,3.25cqw); }
.experiment[data-view=computer] .voice { left:50%; top:auto; bottom:calc(100% - var(--crt-top,32%) + 1rem); transform:translateX(-50%); width:min(39ch,92vw); }
.experiment[data-view=computer] .voice::after { left:auto; right:1.3rem; bottom:50%; border:0; width:0; height:0; transform:translate(2.05rem,50%); border-top:6px solid transparent; border-bottom:6px solid transparent; border-left:11px solid #efe8ce; }
.board img { image-rendering:auto; }
:global(main:has(.world-scene[data-renderer=Ready]) .experiment .board) { top:var(--board-bottom,75%); left:var(--board-x,50%); width:max-content; transform:translateX(-50%); }
:global(main:has(.world-scene[data-renderer=Ready]) .experiment .board img) { display:none; }
.board a { font-size:clamp(12px,1.25vw,19px); padding:.25em .7em; }
:global(main:has(.world-scene[data-renderer=Fallback]) .experiment[data-view=computer] .console) { left:50%; top:50%; height:auto; transform:translate(-50%,-50%); padding:1rem 0; visibility:visible; }
</style>
