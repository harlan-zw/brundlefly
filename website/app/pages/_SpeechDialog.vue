<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useEventListener, useMediaQuery, usePreferredReducedMotion, useResizeObserver, useScroll } from '@vueuse/core'
import { dialogueCopy } from '#shared/conversation'
import type { ConversationHistoryMessage, ConversationReply } from '#shared/conversation'

const { open, muted = false, soundAvailable = true } = defineProps<{ open: boolean, muted?: boolean, soundAvailable?: boolean }>()
const emit = defineEmits<{ close: [], reply: [text: string], sound: [], reaction: [reply: ConversationReply], pending: [value: boolean] }>()
const dialog = shallowRef<HTMLDialogElement>()
const input = shallowRef<HTMLTextAreaElement>()
const conversation = shallowRef<HTMLElement>()
const text = ref('')
const error = ref('')
const reply = shallowRef<ConversationReply>()
const history = ref<ConversationHistoryMessage[]>([])
const visited = ref(false)
const request = shallowRef<{ _tag: 'Idle' } | { _tag: 'Pending', controller: AbortController }>({ _tag: 'Idle' })
const failedVisit = ref(false)
const touchScreen = useMediaQuery('(pointer: coarse)')
const reduced = usePreferredReducedMotion()
// On touch screens, focus opens the keyboard over the reply. Visitors tap the field when they want to type.
const offerInput = () => { if (!touchScreen.value) input.value?.focus() }
// Phones hide scrollbars. A fade marks reply text or choices below the fold.
const { arrivedState, measure } = useScroll(conversation)
useResizeObserver(conversation, measure)
watch([reply, () => request.value._tag], measure, { flush: 'post' })

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
    offerInput()
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
  conversation.value?.scrollTo({ top: 0 })
  offerInput()
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
  offerInput()
  if (!visited.value) void receive('visit')
}, { flush: 'post' })

// New content changes the pocket height. Easing from the old height keeps the header and seam from jumping.
let resize: Animation | undefined
watch([reply, () => request.value._tag, error, failedVisit], async () => {
  const element = dialog.value
  if (!element?.open || reduced.value === 'reduce') return
  const from = element.getBoundingClientRect().height
  resize?.cancel()
  await nextTick()
  const to = element.getBoundingClientRect().height
  if (Math.abs(to - from) < 2) return
  resize = element.animate({ height: [`${from}px`, `${to}px`] }, { duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' })
}, { flush: 'pre' })

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
      <h2 id="speech-title">Brundlefly</h2>
      <div class="speech-tools">
        <button v-if="soundAvailable" class="speech-sound" type="button" :aria-pressed="muted" @click="emit('sound')">{{ muted ? 'Sound on' : 'Sound off' }}</button>
        <button class="speech-close" type="button" aria-label="Close" @click="emit('close')">×</button>
      </div>
      <p id="speech-scope">{{ dialogueCopy.privacy }}</p>
    </header>
    <div ref="conversation" class="speech-conversation" :class="{ 'speech-more': !arrivedState.bottom }" aria-label="Conversation" :aria-busy="request._tag === 'Pending'">
      <p v-if="reply" class="speech-utterance">{{ reply.text }}</p>
      <p v-if="reply?.beat" class="speech-beat" aria-label="Brundlefly's movement">{{ reply.beat }}</p>
      <div v-if="reply?.links.length" class="speech-links">
        <a v-for="link in reply.links" :key="link.href" :href="link.href" :download="link.download || undefined">{{ link.label }}</a>
      </div>
      <p v-if="request._tag === 'Pending'" class="speech-pending" role="status">{{ dialogueCopy.loading }}</p>
      <ol v-if="reply" class="speech-choices" aria-label="Your reply">
        <li v-for="(choice, index) in reply.choices" :key="`${index}:${choice}`">
          <button type="button" :disabled="request._tag === 'Pending'" @click="choose(choice)"><span aria-hidden="true">{{ index + 1 }}</span>{{ choice }}</button>
        </li>
      </ol>
    </div>
    <p class="speech-announcement" role="status" aria-live="polite" aria-atomic="true">{{ reply?.text }}</p>
    <form @submit.prevent="receive('dialogue')">
      <label class="speech-label" for="speech-input">Your text</label>
      <div class="speech-compose">
        <textarea id="speech-input" ref="input" v-model="text" rows="1" maxlength="1000" placeholder="Your text" :aria-invalid="Boolean(error)" :aria-describedby="error ? 'speech-error' : undefined" @input="error = ''" />
        <button v-if="failedVisit" class="speech-retry" type="button" :disabled="request._tag === 'Pending'" @click="receive('visit')">Try again</button>
        <button class="speech-send" type="submit" :disabled="request._tag === 'Pending'">Send</button>
      </div>
      <p v-if="error" id="speech-error" class="speech-error" role="alert">{{ error }}</p>
    </form>
  </dialog>
</template>

<style scoped>
.speech-pocket { position: fixed; inset: auto; bottom: 20px; left: 50%; translate: -50% 0; box-sizing: border-box; width: min(720px, calc(100vw - 32px)); max-height: min(460px, 46dvh); max-width: none; margin: 0; padding: 14px 18px 12px; overflow: visible; color: #e8d4a6; background: #10130ff2; border: 1px solid #69404b; border-radius: 30px 12px 26px 8px; box-shadow: 0 15px 80px #0009, inset 0 0 35px #69404b22;
  transition: opacity .2s cubic-bezier(0.23, 1, 0.32, 1), transform .2s cubic-bezier(0.23, 1, 0.32, 1), display .2s allow-discrete, overlay .2s allow-discrete; }
.speech-pocket[open] { display: flex; flex-direction: column; gap: 10px; transition-duration: .25s; }
/* The pocket rises into place with the camera and sinks out the same way. It keeps rendering until the fade ends. */
.speech-pocket:not([open]) { opacity: 0; transform: translateY(16px); pointer-events: none; }
@starting-style { .speech-pocket[open] { opacity: 0; transform: translateY(16px); } }
.speech-pocket::backdrop { background: #080b0812; }
/* The seam crowns the pocket without reaching up over his face. */
.speech-seam { position: absolute; width: 88%; height: auto; top: 0; left: 6%; translate: 0 -58%; image-rendering: pixelated; pointer-events: none; }
/* The scope note spans the full width, so the header tools never squeeze it. */
header { display: grid; grid-template-columns: 1fr auto; align-items: center; column-gap: 12px; flex-shrink: 0; }
h2 { margin: 0; font: 600 22px/1.1 var(--font-display, sans-serif); }
header p { grid-column: 1 / -1; margin: 4px 0 0; font-size: 12px; line-height: 1.4; color: #a4b5a0; }
button { font: inherit; cursor: pointer; }
button:disabled { cursor: wait; opacity: .5; }
.speech-tools { display: flex; align-items: center; margin: -10px -12px -10px 0; }
/* The tools overhang their row to keep 44px targets. An inset ring stays clear of the scope note below. */
.speech-tools button:focus-visible { outline-offset: -6px; }
.speech-sound { min-height: 44px; padding: 0 10px; border: 0; color: #a4b5a0; background: transparent; font-size: 13px; text-decoration: underline; text-decoration-color: #a4b5a066; text-underline-offset: 4px; }
.speech-sound:hover { color: #e8d4a6; }
.speech-close { width: 44px; height: 44px; border: 0; background: transparent; color: #e8d4a6; font-size: 26px; line-height: 1; }
.speech-conversation { display: flex; flex-direction: column; gap: 6px; min-height: 0; min-width: 0; overflow: auto; overscroll-behavior: contain; padding-right: 6px; scrollbar-color: #69404b #10130f; }
.speech-more { mask-image: linear-gradient(#000 calc(100% - 32px), transparent); }
.speech-utterance { margin: 0; font-size: 16px; line-height: 1.5; overflow-wrap: anywhere; white-space: pre-wrap; }
.speech-beat { margin: -2px 0 0; color: #a4b5a0; font-size: 13px; font-style: italic; line-height: 1.4; }
.speech-pending { margin: 0; color: #a4b5a0; font-size: 13px; }
.speech-links { display: flex; flex-wrap: wrap; gap: 4px 18px; }
.speech-links a { display: inline-flex; align-items: center; min-height: 32px; color: #a4b5a0; font-size: 13px; line-height: 1.4; text-decoration: underline; text-decoration-color: #a4b5a066; text-underline-offset: 4px; }
.speech-links a:hover { color: #e8d4a6; text-decoration-color: currentColor; }
@media (pointer: coarse) { .speech-links { row-gap: 0; } .speech-links a { min-height: 44px; } }
/* Choices pair up in two columns. A lone last choice takes the full row. */
.speech-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; list-style: none; margin: 2px 0 0; padding: 0; }
.speech-choices li:last-child:nth-child(odd) { grid-column: 1 / -1; }
/* A grid centres short labels when the neighbouring choice wraps and stretches the row. */
.speech-choices button { display: grid; grid-template-columns: auto 1fr; align-items: baseline; align-content: center; column-gap: 8px; width: 100%; height: 100%; min-height: 44px; padding: 8px 10px; text-align: left; border: 1px solid #69404b66; border-radius: 8px 3px 12px 3px; color: #e8d4a6; background: #343c3b40; font-size: 14px; line-height: 1.3; overflow-wrap: anywhere; }
.speech-choices button:hover:not(:disabled) { border-color: #a4b5a0; background: #343c3b99; }
.speech-choices span { color: #a4b5a0; font-size: 12px; font-variant-numeric: tabular-nums; }
form { flex-shrink: 0; position: relative; z-index: 1; }
/* The accessible name stays "Your text". A chat composer needs no visible caption. */
.speech-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.speech-compose { display: flex; align-items: flex-end; gap: 8px; }
textarea { flex: 1; min-width: 0; box-sizing: border-box; min-height: 44px; max-height: 120px; field-sizing: content; padding: 10px 12px; resize: none; background: #080b08; color: #e8d4a6; border: 1px solid #777648; border-radius: 12px 4px 16px 4px; font: inherit; font-size: 16px; line-height: 1.4; }
textarea::placeholder { color: #a4b5a0aa; }
textarea:focus-visible { border-color: #e8d4a6; outline-offset: 2px; }
.speech-error { margin: 6px 0 0; color: #e8d4a6; font-size: 13px; line-height: 1.4; }
.speech-send, .speech-retry { flex-shrink: 0; min-height: 44px; padding: 10px 18px; background: #e8d4a6; color: #080b08; border: 0; border-radius: 8px 3px 12px 3px; font-size: 14px; }
.speech-retry { background: #343c3b; color: #e8d4a6; }
.speech-send:hover:not(:disabled) { background: #a4b5a0; }
.speech-announcement { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
@media (max-height: 540px) { .speech-pocket { bottom: 12px; max-height: calc(100dvh - 24px); padding: 12px 16px 10px; gap: 8px; } }
@media (max-width: 600px) { .speech-pocket { bottom: 10px; width: calc(100vw - 20px); max-height: 52dvh; padding: 12px 12px 10px; gap: 8px; } h2 { font-size: 20px; } .speech-utterance { font-size: 15px; } .speech-choices button { column-gap: 6px; padding: 6px 8px; font-size: 13px; } }
/* Short landscape screens keep his face beside the pocket. resolveConversationFocus pans the scene to match. */
@media (orientation: landscape) and (max-height: 540px) { .speech-pocket { left: auto; right: 12px; translate: none; width: min(400px, 50vw); max-height: calc(100dvh - 24px); } }
</style>
