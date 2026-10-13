import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildDialogueRequest, parseDialogueCompletion } from '../worker/index.ts'

const wire = { speech: 'I can give you one line.', beat: 'A claw writes in the air.', mood: 'curious', choices: ['Write one about you.', 'Tell me about the eggs.', 'Show me the Skills.'], linkIds: ['im-part-human'] }

test('normal model output keeps the same speech, movement, mood, choices, and downloads', async () => {
  const result = await parseDialogueCompletion({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(wire) } }] })
  assert.deepEqual(result, { _tag: 'Ok', value: {
    text: wire.speech, beat: wire.beat, mood: wire.mood, choices: wire.choices,
    links: [{ label: 'Read the full im-part-human skill', href: '/skills/im-part-human.md' }, { label: 'Download im-part-human', href: '/skills/im-part-human.zip', download: true }],
  } })
})

test('truncated or malformed model output cannot become a cached or live reply', async () => {
  for (const completion of [{ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(wire) } }] }, { choices: [{ finish_reason: 'stop', message: { content: '{' } }] }, {}]) assert.equal((await parseDialogueCompletion(completion))._tag, 'Err')
})

test('precomputation retains dialogue context without assigning a future visitor number', () => {
  const input = { text: 'Why does the wall heal?', history: [{ role: 'assistant' as const, content: 'The wall heals every morning.' }] }
  const preset = buildDialogueRequest(input, null)
  const live = buildDialogueRequest(input, 21)
  assert.deepEqual(preset.messages.slice(1), [{ role: 'assistant', content: input.history[0]!.content }, { role: 'user', content: input.text }])
  assert.match(preset.messages[0]!.content, /No visitor ordinal is supplied/)
  assert.match(live.messages[0]!.content, /Visitor ordinal is 21st/)
})
