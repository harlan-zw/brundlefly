<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { replyToConversation } from '#shared/conversation'
import type { ConversationMessage } from '#shared/conversation'

const { open } = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = shallowRef<HTMLDialogElement>()
const input = shallowRef<HTMLTextAreaElement>()
const log = shallowRef<HTMLDivElement>()
const text = ref('')
const error = ref('')
const messages = ref<ConversationMessage[]>([])
const lastReply = computed(() => {
  const message = messages.value.at(-1)
  return message?._tag === 'Reply' ? message.reply.text : ''
})

watch([() => open, dialog], async ([isOpen, element]) => {
  if (!element) return
  if (!isOpen) {
    if (element.open) element.close()
    return
  }
  if (!element.open) element.showModal()
  await nextTick()
  input.value?.focus()
}, { flush: 'post' })

const send = async () => {
  const result = replyToConversation(text.value)
  if (result._tag === 'Err') {
    error.value = result.message
    input.value?.focus()
    return
  }
  messages.value = [...messages.value.slice(-14), { _tag: 'User', text: text.value.trim() }, { _tag: 'Reply', reply: result.reply }]
  text.value = ''
  error.value = ''
  await nextTick()
  if (log.value) log.value.scrollTop = log.value.scrollHeight
  input.value?.focus()
}

onBeforeUnmount(() => { if (dialog.value?.open) dialog.value.close() })
</script>

<template>
  <dialog ref="dialog" class="speech-pocket" aria-labelledby="speech-title" aria-describedby="speech-scope" @cancel.prevent="emit('close')" @close="emit('close')">
    <img class="speech-seam" src="/brand/kit/lair/tissue-seam.png" alt="" aria-hidden="true">
    <header>
      <div><h2 id="speech-title">Brundlefly</h2><p id="speech-scope">Local replies. Your input stays in this browser.</p></div>
      <button class="speech-close" type="button" aria-label="Close" @click="emit('close')">×</button>
    </header>
    <div ref="log" class="speech-log" role="log" aria-label="Conversation" aria-live="off">
      <p v-if="!messages.length" class="speech-start">Ask about the skills, installation, or brand kit.</p>
      <div v-for="(message, index) in messages" :key="index" class="speech-message" :data-speaker="message._tag">
        <p v-if="message._tag === 'User'">{{ message.text }}</p>
        <template v-else>
          <p>{{ message.reply.text }}</p>
          <div v-if="message.reply.links.length" class="speech-links">
            <a v-for="link in message.reply.links" :key="link.href" :href="link.href" :download="link.download || undefined">{{ link.label }}</a>
          </div>
        </template>
      </div>
    </div>
    <p class="speech-announcement" role="status" aria-live="polite" aria-atomic="true">{{ lastReply }}</p>
    <form @submit.prevent="send">
      <label for="speech-input">Your text</label>
      <textarea id="speech-input" ref="input" v-model="text" rows="2" maxlength="1000" :aria-invalid="Boolean(error)" :aria-describedby="error ? 'speech-error' : undefined" @input="error = ''" />
      <div class="speech-send-row">
        <p v-if="error" id="speech-error" role="alert">{{ error }}</p>
        <button class="speech-send" type="submit">Send</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.speech-pocket { position: fixed; inset: auto; bottom: clamp(16px, 6vh, 72px); left: 50%; translate: -50% 0; box-sizing: border-box; width: min(480px, calc(100vw - 32px)); max-height: min(620px, calc(100dvh - 44px)); margin: 0; padding: 28px 24px 20px; overflow: visible; color: #e8d4a6; background: #10130fec; border: 1px solid #69404b; border-radius: 35px 14px 30px 8px; box-shadow: 0 15px 80px #0009, inset 0 0 35px #69404b22; }
.speech-pocket[open] { display: flex; flex-direction: column; }
.speech-pocket::backdrop { background: #080b083b; }
.speech-pocket::after { content: ''; position: absolute; bottom: -11px; left: 38%; width: 24px; height: 24px; rotate: 45deg; background: #10130f; border-bottom: 1px solid #69404b; border-right: 1px solid #69404b; border-radius: 0 0 6px; }
.speech-seam { position: absolute; width: 95%; height: 58px; top: -28px; left: 2.5%; object-fit: cover; image-rendering: pixelated; pointer-events: none; }
header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 20px; flex-shrink: 0; }
h2 { margin: 0; font: 600 25px var(--font-display, sans-serif); }
header p { margin: 5px 0 0; font-size: 12px; line-height: 1.5; color: #a4b5a0; }
.speech-close { flex-shrink: 0; width: 44px; height: 44px; border: 0; background: transparent; color: #e8d4a6; font-size: 28px; cursor: pointer; }
.speech-log { min-height: 76px; max-height: 320px; min-width: 0; overflow: auto; overscroll-behavior: contain; padding-right: 6px; scrollbar-color: #69404b #10130f; }
.speech-message { padding: 12px 0; }
.speech-message p, .speech-start { margin: 0; font-size: 15px; line-height: 1.5; overflow-wrap: anywhere; white-space: pre-wrap; }
.speech-message[data-speaker="User"] { margin: 8px 0 4px 22px; padding: 12px 16px; background: #343c3b66; border-radius: 18px 4px 18px 18px; }
.speech-links { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 8px; }
.speech-links a { color: #a4b5a0; font-size: 13px; line-height: 1.5; display: inline-flex; align-items: center; min-height: 44px; text-underline-offset: 4px; }
form { margin-top: 20px; flex-shrink: 0; position: relative; z-index: 1; }
label { display: block; font-size: 13px; margin-bottom: 7px; }
textarea { display: block; box-sizing: border-box; width: 100%; min-height: 72px; max-height: 160px; padding: 12px; resize: vertical; background: #080b08; color: #e8d4a6; border: 1px solid #777648; border-radius: 12px 4px 16px 4px; font: inherit; font-size: 16px; line-height: 1.4; }
.speech-send-row { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 10px; min-height: 44px; }
.speech-send-row p { flex: 1; margin: 0; color: #e8d4a6; font-size: 13px; }
.speech-send { cursor: pointer; min-height: 44px; padding: 10px 22px; background: #e8d4a6; color: #080b08; border: 0; border-radius: 8px 3px 12px 3px; font: inherit; font-size: 14px; }
.speech-send:hover { background: #a4b5a0; }
.speech-announcement { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
@media (max-height: 540px) { .speech-pocket { bottom: 16px; max-height: calc(100dvh - 32px); padding: 18px; } header { margin-bottom: 10px; } .speech-log { min-height: 0; } form { margin-top: 10px; } textarea { min-height: 52px; } }
</style>
