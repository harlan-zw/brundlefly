import { skills } from './content.ts'

export type ConversationLink = { label: string; href: string; download?: true }
export type ConversationMood = 'curious' | 'wary' | 'amused' | 'soft' | 'neutral'
export type ConversationReply = { text: string; beat: string; mood: ConversationMood; choices: [string, string, string]; links: ConversationLink[] }
export type ConversationHistoryMessage = { role: 'user' | 'assistant'; content: string }
export type ConversationMessage = { _tag: 'User'; text: string } | { _tag: 'Reply'; reply: ConversationReply }
export type Result<T> = { _tag: 'Ok'; value: T } | { _tag: 'Err'; message: string }
export type DialogueInput = { text: string; history: ConversationHistoryMessage[] }
export const dialogueCopy = {
  privacy: 'AI replies use Cloudflare and OpenAI. Avoid sharing private details.',
  loading: 'He listens…', failure: 'The room swallowed that reply. Try again.',
  limit: 'Give him a moment. Try again later.',
  empty: 'Add some text first.', length: 'Keep your text under 1,001 characters.',
}
export const beats = ['', 'One wing twitches.', 'He checks an empty palm.', 'He tilts his head.', 'His jaw catches.', 'He listens to the ceiling.']
export const moods: ConversationMood[] = ['curious', 'wary', 'amused', 'soft', 'neutral']
export const linkIds = ['brand-kit', ...skills.map(skill => skill.name)]
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const plain = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]|<\/?[a-z][^>]*>/i.test(value)
const fail = <T>(message: string): Result<T> => ({ _tag: 'Err', message })

export const parseDialogueInput = (value: unknown): Result<DialogueInput> => {
  if (!record(value) || typeof value.text !== 'string') return fail(dialogueCopy.empty)
  if (value.text.length > 1000) return fail(dialogueCopy.length)
  const text = value.text.trim()
  if (!plain(text, 1000)) return fail(dialogueCopy.empty)
  if (!Array.isArray(value.history) || value.history.length > 8) return fail(dialogueCopy.failure)
  const history: ConversationHistoryMessage[] = []
  for (const message of value.history) {
    if (!record(message) || (message.role !== 'user' && message.role !== 'assistant') || !plain(message.content, message.role === 'user' ? 1000 : 600)) return fail(dialogueCopy.failure)
    history.push({ role: message.role, content: message.content })
  }
  return { _tag: 'Ok', value: { text, history } }
}

export const parseDialogueReply = (value: unknown): Result<ConversationReply> => {
  if (!record(value) || !plain(value.speech, 600) || typeof value.beat !== 'string' || !beats.includes(value.beat) || !moods.includes(value.mood as ConversationMood)) return fail(dialogueCopy.failure)
  if (!Array.isArray(value.choices) || value.choices.length !== 3 || !value.choices.every(choice => plain(choice, 100) && choice.trim().split(/\s+/).length >= 2 && choice.trim().split(/\s+/).length <= 12)) return fail(dialogueCopy.failure)
  const [first, second, third] = value.choices as [string, string, string]
  if (new Set([first.trim().toLowerCase(), second.trim().toLowerCase(), third.trim().toLowerCase()]).size !== 3) return fail(dialogueCopy.failure)
  if (!Array.isArray(value.linkIds) || value.linkIds.length > 8 || !value.linkIds.every(id => typeof id === 'string' && linkIds.includes(id))) return fail(dialogueCopy.failure)
  const links: ConversationLink[] = [...new Set(value.linkIds as string[])].flatMap(id => id === 'brand-kit'
    ? [{ label: 'Brand kit', href: '/brand-kit/' }]
    : [{ label: `Read the full ${id} skill`, href: `/skills/${id}.md` }, { label: `Download ${id}`, href: `/skills/${id}.zip`, download: true }])
  return { _tag: 'Ok', value: { text: value.speech.trim(), beat: value.beat, mood: value.mood as ConversationMood, choices: [first.trim(), second.trim(), third.trim()], links } }
}

export const ordinal = (count: number) => `${count}${count % 100 >= 11 && count % 100 <= 13 ? 'th' : count % 10 === 1 ? 'st' : count % 10 === 2 ? 'nd' : count % 10 === 3 ? 'rd' : 'th'}`
export const openingReply = (count: number): ConversationReply => ({
  text: `You're my ${ordinal(count)} visitor today. I kept count. The extra hands finally earned their keep.`,
  beat: 'He checks an empty palm.', mood: 'curious',
  choices: ['Are you all right?', 'What is this place?', 'Show me what you make.'], links: [],
})
