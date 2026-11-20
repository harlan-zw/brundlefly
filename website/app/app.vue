<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from '#app'
import { setForPath } from '#shared/travel'
import MascotStage from './pages/_MascotStage.vue'
// The stage stands above the pages. Each page file is only an address, so the stage survives a change of address.
const route = useRoute()
const staged = computed(() => setForPath(route.path) !== undefined)
</script>

<template>
  <UApp>
    <MascotStage v-if="staged" />
    <NuxtPage />
  </UApp>
</template>
