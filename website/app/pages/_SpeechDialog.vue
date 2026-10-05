<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { dialogueCopy } from '#shared/conversation'
import type { ConversationHistoryMessage, ConversationReply } from '#shared/conversation'

const { open, muted = false, soundAvailable = true } = defineProps<{ open: boolean, muted?: boolean, soundAvailable?: boolean }>()
const emit = defineEmits<{ close: [], reply: [text: string], sound: [], reaction: [reply: ConversationReply], pending: [value: boolean] }>()
const dialog = shallowRef<HTMLDialogElement>()
const input = shallowRef<HTMLTextAreaElement>()
const text = ref('')
const error = ref('')
const reply = shallowRef<ConversationReply>()
const history = ref<ConversationHistoryMessage[]>([])
const visited = ref(false)
const request = shallowRef<{ _tag: 'Idle' } | { _tag: 'Pending', controller: AbortController }>({ _tag: 'Idle' })
const failedVisit = ref(false)

const cancel = () => {
  if (request.value._tag === 'Pending') request.value.controller.abort()
  request.value = { _tag: 'Idle' }
  emit('pending', false)
}

const receive = async (kind: 'visit' | 'dialogue', suppliedText = text.value) => {
  if (request.value._tag === 'Pending') return
  const message = suppliedText.trim()
  if (kind === 'dialogue' && (!message || suppliedText.length > 1000)) {
    error.value = message ? dialogueCopy.length : dialogueCopy.empty
    input.value?.focus()
    return
  }
  const controller = new AbortController()
  request.value = { _tag: 'Pending', controller }
  error.value = ''
  emit('pending', true)
  const response = kind === 'visit'
    ? $fetch<{ greeting: ConversationReply }>('/api/visit', { signal: controller.signal, retry: 0, timeout: 20_000 }).then(value => value.greeting)
    : $fetch<{ reply: ConversationReply }>('/api/dialogue', {
        method: 'POST', signal: controller.signal, retry: 0, timeout: 20_000,
        body: { text: message, history: history.value.slice(-8) },
      }).then(value => value.reply)
  const result = await response.then(value => ({ _tag: 'Reply' as const, value })).catch((cause: unknown) => {
    if (controller.signal.aborted) return { _tag: 'Cancelled' as const }
    const status = typeof cause === 'object' && cause !== null && 'statusCode' in cause ? cause.statusCode : undefined
    return { _tag: 'Error' as const, message: status === 429 ? dialogueCopy.limit : dialogueCopy.failure, expired: status === 401 }
  })
  if (request.value._tag !== 'Pending' || request.value.controller !== controller || !open) return
  request.value = { _tag: 'Idle' }
  emit('pending', false)
  if (result._tag !== 'Reply') {
    if (result._tag === 'Error') {
      error.value = result.message
      failedVisit.value = kind === 'visit' || result.expired
      if (result.expired) { visited.value = false; history.value = [] }
    }
    input.value?.focus()
    return
  }
  reply.value = result.value
  visited.value = true
  failedVisit.value = false
  history.value = [...history.value.slice(kind === 'dialogue' ? -6 : -7),
    ...(kind === 'dialogue' ? [{ role: 'user' as const, content: message }] : []),
    { role: 'assistant', content: result.value.text }]
  if (kind === 'dialogue' && text.value === suppliedText) text.value = ''
  emit('reaction', result.value)
  emit('reply', result.value.text)
  await nextTick()
  input.value?.focus()
}

watch([() => open, dialog], async ([isOpen, element]) => {
  if (!element) return
  if (!isOpen) {
    cancel()
    if (element.open) element.close()
    return
  }
  if (!element.open) element.showModal()
  await nextTick()
  input.value?.focus()
  if (!visited.value) void receive('visit')
}, { flush: 'post' })

const choose = (choice: string) => {
  text.value = choice
  void receive('dialogue', choice)
}
useEventListener('keydown', (event: KeyboardEvent) => {
  if (!open || request.value._tag === 'Pending' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input,textarea,select'))) return
  const choice = reply.value?.choices[Number(event.key) - 1]
  if (/^[123]$/.test(event.key) && choice) { event.preventDefault(); choose(choice) }
})
onBeforeUnmount(() => { cancel(); if (dialog.value?.open) dialog.value.close() })
</script>

<template>
  <dialog ref="dialog" class="speech-pocket" aria-labelledby="speech-title" aria-describedby="speech-scope" @cancel.prevent="emit('close')" @close="emit('close')">
    <img class="speech-seam" src="/brand/kit/lair/tissue-seam.png" alt="" aria-hidden="true">
    <header>
      <div><h2 id="speech-title">Brundlefly</h2><p id="speech-scope">{{ dialogueCopy.privacy }}</p></div>
      <button class="speech-close" type="button" aria-label="Close" @click="emit('close')">×</button>
    </header>
    <div class="speech-conversation" aria-label="Conversation" :aria-busy="request._tag === 'Pending'">
      <p v-if="reply" class="speech-utterance">{{ reply.text }}</p>
      <p v-if="reply?.beat" class="speech-beat" aria-label="Brundlefly's movement">{{ reply.beat }}</p>
      <p v-if="request._tag === 'Pending'" class="speech-pending" role="status">{{ dialogueCopy.loading }}</p>
      <ol v-if="reply" class="speech-choices">
        <li v-for="(choice, index) in reply.choices" :key="`${index}:${choice}`">
          <button type="button" :disabled="request._tag === 'Pending'" @click="choose(choice)"><span aria-hidden="true">{{ index + 1 }}</span>{{ choice }}</button>
        </li>
      </ol>
      <div v-if="reply?.links.length" class="speech-links">
        <a v-for="link in reply.links" :key="link.href" :href="link.href" :download="link.download || undefined">{{ link.label }}</a>
      </div>
    </div>
    <p class="speech-announcement" role="status" aria-live="polite" aria-atomic="true">{{ reply?.text }}</p>
    <form @submit.prevent="receive('dialogue')">
      <label for="speech-input">Your text</label>
      <textarea id="speech-input" ref="input" v-model="text" rows="1" maxlength="1000" :aria-invalid="Boolean(error)" :aria-describedby="error ? 'speech-error' : undefined" @input="error = ''" />
      <p v-if="error" id="speech-error" class="speech-error" role="alert">{{ error }}</p>
      <div class="speech-send-row">
        <button v-if="soundAvailable" class="speech-sound" type="button" :aria-pressed="muted" @click="emit('sound')">{{ muted ? 'Sound on' : 'Sound off' }}</button>
        <button v-if="failedVisit" class="speech-retry" type="button" :disabled="request._tag === 'Pending'" @click="receive('visit')">Try again</button>
        <button class="speech-send" type="submit" :disabled="request._tag === 'Pending'">Send</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.speech-pocket { position: fixed; inset: auto; bottom: 24px; left: 50%; translate: -50% 0; box-sizing: border-box; width: min(800px, calc(100vw - 48px)); max-height: min(550px, 54dvh); margin: 0; padding: 22px 28px 18px; overflow: visible; color: #e8d4a6; background: #10130fec; border: 1px solid #69404b; border-radius: 35px 14px 30px 8px; box-shadow: 0 15px 80px #0009, inset 0 0 35px #69404b22; }
.speech-pocket[open] { display: flex; flex-direction: column; }
.speech-pocket::backdrop { background: #080b0812; }
.speech-seam { position: absolute; width: 95%; height: auto; top: 0; left: 2.5%; translate: 0 -72%; image-rendering: pixelated; pointer-events: none; }
header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-shrink: 0; }
h2 { margin: 0; font: 600 24px var(--font-display, sans-serif); }
header p { margin: 5px 0 0; font-size: 11px; line-height: 1.5; color: #a4b5a0; }
button { font: inherit; cursor: pointer; }
button:disabled { cursor: wait; opacity: .5; }
.speech-close { flex-shrink: 0; width: 44px; height: 44px; border: 0; background: transparent; color: #e8d4a6; font-size: 28px; }
.speech-sound { margin-right: auto; min-height: 44px; padding: 4px 8px; border: 0; color: #a4b5a0; background: transparent; font-size: 12px; text-decoration: underline; text-underline-offset: 4px; }
.speech-conversation { min-height: 40px; min-width: 0; overflow: auto; overscroll-behavior: contain; padding-right: 6px; scrollbar-color: #69404b #10130f; }
.speech-utterance { margin: 0; font-size: 16px; line-height: 1.5; overflow-wrap: anywhere; white-space: pre-wrap; }
.speech-pending { margin: 8px 0; color: #a4b5a0; font-size: 13px; }
.speech-beat { margin: 6px 0 0; color: #a4b5a0; font-size: 12px; font-style: italic; line-height: 1.4; }
.speech-choices { display: grid; gap: 3px; list-style: none; margin: 12px 0 0; padding: 0; }
.speech-choices button { display: flex; align-items: baseline; gap: 12px; width: 100%; min-height: 44px; padding: 9px 12px; text-align: left; border: 1px solid #69404b55; border-radius: 8px 3px 12px 3px; color: #e8d4a6; background: #343c3b33; font-size: 14px; line-height: 1.4; }
.speech-choices button:hover:not(:disabled) { border-color: #a4b5a0; background: #343c3b88; }
.speech-choices span { flex-shrink: 0; color: #a4b5a0; font-size: 12px; font-variant-numeric: tabular-nums; }
.speech-links { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 8px; }
.speech-links a { color: #a4b5a0; font-size: 13px; line-height: 1.5; display: inline-flex; align-items: center; min-height: 44px; text-underline-offset: 4px; }
form { margin-top: 12px; flex-shrink: 0; position: relative; z-index: 1; }
label { display: block; font-size: 13px; margin-bottom: 7px; }
textarea { display: block; box-sizing: border-box; width: 100%; min-height: 48px; max-height: 100px; padding: 11px 12px; resize: vertical; background: #080b08; color: #e8d4a6; border: 1px solid #777648; border-radius: 12px 4px 16px 4px; font: inherit; font-size: 16px; line-height: 1.4; }
.speech-send-row { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 6px; min-height: 44px; }
.speech-error { margin: 8px 0 0; color: #e8d4a6; font-size: 13px; line-height: 1.4; }
.speech-send, .speech-retry { min-height: 44px; padding: 10px 18px; background: #e8d4a6; color: #080b08; border: 0; border-radius: 8px 3px 12px 3px; font-size: 14px; }
.speech-retry { background: #343c3b; color: #e8d4a6; }
.speech-send:hover:not(:disabled) { background: #a4b5a0; }
.speech-announcement { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
@media (max-height: 540px) { .speech-pocket { bottom: 16px; max-height: calc(100dvh - 32px); padding: 18px; } header { margin-bottom: 10px; } .speech-conversation { min-height: 0; } form { margin-top: 10px; } }
@media (max-width: 600px) { .speech-pocket { bottom: 10px; width: calc(100vw - 20px); padding: 18px 16px 12px; max-height: 54dvh; } h2 { font-size: 22px; } header p { font-size: 10px; } .speech-utterance { font-size: 14px; } .speech-choices button { font-size: 13px; } }
</style>
