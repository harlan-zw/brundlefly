<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core'
import { computed, ref } from 'vue'
import SkillDemo from './_SkillDemo.vue'
import { skills } from '#shared/content'
import type { SkillName } from '#shared/content'

const activeSkill = ref<SkillName>('write-human')
const reducedMotion = usePreferredReducedMotion()
const motionOff = ref(false)
const motionPaused = computed(() => motionOff.value || reducedMotion.value === 'reduce')
</script>

<template>
  <div class="site-shell" :data-motion="motionPaused ? 'off' : 'on'">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="instrument-header">
      <a href="#main" class="identity" aria-label="Brundlefly home">
        <img src="/brand/github-banner-overhang-gross.png" alt="Brundlefly" width="1280" height="610" fetchpriority="high">
      </a>
      <button class="motion-toggle" :aria-pressed="motionPaused" @click="motionOff = !motionOff">
        <span class="motion-light" aria-hidden="true" />{{ motionPaused ? 'Motion off' : 'Motion on' }}
      </button>
    </header>
    <main id="main" class="instrument" aria-label="Brundlefly skill demos">
      <h1 class="sr-only">Brundlefly</h1>
      <img class="instrument-surround" src="/brand/kit/instrument-surround.png" alt="" width="1536" height="1024" aria-hidden="true">
      <div class="instrument-core">
        <div class="demo-switcher" role="group" aria-label="Demo skill">
          <button v-for="(skill, index) in skills" :key="skill.name" :aria-pressed="activeSkill === skill.name"
            @click="activeSkill = skill.name"><span class="skill-index" aria-hidden="true">0{{ index + 1 }}</span>{{ skill.name }}</button>
        </div>
        <SkillDemo :key="activeSkill" :skill="activeSkill" />
        <p class="local-note">Your input stays in this browser.</p>
      </div>
    </main>
    <footer class="instrument-footer">
      <a :href="`/skills/${activeSkill}.zip`" download>Download {{ activeSkill }} ↓</a>
      <a :href="`/skills/${activeSkill}.md`">Instructions ↗</a>
      <a href="https://github.com/harlan-zw/brundlefly">GitHub ↗</a>
      <a href="https://github.com/harlan-zw/brundlefly/blob/feat/brundlefly-website/docs/brand/kit.md">Brand kit ↗</a>
    </footer>
  </div>
</template>
