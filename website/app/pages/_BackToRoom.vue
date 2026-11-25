<script setup lang="ts">
// The way back to the room from the join code: one plain button in the corner of the picture, clear of the code and its address.
const { shown } = defineProps<{ shown: boolean }>()
const emit = defineEmits<{ leave: [] }>()
</script>

<template>
  <button class="back" :class="{ shown }" type="button" :inert="!shown" @click="emit('leave')"><span aria-hidden="true">←</span> Back to the room</button>
</template>

<style scoped>
.back { position: fixed; z-index: 3; left: max(16px, env(safe-area-inset-left)); top: max(16px, env(safe-area-inset-top)); display: flex; align-items: center; gap: .5em; min-height: 44px; padding: 0 1.1em;
  color: #2c2a1f; background: linear-gradient(#efe6c3, #d6cba3); border: 1px solid #8f8565; border-bottom-width: 3px; border-radius: 6px; box-shadow: 0 2px 8px #0006;
  font: 600 15px/1 var(--font-mono, ui-monospace, monospace); white-space: nowrap; cursor: pointer; touch-action: manipulation; opacity: 0; pointer-events: none; transition: opacity .25s ease-out .5s; }
.back.shown { opacity: 1; pointer-events: auto; }
.back:hover { background: linear-gradient(#f7efd0, #e0d5ae); }
.back:active { translate: 0 1px; border-bottom-width: 2px; }
.back:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .back { transition: none; } }
</style>
