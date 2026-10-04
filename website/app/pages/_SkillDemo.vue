<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useClipboard } from '@vueuse/core'
import { analyzeWriting, createGuide, createPullRequest } from '#shared/demos'
import type { ChangeType, GuidePurpose, Result } from '#shared/demos'
import type { SkillName } from '#shared/content'

const { skill } = defineProps<{ skill: SkillName }>()
const text = ref('')
const task = ref('')
const reader = ref('')
const purpose = ref<GuidePurpose>('how-to')
const changeType = ref<ChangeType>('fix')
const scope = ref('')
const change = ref('')
const reason = ref('')
const result = ref<Result<{ output: string }> | null>(null)
const writing = ref<ReturnType<typeof analyzeWriting> | null>(null)

const writingResult = computed(() => writing.value?._tag === 'Ok' ? writing.value : null)
const error = computed(() => result.value?._tag === 'Err' ? result.value.message : writing.value?._tag === 'Err' ? writing.value.message : '')
const output = computed(() => result.value?._tag === 'Ok' ? result.value.output : '')
const segments = computed(() => {
  if (!writingResult.value) return []
  let start = 0
  const parts: { text: string, marked: boolean }[] = []
  for (const signal of writingResult.value.signals) {
    parts.push({ text: writingResult.value.source.slice(start, signal.start), marked: false })
    parts.push({ text: signal.phrase, marked: true })
    start = signal.end
  }
  parts.push({ text: writingResult.value.source.slice(start), marked: false })
  return parts
})

const resultHeading = ref<HTMLElement | null>(null)
const errorElement = ref<HTMLElement | null>(null)
const { copy, copied: clipboardCopied } = useClipboard({ legacy: true })
const lastCopied = ref('')
const copyError = ref('')

watch([text, task, reader, purpose, changeType, scope, change, reason], () => {
  result.value = null
  writing.value = null
  copyError.value = ''
  lastCopied.value = ''
})
const resultText = computed(() => writingResult.value
  ? [writingResult.value.source, ...writingResult.value.signals.map(signal => `${signal.phrase}: ${signal.suggestion}`)].join('\n\n')
  : output.value)
const copied = computed(() => clipboardCopied.value && lastCopied.value === resultText.value && lastCopied.value !== '')

function copyResult() {
  copyError.value = ''
  const content = resultText.value
  copy(content).then(() => { lastCopied.value = content }).catch(() => { copyError.value = 'Clipboard access failed. Select and copy the result.' })
}

function useExample() {
  purpose.value = 'how-to'
  changeType.value = 'fix'
  text.value = 'It is worth noting that we may utilize this tool in order to review the release. The preview opens on 4 October.'
  task.value = 'Set up a Nuxt project'
  reader.value = 'Developers who know Vue'
  scope.value = 'docs'
  change.value = 'repair the setup link'
  reason.value = 'The setup link opens a removed page. Readers need the current installation guide.'
}

async function runDemo() {
  if (skill === 'write-human') writing.value = analyzeWriting(text.value)
  else if (skill === 'technical-guide') result.value = createGuide({ task: task.value, reader: reader.value, purpose: purpose.value })
  else result.value = createPullRequest({ type: changeType.value, scope: scope.value, change: change.value, why: reason.value })
  copyError.value = ''
  lastCopied.value = ''
  await nextTick()
  if (error.value) errorElement.value?.focus()
  else resultHeading.value?.focus()
}

function resetDemo() {
  result.value = null
  writing.value = null
  text.value = ''
  task.value = ''
  reader.value = ''
  scope.value = ''
  change.value = ''
  reason.value = ''
}
</script>

<template>
  <div class="demo-body">
    <form class="demo-input" @submit.prevent="runDemo">
      <div class="form-tools"><UButton variant="ghost" type="button" @click="useExample">Use example</UButton></div>
      <template v-if="skill === 'write-human'">
        <label for="writing-input">Your text</label>
        <UTextarea id="writing-input" v-model="text" :rows="6" placeholder="Paste your text here." class="demo-textarea" :maxlength="6000" :aria-invalid="Boolean(error)" :aria-describedby="error ? `${skill}-error` : 'demo-limit'" />
        <details id="demo-limit" class="field-note"><summary>Demo limits</summary><p>Wording signals invite review. They do not identify an author.</p></details>
      </template>
      <template v-else-if="skill === 'technical-guide'">
        <label for="guide-task">Reader’s task</label>
        <UInput id="guide-task" v-model="task" :maxlength="160" />
        <label for="guide-reader">Intended reader</label>
        <UInput id="guide-reader" v-model="reader" :maxlength="160" />
        <label for="guide-purpose">Guide purpose</label>
        <select id="guide-purpose" v-model="purpose">
          <option value="tutorial">Learn by doing</option>
          <option value="how-to">Complete a known task</option>
          <option value="reference">Look up exact behavior</option>
          <option value="explanation">Understand a design</option>
        </select>
        <details class="field-note"><summary>Demo limits</summary><p>This demo builds a structure. The full skill researches and verifies the guide.</p></details>
      </template>
      <template v-else>
        <div class="field-pair">
          <div><label for="pr-type">Change type</label><select id="pr-type" v-model="changeType"><option v-for="type in ['feat', 'fix', 'docs', 'refactor', 'chore']" :key="type" :value="type">{{ type }}</option></select></div>
          <div><label for="pr-scope">Scope, optional</label><UInput id="pr-scope" v-model="scope" :maxlength="30" /></div>
        </div>
        <label for="pr-change">Change</label>
        <UInput id="pr-change" v-model="change" :maxlength="69" />
        <label for="pr-reason">Reason</label>
        <UTextarea id="pr-reason" v-model="reason" :rows="3" :maxlength="2000" />
        <details class="field-note"><summary>Demo limits</summary><p>This demo formats a draft. The full skill follows the target repository’s rules.</p></details>
      </template>
      <p v-if="error" :id="`${skill}-error`" ref="errorElement" tabindex="-1" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <BrandAction type="submit">{{ skill === 'write-human' ? 'Review text' : skill === 'technical-guide' ? 'Build an outline' : 'Format a PR' }} <span aria-hidden="true">↗</span></BrandAction>
        <UButton variant="ghost" type="button" @click="resetDemo">Clear</UButton>
      </div>
    </form>
    <section v-if="writingResult || output" class="demo-output" :aria-labelledby="`${skill}-result`">
      <h2 :id="`${skill}-result`" ref="resultHeading" tabindex="-1">{{ skill === 'write-human' ? 'Wording review' : skill === 'technical-guide' ? 'Guide outline' : 'PR draft' }}</h2>
      <template v-if="writingResult">
        <p class="review-source"><template v-for="(part, index) in segments" :key="index"><mark v-if="part.marked">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></p>
        <ul v-if="writingResult.signals.length" class="signal-list">
          <li v-for="signal in writingResult.signals" :key="signal.start"><strong>{{ signal.phrase }}</strong><p>{{ signal.suggestion }}</p></li>
        </ul>
        <p v-else class="empty-result">No matching wording signals. Review the meaning and structure with the full skill.</p>
      </template>
      <pre v-else-if="output" class="markdown-output">{{ output }}</pre>
      <div class="result-actions">
        <UButton variant="outline" type="button" @click="copyResult">{{ copied ? 'Copied.' : skill === 'write-human' ? 'Copy review' : 'Copy result' }}</UButton>
        <p role="status">{{ copyError }}</p>
      </div>
    </section>
  </div>
</template>
