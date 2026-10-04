<script setup lang="ts">
import { ref } from 'vue'
import WorldScene from './_WorldScene.client.vue'
import SpeechDialog from './_SpeechDialog.vue'
const talking = ref(false)
</script>

<template>
  <main aria-label="Brundlefly">
    <WorldScene :paused="talking" @talk="talking = true" />
    <SpeechDialog :open="talking" @close="talking = false" />
  </main>
</template>
