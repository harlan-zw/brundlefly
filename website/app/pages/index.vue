<script setup lang="ts">
import { useClipboard, usePreferredReducedMotion } from '@vueuse/core'
import { computed, ref } from 'vue'
import SkillDemo from './_SkillDemo.vue'
import { skills } from '#shared/content'
import type { SkillName } from '#shared/content'

const activeSkill = ref<SkillName>('write-human')
const selected = computed(() => skills.find(skill => skill.name === activeSkill.value)!)
const reducedMotion = usePreferredReducedMotion()
const motionOff = ref(false)
const motionPaused = computed(() => motionOff.value || reducedMotion.value === 'reduce')
const command = computed(() => `skilld run ./skills/${activeSkill.value} --json`)
const { copy, copied } = useClipboard({ legacy: true })
const copyError = ref('')

function copyCommand() {
  copyError.value = ''
  copy(command.value).catch(() => { copyError.value = 'Clipboard access failed. Select and copy the command below.' })
}

function selectSkill(name: SkillName) {
  activeSkill.value = name
  navigateTo({ hash: '#demos' })
}
</script>

<template>
  <div class="site-shell" :data-motion="motionPaused ? 'off' : 'on'">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header frame">
      <a class="home-link" href="#" aria-label="Brundlefly home">
        <img src="/brand/github-avatar.png" alt="" width="40" height="40">
        <span>Brundlefly</span>
      </a>
      <nav aria-label="Main navigation">
        <a href="#skills">Skills</a>
        <a href="#demos">Demos</a>
        <a href="#use">Use a skill</a>
        <a href="https://github.com/harlan-zw/brundlefly">GitHub <span aria-hidden="true">↗</span></a>
      </nav>
      <button class="motion-toggle" :aria-pressed="motionPaused" @click="motionOff = !motionOff">
        {{ motionPaused ? 'Motion off' : 'Motion on' }}
        <span class="motion-light" aria-hidden="true" />
      </button>
    </header>

    <main id="main">
      <section class="hero frame" aria-labelledby="hero-title">
        <h1 id="hero-title" class="sr-only">Brundlefly</h1>
        <div class="banner-stage">
          <div class="membrane membrane-left" aria-hidden="true" />
          <div class="membrane membrane-right" aria-hidden="true" />
          <img class="canonical-banner" src="/brand/github-banner-overhang-gross.png"
            alt="BRUNDLEFLY. A swollen human-fly hybrid with four arms, two developing wings, and dripping claws."
            width="1280" height="610" fetchpriority="high">
        </div>
        <div class="hero-bottom">
          <h2>A collection of<br><em>self-contained</em><br>Agent Skills.</h2>
          <div class="hero-intro">
            <p>Choose the skill that owns your task.<br>Each skill works alone.</p>
            <UButton to="#demos" class="wet-button">Try the skills <span aria-hidden="true">↓</span></UButton>
          </div>
        </div>
      </section>

      <UPageSection id="skills" class="frame skills-section" :ui="{ container: 'px-0 py-0 gap-0', root: 'py-0' }">
        <div class="section-heading">
          <h2>Skills</h2>
          <a href="https://github.com/harlan-zw/brundlefly/tree/main/skills">Read the instructions <span aria-hidden="true">↗</span></a>
        </div>
        <div class="skill-grid" aria-label="Choose a skill">
          <button v-for="skill in skills" :key="skill.name" class="skill-choice wet-sheen"
            :class="{ selected: activeSkill === skill.name }" :aria-pressed="activeSkill === skill.name"
            @click="selectSkill(skill.name)">
            <span class="skill-name">{{ skill.name }}</span>
            <span class="skill-description">{{ skill.description }}</span>
            <span class="skill-action">Try the demo <span aria-hidden="true">↘</span></span>
          </button>
        </div>
      </UPageSection>

      <section id="demos" class="frame demo-section" aria-labelledby="demo-title">
        <div class="section-heading demo-heading">
          <div>
            <h2 id="demo-title">Try the skills</h2>
            <p>Small, local demos of each skill’s workflow.<br>Your input stays in this browser.</p>
          </div>
          <span class="current-skill">{{ selected.name }}</span>
        </div>
        <div class="demo-switcher" role="group" aria-label="Demo skill">
          <button v-for="skill in skills" :key="skill.name" :aria-pressed="activeSkill === skill.name"
            @click="activeSkill = skill.name">{{ skill.name }}</button>
        </div>
        <SkillDemo :key="activeSkill" :skill="activeSkill" />
      </section>

      <section id="use" class="frame use-section" aria-labelledby="use-title">
        <div class="use-copy">
          <h2 id="use-title">Use a skill</h2>
          <p>Copy the complete skill directory into your agent’s supported skills directory.</p>
          <a :href="`/skills/${activeSkill}.zip`" download>Download {{ activeSkill }} <span aria-hidden="true">↓</span></a><br>
          <a href="https://github.com/harlan-zw/brundlefly#use-locally">Setup instructions <span aria-hidden="true">↗</span></a>
        </div>
        <div class="install-panel">
          <span class="install-label">From a local Brundlefly checkout, with skilld:</span>
          <code>{{ command }}</code>
          <UButton variant="outline" class="copy-button" @click="copyCommand">{{ copied ? 'Copied.' : 'Copy command' }}</UButton>
          <p role="status" aria-live="polite">{{ copyError || (copied ? 'Copied.' : 'Loads the skill without installing it.') }}</p>
        </div>
      </section>
    </main>

    <footer class="frame site-footer">
      <a class="home-link" href="#"><img src="/brand/github-avatar.png" alt="" width="32" height="32"><span>Brundlefly</span></a>
      <span>Self-contained Agent Skills.</span>
      <a href="https://github.com/harlan-zw/brundlefly/blob/main/LICENSE.md">MIT license <span aria-hidden="true">↗</span></a>
    </footer>
  </div>
</template>
