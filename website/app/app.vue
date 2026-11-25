<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from '#app'
import { visitForPath } from '#shared/travel'
import MascotStage from './pages/_MascotStage.vue'
const route = useRoute()
const visit = computed(() => visitForPath(route.path))
</script>

<template>
  <UApp>
    <MascotStage v-if="visit" :key="visit._tag" :visit="visit" />
    <NuxtPage />
  </UApp>
</template>
