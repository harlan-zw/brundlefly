<script setup lang="ts">
const { part = 'tendon' } = defineProps<{ part?: 'tendon' | 'membrane' }>()
</script>

<template>
  <div class="brand-divider" :data-part="part" aria-hidden="true">
    <img :src="part === 'tendon' ? '/brand/kit/modular/tendon-connector.png' : '/brand/kit/modular/membrane-divider.png'" alt="" width="1536" height="1024">
  </div>
</template>
