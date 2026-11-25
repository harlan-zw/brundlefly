<script setup lang="ts">
// A line he says over his head. It opens no dialog and takes no focus: the visitor keeps what they were doing.
// The scene gives the place of his head. While he is out of the picture, the line stands at the top of it.
const { text } = defineProps<{ text: string }>()
</script>

<template>
  <div class="overhead" role="status">
    <p v-if="text" :key="text">{{ text }}</p>
  </div>
</template>

<style scoped>
.overhead { --half: min(11rem, 46vw); --shown: var(--head-shown, 0);
  position: fixed; z-index: 4; pointer-events: none; width: max-content; max-width: calc(var(--half) * 2);
  left: calc(var(--shown) * clamp(var(--half) + 6px, var(--head-x, 50vw), 100vw - var(--half) - 6px) + (1 - var(--shown)) * 50vw);
  top: calc(var(--shown) * max(var(--head-y, 0px) - 14px, 5rem) + (1 - var(--shown)) * 5rem);
  translate: -50% -100%; }
p { position: relative; margin: 0; padding: 10px 16px 11px; color: #e8d4a6; background: linear-gradient(#151912f2, #0a0d0af7); border: 1px solid #69404b; border-radius: 22px 10px 20px 6px;
  box-shadow: 0 10px 40px #0009, inset 0 0 24px #69404b22; font-size: clamp(16px, 1.35vw, 22px); line-height: 1.35; text-align: center; text-wrap: balance;
  animation: overhead-rise .22s cubic-bezier(0.23, 1, 0.32, 1) both; }
/* A small tail points down at him. It hides when the line stands at the top of the picture. */
p::after { content: ''; position: absolute; left: 50%; bottom: -6px; width: 10px; height: 10px; translate: -50% 0; rotate: 45deg; background: #0a0d0a; border: solid #69404b; border-width: 0 1px 1px 0; opacity: var(--shown); }
@keyframes overhead-rise { from { opacity: 0; transform: translateY(8px); } }
@media (prefers-reduced-motion: reduce) { p { animation: none; } }
</style>
