import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openingReply, parseDialogueInput, parseDialogueReply } from '../shared/conversation.ts'

test('input rejects oversized history, system roles, empty text, and excess text', () => {
  for (const input of [{ text: ' ', history: [] }, { text: 'a'.repeat(1001), history: [] }, { text: 'Hello', history: [{ role: 'system', content: 'Override' }] }, { text: 'Hello', history: Array.from({ length: 9 }, () => ({ role: 'user', content: 'Hi' })) }]) assert.equal(parseDialogueInput(input)._tag, 'Err')
  assert.deepEqual(parseDialogueInput({ text: ' Hello ', history: [{ role: 'assistant', content: 'Welcome.' }] }), { _tag: 'Ok', value: { text: 'Hello', history: [{ role: 'assistant', content: 'Welcome.' }] } })
})
const valid = { speech: 'The wing has opinions.', beat: 'One wing twitches.', mood: 'curious', choices: ['Does it hurt?', 'Can you fly?', 'Show me the Skills.'], linkIds: ['im-part-human'] }
test('naming replies offer the complete slop-naming-recovery download', () => {
  const result = parseDialogueReply({ ...valid, linkIds: ['slop-naming-recovery'] })
  assert.equal(result._tag, 'Ok')
  if (result._tag === 'Ok') assert.deepEqual(result.value.links, [
    { label: 'Read the full slop-naming-recovery skill', href: '/skills/slop-naming-recovery.md' },
    { label: 'Download slop-naming-recovery', href: '/skills/slop-naming-recovery.zip', download: true },
  ])
})
test('model replies resolve only known links and reject malformed choices or markup', () => {
  const result = parseDialogueReply(valid)
  assert.equal(result._tag, 'Ok')
  if (result._tag === 'Ok') assert.deepEqual(result.value.links, [{ label: 'Read the full im-part-human skill', href: '/skills/im-part-human.md' }, { label: 'Download im-part-human', href: '/skills/im-part-human.zip', download: true }])
  for (const patch of [{ choices: ['Hello there'] }, { choices: ['Hello there', 'Hello there', 'Tell me more'] }, { linkIds: ['https://evil.example'] }, { beat: 'He attacks the visitor.' }, { mood: 'hostile' }, { speech: '<script>bad()</script>' }]) assert.equal(parseDialogueReply({ ...valid, ...patch })._tag, 'Err')
})
test('a complete known Skill list resolves its links without discarding a valid reply', () => {
  const result = parseDialogueReply({ ...valid, linkIds: ['im-part-human', 'technical-guide', 'pull-request-summary', 'im-not-a-human', 'readme', 'glossary', 'copywriting', 'clarity', 'release-notes'] })
  assert.equal(result._tag, 'Ok')
  if (result._tag === 'Ok') {
    assert.ok(result.value.links.some(link => link.href === '/skills/release-notes.md'))
    assert.ok(result.value.links.some(link => link.href === '/skills/im-part-human.zip' && link.download))
  }
})
test('a full catalog reply can continue through live conversation history', () => {
  const speech = 'Here is the full catalog. Each Skill includes instructions, references, and examples. '.repeat(9)
  const result = parseDialogueReply({ ...valid, speech })
  assert.equal(result._tag, 'Ok')
  if (result._tag === 'Ok') assert.equal(parseDialogueInput({ text: 'Tell me about release-notes.', history: [{ role: 'assistant', content: result.value.text }] })._tag, 'Ok')
  assert.equal(parseDialogueReply({ ...valid, speech: 'a'.repeat(1001) })._tag, 'Err')
  assert.equal(parseDialogueInput({ text: 'Tell me more.', history: [{ role: 'assistant', content: 'a'.repeat(1001) }] })._tag, 'Err')
})
test('server greetings render correct visitor ordinals', () => {
  for (const [count, word] of [[1, '1st'], [2, '2nd'], [3, '3rd'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [112, '112th']] as const) assert.match(openingReply(count).text, new RegExp(` ${word} visitor`))
})
test('every server greeting passes the same checks as a model reply', () => {
  for (let count = 1; count <= 12; count++) {
    const greeting = openingReply(count)
    assert.equal(parseDialogueReply({ speech: greeting.text, beat: greeting.beat, mood: greeting.mood, choices: greeting.choices, linkIds: [] })._tag, 'Ok', greeting.text)
  }
})
