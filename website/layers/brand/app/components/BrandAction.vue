<script setup lang="ts">
import type { Material } from '../../shared/catalogue'
const { material = 'flesh', type = 'button' } = defineProps<{ material?: Material, type?: 'button' | 'submit' | 'reset', disabled?: boolean }>()
</script>

<template>
  <UButton :type="type" :disabled="disabled" class="brand-action" :data-material="material"><slot /></UButton>
</template>
