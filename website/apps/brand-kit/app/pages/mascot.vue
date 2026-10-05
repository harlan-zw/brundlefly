<script setup lang="ts">
import { computed, ref } from 'vue'

const texture = ref<'mapped' | 'sprite'>('mapped')
const clip = ref<'Manual' | 'Idle' | 'Walk' | 'Speaking'>('Manual')
const playing = ref(false)
const speed = ref(1)
const time = ref(0)
const durations = ref<Record<string, number>>({ Idle: 4.8, Walk: 1.2, Speaking: 3.2 })
const duration = computed(() => durations.value[clip.value] ?? 0)
const bones = ref(false)
const wireframe = ref(false)
const speech = ref(0)
const blink = ref(0)
const brow = ref(0)
const squint = ref(0)
function selectClip() { playing.value = false; time.value = 0 }
function manual() { clip.value = 'Manual'; playing.value = false; time.value = 0 }
</script>

<template>
  <main class="mascot-inspector">
    <header><NuxtLink to="/">Brand kit</NuxtLink><h1>Mascot</h1><span>Brundlefly</span></header>
    <div class="inspector-layout">
      <section class="inspector-stage" aria-label="Brundlefly">
        <LazyBrandOrganism :key="texture" v-model:clip-time="time" mascot inspector exportable :interactive="false" motion-off
          :texture-mode="texture" :clip="clip" :playing="playing" :playback-speed="speed" :bones="bones" :wireframe="wireframe"
          :speaking="speech" :blink="blink" :brow="brow" :squint="squint" @clips="durations = $event" />
        <p>Drag to orbit. Scroll to zoom.</p>
      </section>
      <aside class="inspector-controls">
        <label for="inspector-texture">Texture</label>
        <select id="inspector-texture" v-model="texture" @change="selectClip"><option value="mapped">Mapped</option><option value="sprite">Sprite</option></select>
        <div class="toggles"><label><input v-model="bones" type="checkbox"> Bones</label><label><input v-model="wireframe" type="checkbox"> Wireframe</label></div>
        <label for="inspector-clip">Clip</label>
        <select id="inspector-clip" v-model="clip" @change="selectClip"><option>Manual</option><option>Idle</option><option>Walk</option><option>Speaking</option></select>
        <UButton :disabled="clip === 'Manual'" variant="outline" :aria-pressed="playing" @click="playing = !playing">{{ playing ? 'Pause' : 'Play' }}</UButton>
        <label for="inspector-speed">Speed <output>{{ speed.toFixed(2) }}</output></label>
        <input id="inspector-speed" v-model.number="speed" type="range" min="0.25" max="2" step="0.25">
        <label for="inspector-time">Time <output>{{ time.toFixed(2) }} / {{ duration.toFixed(2) }}</output></label>
        <input id="inspector-time" v-model.number="time" :disabled="clip === 'Manual'" type="range" min="0" :max="duration" step="0.01" @pointerdown="playing = false" @keydown="playing = false">
        <label for="inspector-speech">Speech <output>{{ speech.toFixed(2) }}</output></label><input id="inspector-speech" v-model.number="speech" type="range" min="0" max="1" step="0.05" @input="manual">
        <label for="inspector-blink">Blink <output>{{ blink.toFixed(2) }}</output></label><input id="inspector-blink" v-model.number="blink" type="range" min="0" max="1" step="0.05" @input="manual">
        <label for="inspector-brow">Brow <output>{{ brow.toFixed(2) }}</output></label><input id="inspector-brow" v-model.number="brow" type="range" min="0" max="1" step="0.05" @input="manual">
        <label for="inspector-squint">Squint <output>{{ squint.toFixed(2) }}</output></label><input id="inspector-squint" v-model.number="squint" type="range" min="0" max="1" step="0.05" @input="manual">
      </aside>
    </div>
  </main>
</template>

<style scoped>
.mascot-inspector{min-height:100svh;background:#080b08;color:#e8d4a6;padding:clamp(16px,3vw,40px)}
header{display:flex;align-items:center;gap:24px;margin-bottom:24px}header a{color:inherit;text-decoration:underline}header h1{font-size:32px;line-height:1;margin:0}header span{margin-left:auto;color:#a4b5a0}
.inspector-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:28px;max-width:1600px;margin:auto}
.inspector-stage{min-width:0}.inspector-stage :deep(.brand-organism){height:min(76svh,800px);min-height:420px;background:#101510;border:1px solid #69404b;border-radius:32px 8px}
.inspector-stage p{font-size:12px;color:#a4b5a0;margin:12px 0}.inspector-controls{display:flex;flex-direction:column;gap:12px;background:#101510;border:1px solid #343c3b;padding:20px;align-self:start;border-radius:8px 24px}
.inspector-controls label{display:flex;gap:8px;align-items:center;font-size:14px}.inspector-controls output{margin-left:auto;color:#a4b5a0;font-variant-numeric:tabular-nums}.inspector-controls select{background:#080b08;color:inherit;border:1px solid #69404b;padding:8px;border-radius:4px;min-height:40px}
.inspector-controls input[type=range]{width:100%;accent-color:#e8d4a6;min-height:26px}.toggles{display:flex;gap:20px}.toggles input{accent-color:#e8d4a6}input:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid #e8d4a6;outline-offset:3px}
@media(max-width:720px){.inspector-layout{grid-template-columns:1fr;gap:16px}.inspector-stage :deep(.brand-organism){height:52svh;min-height:340px}header{gap:16px}header h1{font-size:26px}header span{font-size:12px}.inspector-controls{padding:16px}}
</style>
