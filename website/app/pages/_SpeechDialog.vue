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

const { open, place, foundDark = false, travelling = false, muted = false, soundAvailable = true } = defineProps<{ open: boolean, place: SetName, foundDark?: boolean, travelling?: boolean, muted?: boolean, soundAvailable?: boolean }>()
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
        return visit._tag === 'Ok' ? { _tag: 'Reply' as const, value: chooseOpening({ ...visit.value, hour: new Date().getHours(), place, foundDark }) } : { _tag: 'Error' as const, status: undefined }
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
.speech-pocket {
  --ivory: #f5efdf; --gold: #e4cb92; --muted: #d2cbbc;
  position:fixed; inset:auto auto max(1.25rem,env(safe-area-inset-bottom)) 50%; translate:-50% 0;
  display:none; box-sizing:border-box; width:min(44rem,84vw); max-height:min(56dvh,32rem);
  margin:0; padding:0 .75rem; border:0; background:transparent; color:var(--ivory); overflow:visible;
  font:normal clamp(16px,1.22vw,19px)/1.38 Georgia,serif; text-shadow:0 1px 3px #080907,0 0 7px #11130d;
}
.speech-pocket[open] { display:flex; flex-direction:column; gap:.3rem; }
.speech-pocket::backdrop {
  background:linear-gradient(to top, #0a0b09fa 0%, #0a0b09eb 18%, #0c0e0cb3 34%, #0c0d0b45 48%, transparent 64%);
}
.speech-pocket header,.speech-name,.speech-tools { display:flex; align-items:center; }
.speech-pocket header { flex:none; justify-content:space-between; gap:.75rem; }
.speech-name { position:relative; }
h2 { margin:0; color:var(--gold); font:600 .84em/1.3 Georgia,serif; letter-spacing:.14em; text-transform:uppercase; }
button { font:inherit; color:inherit; cursor:pointer; border:0; background:transparent; text-shadow:inherit; }
button:disabled { cursor:wait; }
button:focus-visible,a:focus-visible,textarea:focus-visible { outline:1px solid var(--gold); outline-offset:1px; }
.speech-tools button,.speech-notice { min-width:44px; min-height:44px; font-size:.8em; color:var(--muted); }
.speech-tools .speech-close { font-size:1.5em; }
.speech-notice { display:grid; place-content:center; }
.speech-notice span { width:15px; height:15px; border:1px solid #c7ba93a8; border-radius:50%; font:normal 12px/15px Georgia,serif; }
.speech-tools button:hover,.speech-notice:hover { color:var(--gold); }
.speech-scope { position:absolute; z-index:3; bottom:100%; left:0; width:min(29ch,75vw); margin:0; padding:.8em 1em;
  background:#12140ff5; color:var(--ivory); font:normal .85em/1.45 system-ui,sans-serif; visibility:hidden; }
.speech-scope-open { visibility:visible; }
@media(hover:hover) { .speech-notice:hover + .speech-scope { visibility:visible; } }
.speech-conversation { min-height:0; overflow:auto; overscroll-behavior:contain; padding:2px 6px 2px 1px; scrollbar-width:thin; scrollbar-color:#90846b transparent; }
.speech-more { mask-image:linear-gradient(#000 calc(100% - 14px),transparent); }
.speech-utterance { margin:0; line-height:1.42; font-size:1.12em; white-space:pre-wrap; overflow-wrap:anywhere; }
.speech-utterance span { transition:opacity .18s ease-out; }
.speech-utterance .speech-unsaid { opacity:0; transition:none; }
.speech-beat,.speech-pending { margin:.25em 0 0; color:var(--muted); font-size:.88em; font-style:italic; }
.speech-links { display:flex; flex-wrap:wrap; gap:0 1em; }
.speech-links a,.speech-travel { color:var(--gold); text-underline-offset:.25em; }
.speech-links a { display:inline-flex; align-items:center; min-height:36px; font-size:.9em; }
.speech-choices { display:grid; gap:0; list-style:none; padding:0; margin:.65em 0 0; }
.speech-choices button { position:relative; display:grid; width:100%; grid-template-columns:2ch 1fr; gap:.5em; align-content:center; min-height:35px;
  padding:.22em .5em; text-align:left; color:var(--ivory); line-height:1.28; overflow-wrap:anywhere; }
.speech-choices button span { color:var(--gold); text-align:right; font-variant-numeric:tabular-nums; }
.speech-choices button:hover:not(:disabled),.speech-choices button:focus-visible,.speech-choices .speech-chosen { color:#ffdfa2;
  background:linear-gradient(90deg,#c9a05a25,transparent 85%); }
.speech-choices button:focus-visible { outline:0; box-shadow:inset 2px 0 #e4cb92; }
.speech-choices button:disabled:not(.speech-chosen) { color:#b5b0a4; }
.speech-own { font-style:italic; }
.speech-travel { flex:none; align-self:flex-start; padding:.3em .5em; min-height:34px; font-size:.85em; }
.speech-travel:hover,.speech-sound:hover,.speech-back:hover { text-decoration:underline; }
.speech-travel[aria-disabled=true] { opacity:.55; }
form { flex:none; }
.speech-compose { display:grid; grid-template-columns:1fr auto auto; align-items:center; gap:.2rem .55rem; }
textarea { grid-column:1/-1; grid-row:1; width:100%; min-width:0; box-sizing:border-box; resize:none; min-height:44px; max-height:16dvh;
  field-sizing:content; padding:.55em .65em; font:inherit; font-size:max(16px,1em); color:var(--ivory);
  background:#141610a8; border:0; border-bottom:1px solid #b79b6da6; border-radius:0; }
textarea::placeholder { color:#d0c7b6; }
.speech-back,.speech-retry,.speech-send { min-height:44px; min-width:44px; padding:0 .45em; color:var(--gold); }
.speech-back { grid-column:1; justify-self:start; } .speech-retry { grid-column:2; } .speech-send { grid-column:3; }
.speech-compose button:disabled { color:#ada79a; } .speech-error { margin:.2em 0; font-size:.86em; color:#f1d1a3; }
.speech-announcement,.speech-label { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
@media(max-width:600px) {
  .speech-pocket { width:100%; bottom:max(.4rem,env(safe-area-inset-bottom)); padding:0 1.1rem; max-height:55dvh; }
  .speech-utterance { font-size:1.07em; } .speech-choices { margin-top:.5rem; }
  .speech-choices button,.speech-travel,.speech-links a { min-height:44px; }
}
@media(orientation:landscape) and (max-height:540px) {
  .speech-pocket { left:auto; right:1vw; bottom:.25rem; width:min(430px,53vw); max-height:94dvh; translate:none; }
  .speech-pocket::backdrop { background:linear-gradient(to left,#0b0e09ef 0%,#0b0d09d9 38%,#0b0c0870 57%,transparent 78%); }
}
@media(prefers-reduced-motion:reduce) { .speech-utterance span { transition:none; } }
</style>
