import { skills } from './content.ts'

export type ConversationLink = { label: string; href: string; download?: true }
export type ConversationMood = 'curious' | 'wary' | 'amused' | 'soft' | 'neutral'
export type ConversationReply = { text: string; beat: string; mood: ConversationMood; choices: [string, string, string]; links: ConversationLink[] }
export type ConversationHistoryMessage = { role: 'user' | 'assistant'; content: string }
export type ConversationMessage = { _tag: 'User'; text: string } | { _tag: 'Reply'; reply: ConversationReply }
export type Result<T> = { _tag: 'Ok'; value: T } | { _tag: 'Err'; message: string }
/** `beats` holds his last three beats, newest first. The model reads them so it can vary his movement. */
export type DialogueInput = { text: string; history: ConversationHistoryMessage[]; beats: string[] }
export const dialogueCopy = {
  privacy: 'AI replies use Cloudflare and OpenAI. Avoid sharing private details.',
  // The first sentence of the approved visit note in COPY.md. The rest joins it when the site first sends a browser fact.
  visit: 'The site can tell that this browser was here on an earlier day.',
  loading: 'He listens…', failure: 'No reply came back. Your text is still here.',
  // A failed greeting has no visitor text to keep.
  failedGreeting: 'No reply came back.',
  limit: 'Replies are limited. Wait a minute and try again, or come back after midnight UTC.',
  expired: 'Your session ended and this conversation was cleared. Select “Try again” to start a new one.',
  empty: 'Add some text first.', length: 'Keep your text under 1,001 characters.',
}
// Each beat is a mannerism the scene can perform. Human habits first, then fly habits.
export const beats = ['', 'He checks an empty palm.', 'He tilts his head.', 'His jaw catches.', 'He leans closer.', 'A claw writes in the air.', 'He glances at the eggs.',
  'One wing twitches.', 'His wings buzz once.', 'His small hands rub together.', 'He wipes an eye with his wrist.', 'He listens to the ceiling.', 'He looks toward the light.', 'He goes very still.']
export const moods: ConversationMood[] = ['curious', 'wary', 'amused', 'soft', 'neutral']
export const linkIds = ['brand-kit', ...skills.map(skill => skill.name)]
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const plain = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]|<\/?[a-z][^>]*>/i.test(value)
const fail = <T>(message: string): Result<T> => ({ _tag: 'Err', message })
const MAX_REPLY_LENGTH = 1000

export const parseDialogueInput = (value: unknown): Result<DialogueInput> => {
  if (!record(value) || typeof value.text !== 'string') return fail(dialogueCopy.empty)
  if (value.text.length > 1000) return fail(dialogueCopy.length)
  const text = value.text.trim()
  if (!plain(text, 1000)) return fail(dialogueCopy.empty)
  if (!Array.isArray(value.history) || value.history.length > 8) return fail(dialogueCopy.failure)
  const history: ConversationHistoryMessage[] = []
  for (const message of value.history) {
    if (!record(message) || (message.role !== 'user' && message.role !== 'assistant') || !plain(message.content, message.role === 'user' ? 1000 : MAX_REPLY_LENGTH)) return fail(dialogueCopy.failure)
    history.push({ role: message.role, content: message.content })
  }
  const recent = value.beats ?? []
  if (!Array.isArray(recent) || recent.length > 3 || !recent.every((beat): beat is string => typeof beat === 'string' && beats.includes(beat))) return fail(dialogueCopy.failure)
  return { _tag: 'Ok', value: { text, history, beats: recent } }
}

export const parseDialogueReply = (value: unknown): Result<ConversationReply> => {
  if (!record(value) || !plain(value.speech, MAX_REPLY_LENGTH) || typeof value.beat !== 'string' || !beats.includes(value.beat) || !moods.includes(value.mood as ConversationMood)) return fail(dialogueCopy.failure)
  if (!Array.isArray(value.choices) || value.choices.length !== 3 || !value.choices.every(choice => plain(choice, 100) && choice.trim().split(/\s+/).length >= 2 && choice.trim().split(/\s+/).length <= 12)) return fail(dialogueCopy.failure)
  const [first, second, third] = value.choices as [string, string, string]
  if (new Set([first.trim().toLowerCase(), second.trim().toLowerCase(), third.trim().toLowerCase()]).size !== 3) return fail(dialogueCopy.failure)
  if (!Array.isArray(value.linkIds) || value.linkIds.length > linkIds.length || !value.linkIds.every(id => typeof id === 'string' && linkIds.includes(id))) return fail(dialogueCopy.failure)
  const links: ConversationLink[] = [...new Set(value.linkIds as string[])].flatMap(id => id === 'brand-kit'
    ? [{ label: 'Brand kit', href: '/brand-kit/' }]
    : [{ label: `Read the full ${id} skill`, href: `/skills/${id}.md` }, { label: `Download ${id}`, href: `/skills/${id}.zip`, download: true }])
  return { _tag: 'Ok', value: { text: value.speech.trim(), beat: value.beat, mood: value.mood as ConversationMood, choices: [first.trim(), second.trim(), third.trim()], links } }
}

export const ordinal = (count: number) => `${count}${count % 100 >= 11 && count % 100 <= 13 ? 'th' : count % 10 === 1 ? 'st' : count % 10 === 2 ? 'nd' : count % 10 === 3 ? 'rd' : 'th'}`
type Opening = Omit<ConversationReply, 'text' | 'links'> & { line: string }
// The verified count opens every greeting. The rest varies by visitor, so a reopened dialog keeps its opening.
const openings: Opening[] = [
  { line: 'I kept count. The extra hands finally earned their keep.', beat: 'He checks an empty palm.', mood: 'curious',
    choices: ['Are you all right?', 'What is this place?', 'Show me what you make.'] },
  { line: 'I scratched the number into the wall. It will heal over by morning. It always does.', beat: 'A claw writes in the air.', mood: 'neutral',
    choices: ['Why does the wall heal?', 'What else do you write?', 'Are you all right?'] },
  { line: 'Mind the eggs. They get very quiet when somebody calls them furniture.', beat: 'He glances at the eggs.', mood: 'wary',
    choices: ["What's inside them?", 'Should I be worried?', "Fine. I'll compliment them."] },
  { line: "Sorry. The wing isn't waving at you. It does things without telling me.", beat: 'One wing twitches.', mood: 'amused',
    choices: ['Does it hurt?', 'Can you fly?', 'I like its confidence.'] },
  { line: "Words are easier to rearrange than joints. Brought something that won't sit right?", beat: 'He leans closer.', mood: 'soft',
    choices: ['My writing sounds wrong.', 'Tell me what you do.', 'I just came to look.'] },
  { line: 'You stayed, which is new. Most things in here only stop moving when something goes wrong.', beat: 'He goes very still.', mood: 'wary',
    choices: ['Are you all right?', 'What is this place?', 'I was promised useful Skills.'] },
]
export const openingReply = (count: number): ConversationReply => {
  const opening = openingSeed(openingIndex(count))
  return { ...opening, text: `You're my ${ordinal(count)} visitor today. ${opening.text}` }
}
export const openingIndex = (count: number) => count % openings.length
export const openingSeed = (index: number): ConversationReply => {
  const { line, ...opening } = openings[index]!
  return { text: line, ...opening, links: [] }
}
export const openingSeeds = (): ConversationReply[] => openings.map((_, index) => openingSeed(index))

// These openings depend on a fact about the visit. They have no cached branch, so each choice gets a live reply.
// The return lines claim an earlier visit only. The server stores no conversations, so he never claims to remember one.
const returnOpenings: Opening[] = [
  { line: "You've been here before. The room kept that much. It kept nothing else, and neither did I, so start anywhere.", beat: 'He tilts his head.', mood: 'neutral',
    choices: ['What does the room keep?', "Why don't you remember?", 'Show me what you make.'] },
  { line: "Back again. Good. I've turned the eggs since, and one wing got slightly worse. That's all the news.", beat: 'One wing twitches.', mood: 'amused',
    choices: ['Worse how?', 'How are the eggs?', 'What do you make here?'] },
]
// The late lines hedge the hour. He never states a clock time.
const lateOpenings: Opening[] = [
  { line: "The opening's gone dark. You're up late, or I am. I stopped being able to tell.", beat: 'He looks toward the light.', mood: 'neutral',
    choices: ['Do you sleep?', 'What happens here at night?', 'Why are you still up?'] },
  { line: "Late for a visit. I don't mind. The drips slow down at night, and there's less to count.", beat: 'He listens to the ceiling.', mood: 'neutral',
    choices: ['What do you count?', 'Is it quiet at night?', 'What is this place?'] },
]
// Approved general openings that wait outside the rotation. They have no cached branch yet.
// In the rotation they would send about half of all first choices to live replies.
const held: Opening[] = [
  { line: 'I practised a greeting. Then you arrived and both wings buzzed, so now you know I practised.', beat: 'His wings buzz once.', mood: 'amused',
    choices: ["Let's hear the greeting.", 'Why do they buzz?', 'What is this place?'] },
  { line: 'Hh. Sorry. The first word always takes a run-up. This mouth was built for something else.', beat: 'His jaw catches.', mood: 'neutral',
    choices: ['Does it hurt to talk?', 'Take your time.', 'What was it built for?'] },
  { line: 'Hold on. Dust in one eye. The wrist handles that now. It never asked me. It just started.', beat: 'He wipes an eye with his wrist.', mood: 'amused',
    choices: ['Do your hands do that often?', 'Which parts are still yours?', 'Are you all right?'] },
  { line: "Ignore the small hands. They rub together when someone new comes in. I've asked what they're planning. They don't say.", beat: 'His small hands rub together.', mood: 'amused',
    choices: ['Should I be worried?', 'What else do they do?', 'Hello, small hands.'] },
  { line: "The ceiling dripped in threes all day. Then you came in and it lost count. I'd like to know what it was counting.", beat: 'He listens to the ceiling.', mood: 'curious',
    choices: ['What do you think it counts?', 'Does it always drip?', 'Sorry to interrupt.'] },
  { line: 'The light at the opening moved when you came in. I looked. I always look. Then I remembered I had company.', beat: 'He looks toward the light.', mood: 'neutral',
    choices: ["What's out there?", 'Why do you always look?', 'Are you all right?'] },
]
const seed = ({ line, ...opening }: Opening): ConversationReply => ({ text: line, ...opening, links: [] })
export const heldOpenings = (): ConversationReply[] => held.map(seed)

/** What the site knows about a visit. The server verifies the count and the return. The hour is the browser's own and never leaves it. */
export type VisitFacts = { ordinal: number; returning: boolean; hour: number | undefined }
/** Reads the server's visit reply. The count and the return are the two facts the server verifies. */
export const parseVisit = (value: unknown): Result<Pick<VisitFacts, 'ordinal' | 'returning'>> =>
  record(value) && typeof value.ordinal === 'number' && Number.isInteger(value.ordinal) && value.ordinal > 0 && typeof value.returning === 'boolean'
    ? { _tag: 'Ok', value: { ordinal: value.ordinal, returning: value.returning } } : fail(dialogueCopy.failedGreeting)
// 23:00 to 04:59, by the visitor's clock.
const late = (hour: number | undefined) => hour !== undefined && (hour >= 23 || hour < 5)
/**
 * Picks the greeting for a visit. A return is the rarer fact, so it wins over a late hour.
 * The count picks between a condition's lines, so a reopened dialog keeps its opening.
 * `preset` is the cached branch of the opening, or -1 when its choices get live replies.
 */
export const chooseOpening = ({ ordinal: count, returning, hour }: VisitFacts): { reply: ConversationReply; preset: number } => {
  const conditional = returning ? returnOpenings : late(hour) ? lateOpenings : undefined
  if (!conditional) return { reply: openingReply(count), preset: openingIndex(count) }
  const opening = seed(conditional[count % conditional.length]!)
  return { reply: { ...opening, text: `You're my ${ordinal(count)} visitor today. ${opening.text}` }, preset: -1 }
}

/** A line he says when no reply came back. The site shows a plain status and a retry beside it. It never enters the conversation history. */
export type FallbackLine = Pick<ConversationReply, 'text' | 'beat' | 'mood'>
const fallbacks: { line: string; beat: string; greeting?: true }[] = [
  { line: "That didn't come out. The mouth does this sometimes. Your words are safe. Mine went missing.", beat: 'His jaw catches.' },
  { line: "The words jammed on the way out. It's this mouth. Nothing you said did it.", beat: 'He tilts his head.' },
  { line: "A wing went off in the middle of that, and I lost the sentence. Ask me again, if you don't mind.", beat: 'One wing twitches.' },
  { line: "That came out as noise. I won't hand you noise. Give me another go.", beat: 'His wings buzz once.', greeting: true },
  { line: "I lost my place. The ceiling dripped and I started counting. Ask again and I'll keep my hands still.", beat: 'He listens to the ceiling.' },
  { line: "I opened my mouth and nothing fit through. Some days it's a narrow door. Try me once more.", beat: 'His jaw catches.', greeting: true },
]
/** `failures` counts earlier failures of that kind, so the lines rotate. A failed greeting has no visitor text, so it takes only lines that mention none. */
export const fallbackLine = (kind: 'visit' | 'dialogue', failures: number): FallbackLine => {
  const lines = kind === 'visit' ? fallbacks.filter(fallback => fallback.greeting) : fallbacks
  const { line, beat } = lines[failures % lines.length]!
  return { text: line, beat, mood: 'neutral' }
}

// Stage directions shown while a live reply loads. The site picks one before it knows the topic, so none is a joke.
const listening = [dialogueCopy.loading, 'He turns the words over…', 'All four hands go still…', 'He works his jaw…', 'He weighs a word…', 'One wing folds flat…', 'He looks at the wall, then back…']
/** `turn` counts the live replies asked for so far. The first is the canonical line. */
export const listeningLine = (turn: number) => listening[turn % listening.length]!
