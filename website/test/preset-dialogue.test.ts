import assert from 'node:assert/strict'
import { test } from 'node:test'
import { choiceNeedsInput, parsePresetGraph, resolveOpeningPreset, resolvePresetChoice } from '../shared/preset-dialogue.ts'
import { linkIds } from '../shared/conversation.ts'

const reply = { speech: 'I can give you one line.', beat: 'A claw writes in the air.', mood: 'curious', choices: ['Write one about you.', 'Here is my sentence.', 'Tell me about the cave.'], linkIds: ['im-part-human'] }
const fixture = () => ({ version: 1, sourceHash: 'a'.repeat(64), catalog: [...linkIds], depth: 3, model: 'openai/gpt-6-luna', roots: ['opening-0'], nodes: [
  { id: 'opening-0', reply, targets: [{ _tag: 'Reply', id: 'line' }, { _tag: 'Compose' }, { _tag: 'Live' }] },
  { id: 'line', reply: { ...reply, speech: 'The wall keeps the words I keep rewriting.' }, targets: [{ _tag: 'Live' }, { _tag: 'Compose' }, { _tag: 'Live' }] },
] })

test('a new Skill catalog uses live dialogue for Skill replies without invalidating character replies', () => {
  const data = fixture()
  data.nodes[0]!.targets[2] = { _tag: 'Reply', id: 'character' }
  data.nodes.push({ id: 'character', reply: { ...reply, speech: 'The cave still breathes.', linkIds: [] }, targets: [{ _tag: 'Live' }, { _tag: 'Compose' }, { _tag: 'Live' }] })
  const parsed = parsePresetGraph(data)
  if (parsed._tag === 'Err') throw new Error(parsed.message)
  const expanded = [...linkIds, 'new-skill-fixture']
  assert.deepEqual(resolvePresetChoice(parsed.value, 'opening-0', 0, expanded), { _tag: 'Live', text: reply.choices[0] })
  assert.equal(resolvePresetChoice(parsed.value, 'opening-0', 2, expanded)._tag, 'Reply')
  assert.equal(resolvePresetChoice(parsed.value, 'opening-0', 0, [...linkIds])._tag, 'Reply')
})

test('a preset delivers the complete generated reply with its movement, mood, and links', () => {
  const parsed = parsePresetGraph(fixture())
  assert.equal(parsed._tag, 'Ok')
  if (parsed._tag === 'Err') return
  assert.deepEqual(resolvePresetChoice(parsed.value, 'opening-0', 0), { _tag: 'Reply', id: 'line', reply: {
    text: 'The wall keeps the words I keep rewriting.', beat: reply.beat, mood: reply.mood, choices: reply.choices,
    links: [{ label: 'Read the full im-part-human skill', href: '/skills/im-part-human.md' }, { label: 'Download im-part-human', href: '/skills/im-part-human.zip', download: true }],
  } })
})

test('a preset requiring visitor input opens composition instead of inventing the input', () => {
  const parsed = parsePresetGraph(fixture())
  if (parsed._tag === 'Err') throw new Error(parsed.message)
  assert.deepEqual(resolvePresetChoice(parsed.value, 'opening-0', 1), { _tag: 'Compose' })
  assert.deepEqual(resolvePresetChoice(parsed.value, 'opening-0', 2), { _tag: 'Live', text: 'Tell me about the cave.' })
})

test('broken destinations and unknown links cannot become selectable presets', () => {
  const broken = fixture()
  broken.nodes[0]!.targets[0] = { _tag: 'Reply', id: 'missing' }
  assert.equal(parsePresetGraph(broken)._tag, 'Err')
  const unknown = fixture()
  unknown.nodes[1]!.reply.linkIds = ['missing-skill']
  assert.equal(parsePresetGraph(unknown)._tag, 'Err')
})

test('an unknown node or out-of-range selection cannot resolve another conversation', () => {
  const parsed = parsePresetGraph(fixture())
  if (parsed._tag === 'Err') throw new Error(parsed.message)
  assert.deepEqual(resolvePresetChoice(parsed.value, 'missing', 0), { _tag: 'Unavailable' })
  assert.deepEqual(resolvePresetChoice(parsed.value, 'opening-0', 3), { _tag: 'Unavailable' })
})

test('requests for his writing remain dialogue; offers of visitor writing open the input', () => {
  for (const choice of ['Read me one line.', 'Write one about you.', 'Show me a wall line.']) assert.equal(choiceNeedsInput(choice), false, choice)
  for (const choice of ['Can I share a sentence?', 'Here’s my first line.', 'Read my sentence.', 'Make it more personal.', 'I’ll tell you a little.']) assert.equal(choiceNeedsInput(choice), true, choice)
})

test('the verified visitor count remains in the greeting while matching its preset opening', () => {
  const parsed = parsePresetGraph(fixture())
  if (parsed._tag === 'Err') throw new Error(parsed.message)
  const greeting = parsed.value.nodes.get('opening-0')!.reply
  const numbered = { ...greeting, text: `You're my 21st visitor today. ${greeting.text}` }
  assert.deepEqual(resolveOpeningPreset(parsed.value, numbered, 0), { _tag: 'Preset', id: 'opening-0', reply: numbered })
  const changed = { ...numbered, text: 'A new opening with a different meaning.' }
  assert.deepEqual(resolveOpeningPreset(parsed.value, changed, 0), { _tag: 'Generated', reply: changed })
  assert.deepEqual(resolveOpeningPreset(parsed.value, numbered, -1), { _tag: 'Generated', reply: numbered })
})
