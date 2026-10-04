<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core'
import { computed, ref } from 'vue'
import SkillDemo from './_SkillDemo.vue'
import type { SkillName } from '#shared/content'

const tasks = [
  { name: 'write-human', title: 'Review wording', instruction: 'Paste your text to get wording suggestions.' },
  { name: 'technical-guide', title: 'Build a guide outline', instruction: 'Set the reader and task to get a guide structure.' },
  { name: 'pr', title: 'Format a PR draft', instruction: 'Describe the change to get a title and description.' },
] as const
const activeSkill = ref<SkillName>('write-human')
const selected = computed(() => tasks.find(task => task.name === activeSkill.value)!)
const reducedMotion = usePreferredReducedMotion()
const motionOff = ref(false)
const motionPaused = computed(() => motionOff.value || reducedMotion.value === 'reduce')
</script>

<template>
  <div class="site-shell" :data-motion="motionPaused ? 'off' : 'on'">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <a href="#main" class="identity" aria-label="Brundlefly home">
        <img src="/brand/github-banner-overhang-gross.png" alt="Brundlefly" width="1280" height="610" fetchpriority="high">
      </a>
      <div class="header-actions">
        <a href="https://github.com/harlan-zw/brundlefly">GitHub ↗</a>
        <button class="motion-toggle" :aria-pressed="motionPaused" @click="motionOff = !motionOff">
          <span class="motion-light" aria-hidden="true" />{{ motionPaused ? 'Motion off' : 'Motion on' }}
        </button>
      </div>
    </header>
    <div class="workbench">
      <aside class="task-rail">
        <h2>Choose a task</h2>
        <div class="task-choices" role="group" aria-label="Choose a task">
          <button v-for="task in tasks" :key="task.name" :aria-pressed="activeSkill === task.name"
            @click="activeSkill = task.name"><span>{{ task.title }}</span><small>{{ task.name }}</small><span class="task-arrow" aria-hidden="true">↗</span></button>
        </div>
        <img class="rail-art" src="/brand/kit/instrument-surround.png" alt="" width="1536" height="1024" aria-hidden="true">
      </aside>
      <main id="main" class="workspace">
        <div class="task-heading">
          <div><h1>{{ selected.title }}</h1><p>{{ selected.instruction }}</p></div>
          <span class="local-note">Your input stays in this browser.</span>
        </div>
        <div class="task-surface">
          <SkillDemo v-for="task in tasks" v-show="activeSkill === task.name" :key="task.name" :skill="task.name" />
        </div>
        <div class="skill-use">
          <div><h2>Use a skill</h2><p>Copy the complete skill directory into your agent’s supported skills directory.</p></div>
          <a class="download-link" :href="`/skills/${activeSkill}.zip`" download>Download {{ activeSkill }} ↓</a>
          <a :href="`/skills/${activeSkill}.md`">Instructions ↗</a>
        </div>
      </main>
    </div>
  </div>
</template>
