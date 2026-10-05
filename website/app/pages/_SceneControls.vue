<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue'
import { useRoute } from '#app'
import { useEventListener } from '@vueuse/core'
import { defaultSceneSettings } from '@brundlefly/brand/shared/scene-settings'
import type { SceneSettings } from '@brundlefly/brand/shared/scene-settings'

const settings = defineModel<SceneSettings>({ required: true })
const route = useRoute()
const manualVisible = ref(false)
const queryDismissed = ref(false)
const visible = computed({
  get: () => manualVisible.value || (!queryDismissed.value && route.query.controls === '1'),
  set: (value: boolean) => {
    queryDismissed.value = true
    manualVisible.value = value
  },
})
const failedCopy = ref(false)
const closeButton = shallowRef<HTMLButtonElement>()
const copyField = shallowRef<HTMLTextAreaElement>()
const settingsJson = computed(() => JSON.stringify(settings.value, null, 2))
const copied = ref(false)

type Slider = { key: Exclude<keyof SceneSettings, 'motionOff'>; label: string; min: number; max: number; step: number }
const groups: { label: string; sliders: Slider[] }[] = [
  { label: 'Lighting', sliders: [
    { key: 'ambient', label: 'Ambient light', min: 0, max: 3, step: 0.05 },
    { key: 'key', label: 'Key light', min: 0, max: 180, step: 1 },
    { key: 'fill', label: 'Fill light', min: 0, max: 3, step: 0.05 },
    { key: 'rim', label: 'Rim light', min: 0, max: 3, step: 0.05 },
    { key: 'inner', label: 'Inner light', min: 0, max: 15, step: 0.1 },
    { key: 'exposure', label: 'Exposure', min: 0.2, max: 2.5, step: 0.05 },
    { key: 'textureGlow', label: 'Texture glow', min: 0, max: 1, step: 0.01 },
  ] },
  { label: 'Scene', sliders: [
    { key: 'fog', label: 'Fog', min: 0, max: 0.1, step: 0.001 },
    { key: 'zoom', label: 'Zoom', min: 0.85, max: 1.8, step: 0.05 },
    { key: 'wetness', label: 'Wetness', min: 0, max: 1, step: 0.01 },
    { key: 'opening', label: 'Opening', min: 0, max: 1, step: 0.01 },
  ] },
  { label: 'Motion', sliders: [
    { key: 'walkSpeed', label: 'Walk speed', min: 0, max: 1, step: 0.01 },
    { key: 'breath', label: 'Breath', min: 0, max: 2, step: 0.05 },
    { key: 'flow', label: 'Flow', min: 0, max: 2, step: 0.05 },
  ] },
]

const setNumber = (key: Slider['key'], event: Event) => {
  const value = (event.target as HTMLInputElement).valueAsNumber
  if (Number.isFinite(value)) settings.value = { ...settings.value, [key]: value }
}
const toggle = async () => {
  visible.value = !visible.value
  if (visible.value) {
    await nextTick()
    closeButton.value?.focus()
  }
}
useEventListener('keydown', (event: KeyboardEvent) => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key === 'Escape' && visible.value) {
    visible.value = false
    return
  }
  if (event.key.toLowerCase() !== 'l' || event.shiftKey || event.repeat) return
  const target = event.target
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))) return
  event.preventDefault()
  void toggle()
})
const reset = () => {
  settings.value = { ...defaultSceneSettings }
  failedCopy.value = false
  copied.value = false
}
const showCopyFallback = async () => {
  failedCopy.value = true
  await nextTick()
  copyField.value?.focus()
  copyField.value?.select()
}
const copySettings = async () => {
  failedCopy.value = false
  copied.value = false
  if (!navigator.clipboard) {
    await showCopyFallback()
    return
  }
  // Native rejection reaches the selectable fallback. Legacy copying cannot prove success.
  await navigator.clipboard.writeText(settingsJson.value)
    .then(() => { copied.value = true })
    .catch(showCopyFallback)
}
</script>

<template>
  <aside v-if="visible" class="scene-controls" aria-labelledby="scene-controls-title" @pointerdown.stop @click.stop>
    <header>
      <h2 id="scene-controls-title">Scene controls</h2>
      <button ref="closeButton" type="button" aria-label="Close" @click="visible = false">×</button>
    </header>
    <div class="scene-controls-scroll">
      <fieldset v-for="group in groups" :key="group.label">
        <legend>{{ group.label }}</legend>
        <div v-for="slider in group.sliders" :key="slider.key" class="scene-control">
          <div>
            <label :for="`scene-${slider.key}`">{{ slider.label }}</label>
            <output :for="`scene-${slider.key}`">{{ Number(settings[slider.key].toFixed(3)) }}</output>
          </div>
          <input :id="`scene-${slider.key}`" type="range" :min="slider.min" :max="slider.max" :step="slider.step" :value="settings[slider.key]" @input="setNumber(slider.key, $event)">
        </div>
      </fieldset>
      <label class="scene-motion"><input type="checkbox" :checked="settings.motionOff" @change="settings = { ...settings, motionOff: ($event.target as HTMLInputElement).checked }">Motion off</label>
      <div class="scene-controls-actions">
        <button type="button" @click="reset">Reset</button>
        <button type="button" @click="copySettings">Copy settings</button>
      </div>
      <p v-if="copied && !failedCopy" role="status">Copied.</p>
      <template v-if="failedCopy">
        <p role="alert">Clipboard access failed. Select and copy the settings.</p>
        <label for="scene-settings-json">Settings JSON</label>
        <textarea id="scene-settings-json" ref="copyField" :value="settingsJson" readonly rows="8" />
      </template>
    </div>
  </aside>
</template>

<style scoped>
.scene-controls { position: fixed; z-index: 15; top: 16px; right: 16px; display: flex; flex-direction: column; width: min(320px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); box-sizing: border-box; padding: 16px; background: #10130ff5; color: #e8d4a6; border: 1px solid #69404b; border-radius: 16px 4px 20px 4px; box-shadow: 0 12px 48px #0009; }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0; }
h2 { margin: 0; font-size: 18px; font-weight: 500; }
button { min-height: 44px; padding: 8px 12px; color: #e8d4a6; background: #343c3b; border: 1px solid #777648; border-radius: 6px 2px 8px 2px; font: inherit; font-size: 13px; cursor: pointer; }
header button { border: 0; width: 44px; background: transparent; font-size: 26px; }
.scene-controls-scroll { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 5px 2px 0; scrollbar-color: #69404b #10130f; }
fieldset { margin: 16px 0 0; padding: 0; border: 0; }
legend { margin-bottom: 12px; padding: 0; color: #a4b5a0; font: 12px var(--font-mono, monospace); }
.scene-control { margin-bottom: 6px; }
.scene-control > div { display: flex; justify-content: space-between; align-items: center; gap: 16px; font-size: 13px; }
output { color: #a4b5a0; font: 12px var(--font-mono, monospace); }
input[type="range"] { display: block; width: 100%; height: 32px; margin: 0; accent-color: #aa604b; cursor: pointer; }
.scene-motion { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 13px; }
.scene-motion input { width: 18px; height: 18px; accent-color: #aa604b; }
.scene-controls-actions { display: flex; gap: 12px; margin-top: 12px; }
p { margin: 12px 0 0; font-size: 13px; line-height: 1.5; }
textarea { box-sizing: border-box; width: 100%; margin-top: 8px; padding: 10px; background: #080b08; color: #e8d4a6; border: 1px solid #777648; font: 12px var(--font-mono, monospace); }
label[for="scene-settings-json"] { display: block; margin-top: 12px; font-size: 13px; }
</style>
