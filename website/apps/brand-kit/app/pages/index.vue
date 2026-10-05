<script setup lang="ts">
import { computed, ref } from 'vue'
import { useClipboard, usePreferredReducedMotion } from '@vueuse/core'
import { defaultPreset, materials, palette, parts } from '@brundlefly/brand/shared/catalogue'
import type { Material } from '@brundlefly/brand/shared/catalogue'
import { transforms } from '@brundlefly/brand/shared/organism'
import type { Presentation, Transform } from '@brundlefly/brand/shared/organism'
import Composer from './_Composer.vue'
const { copy } = useClipboard({ legacy: true })
const copyFeedback = ref('')
function copyMaterial(material: Material) {
  copy(JSON.stringify({ ...defaultPreset, material }, null, 2))
    .then(() => { copyFeedback.value = 'Copied.' })
    .catch(() => { copyFeedback.value = 'Clipboard access failed. Select and copy the code.' })
}
const sections = ['Compose', 'Materials', 'Parts', 'Motion'] as const
const section = ref<typeof sections[number]>('Compose')
const wetness = ref(0.75)
const viscosity = ref(0.6)
const pressure = ref(0)
const opening = ref(0.5)
const transform = ref<Transform>('squeeze')
const scene = ref<Presentation>('specimen')
const mascot = ref(false)
const speaking = ref(0)
const blink = ref(0)
const brow = ref(0)
const squint = ref(0)
const motionOff = ref(false)
const reduced = usePreferredReducedMotion()
const paused = computed(() => motionOff.value || reduced.value === 'reduce')
</script>

<template>
  <BrandLair :motion-off="paused || section === 'Motion'">
  <div class="kit-shell" :data-motion="paused ? 'off' : 'on'">
    <a class="kit-skip" href="#kit-main">Skip to content</a>
    <header class="kit-header">
      <a href="/" aria-label="Brundlefly home"><img :src="'/brand/github-banner-overhang-gross.png'" alt="Brundlefly" width="1280" height="610"></a>
      <h1>Brand kit</h1>
      <nav aria-label="Kit links"><a href="/">Try the skills ↗</a><a href="/kit/brand-layer.zip" download>Download kit ↓</a><button :aria-pressed="paused" @click="motionOff = !motionOff">{{ paused ? 'Motion off' : 'Motion on' }}</button></nav>
    </header>
    <div class="kit-layout">
      <aside class="kit-navigation">
        <div role="group" aria-label="Brand kit sections"><BrandChoice v-for="item in sections" :key="item" :label="item" :selected="section === item" @click="section = item" /></div>
        <a class="layer-source" href="https://github.com/harlan-zw/brundlefly/tree/feat/brundlefly-website/website/layers/brand">Layer source ↗</a>
      </aside>
      <main id="kit-main">
        <div class="kit-section-title"><h2>{{ section }}</h2><p v-if="section === 'Compose'">Combine parts. Copy the Vue.</p></div>
        <Composer v-show="section === 'Compose'" />
        <section v-if="section === 'Materials'" class="material-gallery" aria-label="Materials">
          <BrandSurface v-for="material in materials" :key="material" :material="material" edges="corners" :density="0.5">
            <h3>{{ material }}</h3><div class="material-sample" :data-material="material" />
            <BrandAction :material="material" @click="copyMaterial(material)">Copy preset</BrandAction>
          </BrandSurface>
          <p role="status">{{ copyFeedback }}</p>
          <div class="palette-grid"><div v-for="color in palette" :key="color.name"><span :style="{ background: color.hex }" /><strong>{{ color.name }}</strong><code>{{ color.hex }}</code><small>{{ color.role }}</small></div></div>
        </section>
        <section v-if="section === 'Parts'" class="parts-gallery" aria-label="Parts">
          <article v-for="part in parts" :key="part.name"><div class="part-image"><img :src="part.file" :alt="part.name"></div><h3>{{ part.name }}</h3><p>{{ part.role }}</p><code>{{ part.component }}</code><a :href="part.file" download>Download ↓</a></article>
        </section>
        <section v-if="section === 'Motion'" class="motion-lab" aria-label="Motion">
          <div><LazyBrandOrganism :key="`${scene}-${mascot}`" :mascot="mascot" :framing="mascot ? 'face' : 'center'" :presentation="scene" :wetness="wetness" :viscosity="viscosity" :pressure="pressure" :opening="opening" :transform="transform" :speaking="speaking" :blink="mascot ? blink : undefined" :brow="brow" :squint="squint" :motion-off="paused" exportable /><p class="kit-note">Drag to deform. Space to press.</p></div>
          <div class="motion-controls">
            <div class="transform-choices" role="group" aria-label="Scene"><BrandChoice label="Aperture" :selected="scene === 'specimen'" @click="scene = 'specimen'" /><BrandChoice label="Lair" :selected="scene === 'lair'" @click="scene = 'lair'" /></div>
            <div class="transform-choices" role="group" aria-label="Transform"><BrandChoice v-for="value in transforms" :key="value" :label="value.charAt(0).toUpperCase() + value.slice(1)" :selected="transform === value" @click="transform = value" /></div>
            <UButton variant="outline" :aria-pressed="mascot" @click="mascot = !mascot">Brundlefly</UButton>
            <NuxtLink to="/mascot/">Inspect mascot</NuxtLink>
            <label for="opening">Opening <output>{{ opening }}</output></label><input id="opening" v-model.number="opening" type="range" min="0" max="1" step="0.05">
            <label for="wetness">Wetness <output>{{ wetness }}</output></label><input id="wetness" v-model.number="wetness" type="range" min="0" max="1" step="0.05">
            <label for="viscosity">Viscosity <output>{{ viscosity }}</output></label><input id="viscosity" v-model.number="viscosity" type="range" min="0" max="1" step="0.05">
            <label for="pressure">Pressure <output>{{ pressure }}</output></label><input id="pressure" v-model.number="pressure" type="range" min="0" max="1" step="0.05">
            <template v-if="mascot">
              <label for="speech">Speech <output>{{ speaking }}</output></label><input id="speech" v-model.number="speaking" type="range" min="0" max="1" step="0.05">
              <label for="blink">Blink <output>{{ blink }}</output></label><input id="blink" v-model.number="blink" type="range" min="0" max="1" step="0.05">
              <label for="brow">Brow <output>{{ brow }}</output></label><input id="brow" v-model.number="brow" type="range" min="0" max="1" step="0.05">
              <label for="squint">Squint <output>{{ squint }}</output></label><input id="squint" v-model.number="squint" type="range" min="0" max="1" step="0.05">
            </template>
            <p class="kit-note">{{ mascot ? 'Rigged GLB with idle, walk, and speaking clips.' : 'GLB rest pose. Runtime shader adds deformation.' }}</p>
            <a class="rest-download" :href="mascot ? '/brand/kit/lair/brundlefly-rig.glb' : scene === 'lair' ? '/brand/kit/lair/lair-organic-rest.glb' : '/brand/kit/lair/aperture-organic-rest.glb'" download>Download rest GLB</a>
            <pre class="kit-code">&lt;LazyBrandOrganism
  presentation="{{ scene }}"
  :mascot="{{ mascot }}"
  framing="{{ mascot ? 'face' : 'center' }}"
  :wetness="{{ wetness }}"
  :viscosity="{{ viscosity }}"
  :pressure="{{ pressure }}"
  :opening="{{ opening }}"
  :speaking="{{ speaking }}"
  :blink="{{ blink }}"
  :brow="{{ brow }}"
  :squint="{{ squint }}"
  transform="{{ transform }}"
/&gt;</pre>
          </div>
        </section>
      </main>
    </div>
  </div>
  </BrandLair>
</template>
