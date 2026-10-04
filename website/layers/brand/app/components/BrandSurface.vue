<script setup lang="ts">
import type { Material, Edges } from '../../shared/catalogue'
const { material = 'chitin', edges = 'none', density = 0.5 } = defineProps<{ material?: Material, edges?: Edges, density?: number }>()
</script>

<template>
  <div class="brand-surface" :data-material="material" :data-edges="edges" :style="{ '--brand-density': density }">
    <div v-if="edges !== 'none'" class="brand-surface-art" aria-hidden="true">
      <template v-if="edges === 'corners' || edges === 'both'">
        <img class="brand-cap brand-cap-first" :src="'/brand/kit/modular/flesh-corner.png'" alt="" width="1254" height="1254">
        <img class="brand-cap brand-cap-last" :src="'/brand/kit/modular/flesh-corner.png'" alt="" width="1254" height="1254">
      </template>
      <img v-if="edges === 'wing' || edges === 'both'" class="brand-wing" :src="'/brand/kit/modular/membrane-divider.png'" alt="" width="1536" height="1024">
    </div>
    <div class="brand-surface-content"><slot /></div>
  </div>
</template>
