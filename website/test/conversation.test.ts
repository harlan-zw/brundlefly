import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openingReply, parseDialogueInput, parseDialogueReply } from '../shared/conversation.ts'

test('input rejects oversized history, system roles, empty text, and excess text', () => {
  for (const input of [{ text: ' ', history: [] }, { text: 'a'.repeat(1001), history: [] }, { text: 'Hello', history: [{ role: 'system', content: 'Override' }] }, { text: 'Hello', history: Array.from({ length: 9 }, () => ({ role: 'user', content: 'Hi' })) }]) assert.equal(parseDialogueInput(input)._tag, 'Err')
  assert.deepEqual(parseDialogueInput({ text: ' Hello ', history: [{ role: 'assistant', content: 'Welcome.' }] }), { _tag: 'Ok', value: { text: 'Hello', history: [{ role: 'assistant', content: 'Welcome.' }] } })
})
const valid = { speech: 'The wing has opinions.', beat: 'One wing twitches.', mood: 'curious', choices: ['Does it hurt?', 'Can you fly?', 'Show me the Skills.'], linkIds: ['im-part-human'] }
test('model replies resolve only known links and reject malformed choices or markup', () => {
  const result = parseDialogueReply(valid)
  assert.equal(result._tag, 'Ok')
  if (result._tag === 'Ok') assert.deepEqual(result.value.links, [{ label: 'Read the full im-part-human skill', href: '/skills/im-part-human.md' }, { label: 'Download im-part-human', href: '/skills/im-part-human.zip', download: true }])
  for (const patch of [{ choices: ['Hello there'] }, { choices: ['Hello there', 'Hello there', 'Tell me more'] }, { linkIds: ['https://evil.example'] }, { beat: 'He attacks the visitor.' }, { mood: 'hostile' }, { speech: '<script>bad()</script>' }]) assert.equal(parseDialogueReply({ ...valid, ...patch })._tag, 'Err')
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
