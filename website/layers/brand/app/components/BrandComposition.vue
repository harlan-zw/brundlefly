<script setup lang="ts">
import type { Layout } from '../../shared/catalogue'
const { layout = 'workbench' } = defineProps<{ layout?: Layout }>()
</script>

<template><div class="brand-composition-frame"><div class="brand-composition" :data-layout="layout"><slot /></div></div></template>
