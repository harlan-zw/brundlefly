<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEventListener, usePreferredReducedMotion } from '@vueuse/core'
const { motionOff = false, opening = 0.5, wetness = 0.75 } = defineProps<{ motionOff?: boolean, opening?: number, wetness?: number }>()
const pressed = ref(false)
const reduced = usePreferredReducedMotion()
const reaction = computed(() => !motionOff && reduced.value !== 'reduce' && pressed.value ? 0.45 : 0)
function press(event: Event) {
  if (event.target instanceof Element && event.target.closest('button')) pressed.value = true
}
useEventListener('pointerup', () => { pressed.value = false })
useEventListener('keyup', () => { pressed.value = false })
useEventListener('blur', () => { pressed.value = false })
</script>

<template>
  <div class="brand-lair">
    <div class="brand-lair-depth" aria-hidden="true">
      <LazyBrandOrganism presentation="lair" :interactive="false" :motion-off="motionOff" :opening="opening" :wetness="wetness" :pressure="reaction" />
    </div>
    <div class="brand-lair-content" @pointerdown="press" @keydown.space="press" @keydown.enter="press"><slot /></div>
  </div>
</template>
