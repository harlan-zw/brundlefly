<script setup lang="ts">
defineProps<{ selected: boolean, label: string, detail?: string }>()
</script>

<template>
  <button class="brand-choice" type="button" :aria-pressed="selected"><span>{{ label }}</span><small v-if="detail">{{ detail }}</small></button>
</template>
