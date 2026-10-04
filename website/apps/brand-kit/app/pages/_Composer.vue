<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useClipboard } from '@vueuse/core'
import { compositions, defaultPreset, edges, layouts, materials, parsePreset, vueForPreset } from '@brundlefly/brand/shared/catalogue'
import type { Preset } from '@brundlefly/brand/shared/catalogue'

const preset = ref<Preset>({ ...defaultPreset })
const presetInput = ref('')
const text = ref('')
const result = ref('')
const code = computed(() => vueForPreset(preset.value))
const json = computed(() => JSON.stringify(preset.value, null, 2))
type Feedback = { _tag: 'Idle' } | { _tag: 'Success' | 'Error', message: string }
const feedback = ref<Feedback>({ _tag: 'Idle' })
const { copy } = useClipboard({ legacy: true })
watch(preset, () => { feedback.value = { _tag: 'Idle' } }, { deep: true, flush: 'sync' })
function copyValue(value: string) {
  copy(value).then(() => { feedback.value = { _tag: 'Success', message: 'Copied.' } })
    .catch(() => { feedback.value = { _tag: 'Error', message: 'Clipboard access failed. Select and copy the code.' } })
}
function importPreset() {
  const parsed = parsePreset(presetInput.value)
  if (parsed._tag === 'Err') feedback.value = { _tag: 'Error', message: parsed.message }
  else { preset.value = parsed.preset; feedback.value = { _tag: 'Success', message: 'Preset loaded.' } }
}
function reset() { preset.value = { ...defaultPreset }; text.value = ''; result.value = ''; presetInput.value = '' }
</script>

<template>
  <div class="kit-composer">
    <div class="composition-choices" role="group" aria-label="Layout">
      <BrandChoice v-for="composition in compositions" :key="composition.name" :label="composition.name" :selected="preset.layout === composition.preset.layout" @click="preset = { ...composition.preset }" />
    </div>
    <div class="compose-workspace">
      <div class="composition-preview">
        <p class="kit-note">Component preview. No skill runs here.</p>
        <BrandComposition :layout="preset.layout">
          <BrandSurface :material="preset.material" :edges="preset.edges" :density="preset.density">
            <form class="brand-example" @submit.prevent="result = text">
              <label for="kit-text">Your text</label>
              <UTextarea id="kit-text" v-model="text" :rows="5" />
              <BrandAction type="submit" :material="preset.material">Preview result</BrandAction>
            </form>
          </BrandSurface>
          <BrandSurface material="chitin">
            <h2>Input preview</h2>
            <p class="preview-result" aria-live="polite">{{ result || 'Enter text to preview a result.' }}</p>
          </BrandSurface>
        </BrandComposition>
        <BrandDivider :part="preset.material === 'membrane' ? 'membrane' : 'tendon'" />
      </div>
      <form class="composition-controls" @submit.prevent="importPreset">
        <label for="material">Material</label><select id="material" v-model="preset.material"><option v-for="material in materials" :key="material" :value="material">{{ material }}</option></select>
        <label for="edges">Edges</label><select id="edges" v-model="preset.edges"><option v-for="edge in edges" :key="edge" :value="edge">{{ edge }}</option></select>
        <label for="layout">Layout</label><select id="layout" v-model="preset.layout"><option v-for="layout in layouts" :key="layout" :value="layout">{{ layout }}</option></select>
        <label for="density">Density <output>{{ preset.density }}</output></label><input id="density" v-model.number="preset.density" type="range" min="0" max="1" step="0.05">
        <UButton type="button" variant="ghost" @click="reset">Reset</UButton>
        <details>
          <summary>Import preset</summary>
          <label for="preset-input">Preset JSON</label><UTextarea id="preset-input" v-model="presetInput" :rows="5" :maxlength="4096" />
          <BrandAction type="submit">Import preset</BrandAction>
        </details>
      </form>
    </div>
    <div class="code-header"><h2>Vue</h2><div><UButton variant="outline" @click="copyValue(code)">Copy Vue</UButton><UButton variant="ghost" @click="copyValue(json)">Copy preset</UButton></div></div>
    <p v-if="feedback._tag !== 'Idle'" :role="feedback._tag === 'Error' ? 'alert' : 'status'">{{ feedback.message }}</p>
    <pre class="kit-code" tabindex="0">{{ code }}</pre>
  </div>
</template>
