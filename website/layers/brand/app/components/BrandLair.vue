<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEventListener, usePreferredReducedMotion, useTimeoutFn } from '@vueuse/core'
const { motionOff = false, opening = 0.5, wetness = 0.75 } = defineProps<{ motionOff?: boolean, opening?: number, wetness?: number }>()
const pressed = ref(false)
const focused = ref(false)
const feeding = ref(false)
const { start: releaseInput } = useTimeoutFn(() => { feeding.value = false }, 240, { immediate: false })
const reduced = usePreferredReducedMotion()
const reaction = computed(() => motionOff || reduced.value === 'reduce' ? 0 : pressed.value ? 0.55 : feeding.value ? 0.32 : focused.value ? 0.12 : 0)
function input() { feeding.value = true; releaseInput() }
function focus(event: FocusEvent) {
  focused.value = event.target instanceof Element && event.target.matches('input,textarea,select')
}
function press(event: Event) {
  if (event.target instanceof Element && event.target.closest('button')) pressed.value = true
}
useEventListener('pointerup', () => { pressed.value = false })
useEventListener('pointercancel', () => { pressed.value = false })
useEventListener('keyup', () => { pressed.value = false })
useEventListener('blur', () => { pressed.value = false })
</script>

<template>
  <div class="brand-lair" :data-feeding="(feeding || pressed) && !motionOff && reduced !== 'reduce'" :data-motion="motionOff || reduced === 'reduce' ? 'off' : 'on'">
    <div class="brand-lair-depth" aria-hidden="true">
      <LazyBrandOrganism presentation="lair" :interactive="false" :motion-off="motionOff" :opening="opening" :wetness="wetness" :pressure="reaction" />
    </div>
    <div class="brand-lair-content" @pointerdown="press" @keydown.space="press" @keydown.enter="press"
      @input="input" @focusin="focus" @focusout="focused = false"><slot /></div>
  </div>
</template>
