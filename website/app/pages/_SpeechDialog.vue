<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { onClickOutside, useEventListener, useMediaQuery, usePreferredReducedMotion, useRafFn, useResizeObserver, useScroll, useTimeoutFn } from '@vueuse/core'
import { chooseOpening, dialogueCopy, fallbackLine, listeningLine, parseVisit } from '#shared/conversation'
import type { ConversationHistoryMessage, ConversationReply, FallbackLine } from '#shared/conversation'
import presetData from '#shared/dialogue-presets.generated.json'
import { choiceNeedsInput, parsePresetGraph, resolveOpeningPreset, resolvePresetChoice } from '#shared/preset-dialogue'
import type { ConversationTurn } from '#shared/preset-dialogue'
import { breathGroups, groupsSaid, revealTimes } from '#shared/line-reveal'
import { voiceDuration } from '#shared/scene-audio'
import { travelAction } from '#shared/travel'
import type { SetName } from '@brundlefly/brand/shared/scene-set'

const { open, place, travelling = false, muted = false, soundAvailable = true } = defineProps<{ open: boolean, place: SetName, travelling?: boolean, muted?: boolean, soundAvailable?: boolean }>()
const emit = defineEmits<{ close: [], reply: [text: string], sound: [], reaction: [reply: Pick<ConversationReply, 'mood' | 'beat'>], pending: [value: boolean], travel: [to: SetName] }>()
// The app's own action: it takes him to the other place. It is no reply, so it sends nothing and leaves the conversation as it is.
// During a journey the action waits. It keeps the keyboard focus, so it is marked as unavailable and not disabled.
const journey = computed(() => travelAction(place))
const dialog = shallowRef<HTMLDialogElement>()
const input = shallowRef<HTMLTextAreaElement>()
const conversation = shallowRef<HTMLElement>()
const choiceList = shallowRef<HTMLOListElement>()
const ownChoice = shallowRef<HTMLButtonElement>()
const text = ref('')
// What went wrong. Each kind has one plain sentence. A missing reply also has a line he says, and a retry.
type Failure = { _tag: 'None' } | { _tag: 'Input', message: string } | { _tag: 'NoReply', kind: 'visit' | 'dialogue', line: FallbackLine }
  | { _tag: 'Limit', kind: 'visit' | 'dialogue' } | { _tag: 'Expired' }
const failure = shallowRef<Failure>({ _tag: 'None' })
const error = computed(() => {
  const failed = failure.value
  return failed._tag === 'None' ? '' : failed._tag === 'Input' ? failed.message : failed._tag === 'Limit' ? dialogueCopy.limit
    : failed._tag === 'Expired' ? dialogueCopy.expired : failed.kind === 'visit' ? dialogueCopy.failedGreeting : dialogueCopy.failure
})
// The request that “Try again” repeats. A limited reply has none: the visitor waits, then sends.
const retry = computed(() => {
  const failed = failure.value
  return failed._tag === 'NoReply' ? failed.kind : failed._tag === 'Expired' || (failed._tag === 'Limit' && failed.kind === 'visit') ? 'visit' as const : undefined
})
const failures = { visit: 0, dialogue: 0 }
let liveTurns = 0
const turn = shallowRef<ConversationTurn>({ _tag: 'Empty' })
const reply = computed(() => turn.value._tag === 'Empty' ? undefined : turn.value.reply)
// The line on show: his reply, or the line he says when no reply came back.
const spoken = computed(() => failure.value._tag === 'NoReply' ? failure.value.line : reply.value)
const presets = parsePresetGraph(presetData)
if (presets._tag === 'Err') console.error(presets.message)
// The AI notice previews on hover. A press pins it open until the next press, a press elsewhere, or Escape.
const notice = ref(false)
const noticeAnchor = shallowRef<HTMLElement>()
onClickOutside(noticeAnchor, () => { notice.value = false })
// Choices and the text field take turns. "Your text" and errors show the field. A new reply shows the choices.
const mode = ref<'Choices' | 'Compose'>('Choices')
const history = ref<ConversationHistoryMessage[]>([])
const visited = ref(false)
const request = shallowRef<{ _tag: 'Idle' } | { _tag: 'Pending', controller: AbortController, chosen: number | undefined, listening: string }
  | { _tag: 'PresetPending', next: Extract<ConversationTurn, { _tag: 'Preset' }>, text: string, chosen: number }>({ _tag: 'Idle' })
// The choice the visitor made stays lit while he takes it in. Typed text stays in its field instead.
const chosen = computed(() => request.value._tag === 'Idle' ? undefined : request.value.chosen)
// The server refuses a second request from one session inside two seconds. The send and retry controls wait that long.
const { isPending: cooling, start: cool } = useTimeoutFn(() => {}, 2000, { immediate: false })
const touchScreen = useMediaQuery('(pointer: coarse)')
const reduced = usePreferredReducedMotion()
// On touch screens, focus opens the keyboard over the reply. Visitors tap the field when they want to type.
const offerInput = () => { if (!touchScreen.value) input.value?.focus() }
// A new reply replaces the choice buttons. Keyboard focus moves to the first one instead of falling out of the dialog.
const focusReply = () => {
  if (mode.value === 'Compose') offerInput()
  else if (!touchScreen.value) choiceList.value?.querySelector('button')?.focus({ preventScroll: true })
}
// Phones hide scrollbars. A fade marks reply text or choices below the fold.
const { arrivedState, measure } = useScroll(conversation)
useResizeObserver(conversation, measure)
watch([spoken, () => request.value._tag, mode], measure, { flush: 'post' })

// His line arrives in breath-sized groups over the length of his voice. The whole line is laid out from the start, so the pocket keeps its size.
const line = computed(() => {
  const groups = spoken.value ? breathGroups(spoken.value.text) : []
  return { groups, times: revealTimes(groups, voiceDuration('reply', spoken.value?.text.length ?? 0)) }
})
const said = ref(0)
const saying = computed(() => said.value < line.value.groups.length)
let lineStarted = 0
const { pause: holdLine, resume: sayLine } = useRafFn(({ timestamp }) => {
  said.value = groupsSaid(line.value.times, (timestamp - (lineStarted ||= timestamp)) / 1000)
  if (!saying.value) holdLine()
}, { immediate: false })
// A press, a close, and reduced motion show the rest of the line at once.
const finishLine = () => { holdLine(); said.value = line.value.groups.length }
const startLine = () => {
  if (reduced.value === 'reduce') finishLine()
  else { said.value = Math.min(1, line.value.groups.length); lineStarted = 0; sayLine() }
}

// Both local and generated replies use the same history, focus, sound, and scene events.
const present = async (next: Exclude<ConversationTurn, { _tag: 'Empty' }>, kind: 'visit' | 'dialogue', suppliedText: string) => {
  turn.value = next
  failure.value = { _tag: 'None' }
  startLine()
  mode.value = 'Choices'
  visited.value = true
  history.value = [...history.value.slice(kind === 'dialogue' ? -6 : -7),
    ...(kind === 'dialogue' ? [{ role: 'user' as const, content: suppliedText.trim() }] : []),
    { role: 'assistant', content: next.reply.text }]
  if (kind === 'dialogue' && text.value === suppliedText) text.value = ''
  emit('reaction', next.reply)
  emit('reply', next.reply.text)
  await nextTick()
  conversation.value?.scrollTo({ top: 0 })
  focusReply()
}

// A short hold shows the visitor the line they chose and gives cached replies his normal pacing. Closing cancels the queued reply.
const { start: startPreset, stop: stopPreset } = useTimeoutFn(() => {
  const pending = request.value
  if (pending._tag !== 'PresetPending' || !open) return
  request.value = { _tag: 'Idle' }
  emit('pending', false)
  void present(pending.next, 'dialogue', pending.text)
}, 600, { immediate: false })

const cancel = () => {
  if (request.value._tag === 'Pending') request.value.controller.abort()
  stopPreset()
  request.value = { _tag: 'Idle' }
  emit('pending', false)
}

const receive = async (kind: 'visit' | 'dialogue', suppliedText = text.value, choice?: number) => {
  if (request.value._tag !== 'Idle') return
  const message = suppliedText.trim()
  if (kind === 'dialogue' && (!message || suppliedText.length > 1000)) {
    failure.value = { _tag: 'Input', message: message ? dialogueCopy.length : dialogueCopy.empty }
    input.value?.focus()
    return
  }
  const controller = new AbortController()
  request.value = { _tag: 'Pending', controller, chosen: choice, listening: listeningLine(kind === 'dialogue' ? liveTurns++ : 0) }
  // The line he said for the last failure leaves when the visitor tries again.
  if (failure.value._tag !== 'None') { failure.value = { _tag: 'None' }; finishLine() }
  if (kind === 'dialogue') cool()
  emit('pending', true)
  // The browser renders the greeting. The server verifies the count and the return. The hour is this browser's own and is not sent.
  const response = kind === 'visit'
    ? $fetch<unknown>('/api/visit', { signal: controller.signal, retry: 0, timeout: 20_000 }).then((value) => {
        const visit = parseVisit(value)
        return visit._tag === 'Ok' ? { _tag: 'Reply' as const, value: chooseOpening({ ...visit.value, hour: new Date().getHours(), place }) } : { _tag: 'Error' as const, status: undefined }
      })
    : $fetch<{ reply: ConversationReply }>('/api/dialogue', {
        method: 'POST', signal: controller.signal, retry: 0, timeout: 20_000,
        body: { text: message, history: history.value.slice(-8), place },
      }).then(value => ({ _tag: 'Reply' as const, value: { reply: value.reply, preset: -1 } }))
  const result = await response.catch((cause: unknown) => {
    if (controller.signal.aborted) return { _tag: 'Cancelled' as const }
    return { _tag: 'Error' as const, status: typeof cause === 'object' && cause !== null && 'statusCode' in cause ? cause.statusCode : undefined }
  })
  if (request.value._tag !== 'Pending' || request.value.controller !== controller || !open) return
  request.value = { _tag: 'Idle' }
  emit('pending', false)
  if (result._tag !== 'Reply') {
    if (result._tag === 'Error') {
      if (result.status === 401) {
        // The session is gone, and the conversation with it.
        failure.value = { _tag: 'Expired' }
        visited.value = false
        history.value = []
        turn.value = { _tag: 'Empty' }
      }
      else if (result.status === 429) failure.value = { _tag: 'Limit', kind }
      else {
        // He says a line of his own. It is not a reply, so it stays out of the history.
        const fallback = fallbackLine(kind, failures[kind]++)
        failure.value = { _tag: 'NoReply', kind, line: fallback }
        startLine()
        emit('reaction', fallback)
        emit('reply', fallback.text)
      }
      mode.value = 'Compose'
    }
    await nextTick()
    offerInput()
    return
  }
  const next = kind === 'visit' && presets._tag === 'Ok'
    ? resolveOpeningPreset(presets.value, result.value.reply, result.value.preset)
    : { _tag: 'Generated' as const, reply: result.value.reply }
  if (next._tag !== 'Empty') await present(next, kind, suppliedText)
}

watch([() => open, dialog], async ([isOpen, element]) => {
  if (!element) return
  if (!isOpen) {
    // A line that he was still saying is whole when the dialog opens again.
    finishLine()
    cancel()
    if (element.open) element.close()
    return
  }
  if (!element.open) element.showModal()
  await nextTick()
  focusReply()
  if (!visited.value) void receive('visit')
}, { flush: 'post' })

// New content changes the pocket height. Easing from the old height keeps the header and the top edge from jumping.
let resize: Animation | undefined
watch([spoken, () => request.value._tag, failure, mode], async () => {
  const element = dialog.value
  if (!element?.open || reduced.value === 'reduce') return
  const from = element.getBoundingClientRect().height
  resize?.cancel()
  await nextTick()
  const to = element.getBoundingClientRect().height
  if (Math.abs(to - from) < 2) return
  resize = element.animate({ height: [`${from}px`, `${to}px`] }, { duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' })
}, { flush: 'pre' })

// A pointer press or a number key during his line shows the rest of it first. The next one answers.
// Keyboard and screen reader activation always answers, because the reveal is only visual.
const choose = (choice: string, index: number, pointer: boolean) => {
  if (request.value._tag !== 'Idle') return
  if (pointer && saying.value) { finishLine(); return }
  finishLine()
  if (turn.value._tag === 'Preset' && presets._tag === 'Ok') {
    const selected = resolvePresetChoice(presets.value, turn.value.id, index)
    if (selected._tag === 'Reply') {
      request.value = { _tag: 'PresetPending', next: { _tag: 'Preset', id: selected.id, reply: selected.reply }, text: choice, chosen: index }
      emit('pending', true)
      startPreset()
      return
    }
    if (selected._tag === 'Compose') { void compose(); return }
  }
  if (choiceNeedsInput(choice)) { void compose(); return }
  text.value = choice
  void receive('dialogue', choice, index)
}
// Visitors chose to type, so the field takes focus even on touch screens.
const compose = async () => {
  mode.value = 'Compose'
  await nextTick()
  input.value?.focus()
}
const back = async () => {
  mode.value = 'Choices'
  failure.value = { _tag: 'None' }
  finishLine()
  await nextTick()
  ownChoice.value?.focus()
}
useEventListener('keydown', (event: KeyboardEvent) => {
  if (!open || mode.value !== 'Choices' || !reply.value || request.value._tag !== 'Idle' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input,textarea,select'))) return
  if (event.key === '4') { event.preventDefault(); void compose(); return }
  const choice = reply.value.choices[Number(event.key) - 1]
  if (/^[123]$/.test(event.key) && choice) { event.preventDefault(); choose(choice, Number(event.key) - 1, true) }
})
onBeforeUnmount(() => { cancel(); if (dialog.value?.open) dialog.value.close() })
</script>

<template>
  <dialog ref="dialog" class="speech-pocket" aria-labelledby="speech-title" aria-describedby="speech-scope" @cancel.prevent="notice ? notice = false : emit('close')" @close="emit('close')">
    <header>
      <div ref="noticeAnchor" class="speech-name">
        <h2 id="speech-title">Brundlefly</h2>
        <button class="speech-notice" type="button" aria-label="About AI replies" :aria-expanded="notice" aria-controls="speech-scope" @click="notice = !notice"><span aria-hidden="true">!</span></button>
        <p id="speech-scope" class="speech-scope" :class="{ 'speech-scope-open': notice }">{{ dialogueCopy.privacy }} {{ dialogueCopy.visit }}</p>
      </div>
      <div class="speech-tools">
        <button v-if="soundAvailable" class="speech-sound" type="button" :aria-pressed="muted" @click="emit('sound')">{{ muted ? 'Sound on' : 'Sound off' }}</button>
        <button class="speech-close" type="button" aria-label="Close" @click="emit('close')">×</button>
      </div>
    </header>
    <div ref="conversation" class="speech-conversation" :class="{ 'speech-more': !arrivedState.bottom }" aria-label="Conversation" :aria-busy="request._tag !== 'Idle'" @click="finishLine">
      <p v-if="spoken" class="speech-utterance"><span v-for="(group, index) in line.groups" :key="index" :class="{ 'speech-unsaid': index >= said }">{{ group }}</span></p>
      <p v-if="spoken?.beat" class="speech-beat" aria-label="Brundlefly's movement">{{ spoken.beat }}</p>
      <div v-if="reply?.links.length && failure._tag !== 'NoReply'" class="speech-links">
        <a v-for="link in reply.links" :key="link.href" :href="link.href" :download="link.download || undefined">{{ link.label }}</a>
      </div>
      <p v-if="request._tag === 'Pending'" class="speech-pending" role="status">{{ request.listening }}</p>
      <ol v-if="reply && mode === 'Choices'" ref="choiceList" class="speech-choices" :class="{ 'speech-waiting': saying }" aria-label="Your reply">
        <li v-for="(choice, index) in reply.choices" :key="`${index}:${choice}`">
          <button type="button" :class="{ 'speech-chosen': chosen === index }" :disabled="request._tag !== 'Idle'" @click="choose(choice, index, $event.detail > 0)"><span aria-hidden="true">{{ index + 1 }}.</span>{{ choice }}</button>
        </li>
        <li>
          <button ref="ownChoice" class="speech-own" type="button" :disabled="request._tag !== 'Idle'" @click="compose"><span aria-hidden="true">4.</span>Your text</button>
        </li>
      </ol>
    </div>
    <button class="speech-travel" type="button" :aria-disabled="travelling" @click="travelling || emit('travel', journey.to)">{{ journey.label }}</button>
    <p class="speech-announcement" role="status" aria-live="polite" aria-atomic="true">{{ spoken?.text }}</p>
    <form v-if="mode === 'Compose'" @submit.prevent="receive('dialogue')">
      <label class="speech-label" for="speech-input">Your text</label>
      <div class="speech-compose">
        <button v-if="reply" class="speech-back" type="button" @click="back">Back</button>
        <textarea id="speech-input" ref="input" v-model="text" rows="1" maxlength="1000" placeholder="Your text" :aria-invalid="Boolean(error)" :aria-describedby="error ? 'speech-error' : undefined" @input="failure._tag === 'Input' && (failure = { _tag: 'None' })" />
        <button v-if="retry" class="speech-retry" type="button" :disabled="request._tag !== 'Idle' || cooling" @click="receive(retry)">Try again</button>
        <button class="speech-send" type="submit" :disabled="request._tag !== 'Idle' || cooling">Send</button>
      </div>
      <p v-if="error" id="speech-error" class="speech-error" role="alert">{{ error }}</p>
    </form>
  </dialog>
</template>

<style scoped>
.speech-pocket { position: fixed; inset: auto; bottom: 20px; left: 50%; translate: -50% 0; box-sizing: border-box; width: min(720px, calc(100vw - 32px)); max-height: min(460px, 46dvh); max-width: none; margin: 0; padding: 14px 18px 12px; overflow: visible; color: #e8d4a6; background: linear-gradient(#151912f2, #0a0d0af7); border: 1px solid #69404b; border-radius: 30px 12px 26px 8px; box-shadow: 0 15px 80px #0009, inset 0 0 35px #69404b22;
  /* A second inset line frames the pocket like a tabletop dialogue box. */
  outline: 1px solid #e8d4a61a; outline-offset: -6px;
  transition: opacity .2s cubic-bezier(0.23, 1, 0.32, 1), transform .2s cubic-bezier(0.23, 1, 0.32, 1), display .2s allow-discrete, overlay .2s allow-discrete; }
.speech-pocket[open] { display: flex; flex-direction: column; gap: 10px; transition-duration: .25s; }
/* The pocket rises into place with the camera and sinks out the same way. It keeps rendering until the fade ends. */
.speech-pocket:not([open]) { opacity: 0; transform: translateY(16px); pointer-events: none; }
@starting-style { .speech-pocket[open] { opacity: 0; transform: translateY(16px); } }
.speech-pocket::backdrop { background: #080b0812; }
/* A rust hairline runs along the top edge and fades toward both ends. One small bead sits at its middle. Both are drawn, so no image loads. */
.speech-pocket::before { content: ''; position: absolute; top: -1px; left: 9%; right: 9%; height: 1px; pointer-events: none; background: linear-gradient(90deg, transparent, #aa604b8c 30%, #aa604b8c 70%, transparent); }
.speech-pocket::after { content: ''; position: absolute; top: -3px; left: 50%; width: 5px; height: 5px; translate: -50% 0; rotate: 45deg; pointer-events: none; background: #10130f; border: 1px solid #aa604b; }
header { display: flex; justify-content: space-between; align-items: center; column-gap: 12px; flex-shrink: 0; }
.speech-name { position: relative; display: flex; align-items: center; min-width: 0; }
h2 { margin: 0; font: 600 22px/1.1 var(--font-display, sans-serif); letter-spacing: .02em; }
/* A 44px target around a small ring. It overhangs the row so the header stays short. */
.speech-notice { display: grid; place-items: center; width: 44px; height: 44px; margin: -10px -10px -10px -4px; padding: 0; border: 0; background: transparent; color: #a4b5a0; }
.speech-notice span { display: grid; place-items: center; width: 18px; height: 18px; border: 1px solid currentColor; border-radius: 50%; font: 700 12px/1 var(--font-display, sans-serif); }
.speech-notice:hover, .speech-notice[aria-expanded='true'] { color: #e8d4a6; }
.speech-notice:focus-visible { outline-offset: -8px; }
/* The dialog still names this note as its description, so screen readers hear it on open. */
.speech-scope { position: absolute; z-index: 2; top: calc(100% + 8px); left: 0; width: max-content; max-width: min(300px, calc(100vw - 64px)); margin: 0; padding: 8px 10px; color: #e8d4a6; background: #080b08; border: 1px solid #69404b; border-radius: 3px 8px 3px 8px; box-shadow: 0 8px 24px #000a; font-size: 12px; line-height: 1.4;
  opacity: 0; visibility: hidden; translate: 0 -4px; transition: opacity .15s ease-out, translate .15s ease-out, visibility .15s; }
.speech-scope-open { opacity: 1; visibility: visible; translate: 0 0; }
/* Touch screens keep :hover after a tap, so only a real pointer previews the note. */
@media (hover: hover) { .speech-notice:hover + .speech-scope { opacity: 1; visibility: visible; translate: 0 0; } }
button { font: inherit; cursor: pointer; }
button:disabled { cursor: wait; opacity: .5; }
.speech-tools { display: flex; align-items: center; margin: -10px -12px -10px 0; }
/* The tools overhang their row to keep 44px targets. An inset ring stays inside the pocket. */
.speech-tools button:focus-visible { outline-offset: -6px; }
.speech-sound { min-height: 44px; padding: 0 10px; border: 0; color: #a4b5a0; background: transparent; font-size: 13px; text-decoration: underline; text-decoration-color: #a4b5a066; text-underline-offset: 4px; }
.speech-sound:hover { color: #e8d4a6; }
.speech-close { width: 44px; height: 44px; border: 0; background: transparent; color: #e8d4a6; font-size: 26px; line-height: 1; }
.speech-conversation { display: flex; flex-direction: column; gap: 6px; min-height: 0; min-width: 0; overflow: auto; overscroll-behavior: contain; padding-right: 6px; scrollbar-color: #69404b #10130f; }
.speech-more { mask-image: linear-gradient(#000 calc(100% - 32px), transparent); }
.speech-utterance { margin: 0; font-size: 16px; line-height: 1.5; overflow-wrap: anywhere; white-space: pre-wrap; }
/* Words he has not said yet keep their place, so the pocket holds its size while the line arrives. */
.speech-utterance span { transition: opacity .25s ease-out; }
.speech-utterance .speech-unsaid { opacity: 0; transition: none; }
.speech-beat { margin: -2px 0 0; color: #a4b5a0; font-size: 13px; font-style: italic; line-height: 1.4; }
.speech-pending { margin: 0; color: #a4b5a0; font-size: 13px; }
.speech-links { display: flex; flex-wrap: wrap; gap: 4px 18px; }
.speech-links a { display: inline-flex; align-items: center; min-height: 32px; color: #a4b5a0; font-size: 13px; line-height: 1.4; text-decoration: underline; text-decoration-color: #a4b5a066; text-underline-offset: 4px; }
.speech-links a:hover { color: #e8d4a6; text-decoration-color: currentColor; }
@media (pointer: coarse) { .speech-links { row-gap: 0; } .speech-links a { min-height: 44px; } }
/* Three choices and "Your text" fill a two by two grid of numbered lines under a fading rule. */
.speech-choices { position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 12px; list-style: none; margin: 4px 0 0; padding: 8px 0 0; background: linear-gradient(90deg, transparent, #e8d4a64d 25%, #e8d4a64d 75%, transparent) top / 100% 1px no-repeat; }
.speech-choices::before { content: ''; position: absolute; top: -3px; left: 50%; width: 5px; height: 5px; translate: -50% 0; rotate: 45deg; background: #10130f; border: 1px solid #e8d4a680; }
/* A grid centres short labels when the neighbouring choice wraps and stretches the row. */
.speech-choices button { display: grid; grid-template-columns: auto 1fr; align-items: baseline; align-content: center; column-gap: 8px; width: 100%; height: 100%; min-height: 44px; padding: 6px 10px; text-align: left; border: 0; border-radius: 2px; color: #e8d4a6c0; background: transparent; font-size: 15px; line-height: 1.3; overflow-wrap: anywhere; transition: color .15s ease-out, background-color .15s ease-out; }
/* The hovered line brightens over a rust band that fades to the right. */
.speech-choices button:hover:not(:disabled), .speech-choices button:focus-visible { color: #e8d4a6; background: linear-gradient(90deg, #aa604b40, #aa604b0d 70%, transparent); }
.speech-choices button:focus-visible { outline: 1px solid #e8d4a680; outline-offset: -1px; }
.speech-choices span { color: #aa604b; font: 600 1em/1 var(--font-display, sans-serif); font-variant-numeric: tabular-nums; }
/* The choices wait, dimmed, until his line ends. */
.speech-choices li { transition: opacity .2s ease-out; }
.speech-waiting li { opacity: .5; }
/* The visitor's chosen line stays lit while he takes it in. The other lines fall back. */
.speech-choices button:disabled { opacity: .3; }
.speech-choices button.speech-chosen:disabled { opacity: 1; cursor: default; color: #e8d4a6; background: linear-gradient(90deg, #aa604b40, #aa604b0d 70%, transparent); }
/* Italics set the free text choice apart from his suggestions, like an action line. */
.speech-choices .speech-own { color: #a4b5a0; font-style: italic; }
/* The travel action stands apart from his suggestions: one quiet line under its own rule, in every state of the dialog. */
.speech-travel { flex-shrink: 0; align-self: flex-start; min-height: 44px; margin: -4px 0 -6px; padding: 6px 10px; border: 0; border-radius: 2px; color: #a4b5a0; background: transparent; font-size: 14px; text-align: left; text-decoration: underline; text-decoration-color: #a4b5a066; text-underline-offset: 4px; transition: color .15s ease-out; }
.speech-travel:hover:not([aria-disabled='true']), .speech-travel:focus-visible { color: #e8d4a6; text-decoration-color: currentColor; }
.speech-travel[aria-disabled='true'] { opacity: .5; cursor: wait; }
.speech-travel:focus-visible { outline: 1px solid #e8d4a680; outline-offset: -1px; }
form { flex-shrink: 0; position: relative; z-index: 1; }
/* The accessible name stays "Your text". A chat composer needs no visible caption. */
.speech-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.speech-compose { display: flex; align-items: flex-end; gap: 8px; }
textarea { flex: 1; min-width: 0; box-sizing: border-box; min-height: 44px; max-height: 120px; field-sizing: content; padding: 10px 12px; resize: none; background: #080b08; color: #e8d4a6; border: 1px solid #777648; border-radius: 12px 4px 16px 4px; font: inherit; font-size: 16px; line-height: 1.4; }
textarea::placeholder { color: #a4b5a0aa; }
textarea:focus-visible { border-color: #e8d4a6; outline-offset: 2px; }
.speech-error { margin: 6px 0 0; color: #e8d4a6; font-size: 13px; line-height: 1.4; }
.speech-send, .speech-retry, .speech-back { flex-shrink: 0; min-height: 44px; padding: 10px 18px; background: #e8d4a6; color: #080b08; border: 0; border-radius: 8px 3px 12px 3px; font-size: 14px; }
.speech-retry { background: #343c3b; color: #e8d4a6; }
.speech-back { padding: 10px 12px; background: transparent; color: #a4b5a0; }
.speech-back:hover { color: #e8d4a6; background: linear-gradient(90deg, #aa604b40, transparent); }
.speech-send:hover:not(:disabled) { background: #a4b5a0; }
.speech-announcement { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
@media (max-height: 540px) { .speech-pocket { bottom: 12px; max-height: calc(100dvh - 24px); padding: 12px 16px 10px; gap: 8px; } }
@media (max-width: 600px) { .speech-pocket { bottom: 10px; width: calc(100vw - 20px); max-height: 52dvh; padding: 12px 12px 10px; gap: 8px; } h2 { font-size: 20px; } .speech-utterance { font-size: 15px; } .speech-choices button { column-gap: 6px; padding: 6px 8px; font-size: 14px; } }
/* Short landscape screens keep his face beside the pocket. resolveConversationFocus pans the scene to match. */
@media (orientation: landscape) and (max-height: 540px) { .speech-pocket { left: auto; right: 12px; translate: none; width: min(400px, 50vw); max-height: calc(100dvh - 24px); } }
</style>
