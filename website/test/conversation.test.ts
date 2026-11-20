import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chooseOpening, dialogueCopy, fallbackLine, heldOpenings, listeningLine, openingReply, parseDialogueInput, parseDialogueReply, parseVisit } from '../shared/conversation.ts'

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
const day = { returning: false, hour: 14 }
test('every greeting, held opening, and fallback line passes the same checks as a model reply', () => {
  const valid = (line: { text: string, beat: string, mood: string }, choices: readonly string[]) =>
    assert.equal(parseDialogueReply({ speech: line.text, beat: line.beat, mood: line.mood, choices, linkIds: [] })._tag, 'Ok', line.text)
  for (let count = 1; count <= 12; count++) {
    for (const facts of [day, { returning: true, hour: 14 }, { returning: false, hour: 23 }, { returning: false, hour: undefined }]) {
      const greeting = chooseOpening({ ordinal: count, ...facts }).reply
      valid(greeting, greeting.choices)
    }
  }
  for (const opening of heldOpenings()) valid(opening, opening.choices)
  for (const kind of ['visit', 'dialogue'] as const) for (let failures = 0; failures < 6; failures++) valid(fallbackLine(kind, failures), ['Try once more.', 'Say it again.', 'Take your time.'])
})
test('a first visit by day keeps the opening the count picks, and its cached branch', () => {
  for (const facts of [day, { returning: false, hour: undefined }, { returning: false, hour: 5 }, { returning: false, hour: 22 }]) {
    for (let count = 1; count <= 12; count++) {
      const chosen = chooseOpening({ ordinal: count, ...facts })
      assert.deepEqual(chosen.reply, openingReply(count))
      assert.equal(chosen.preset, count % 6)
    }
  }
})
test('a return visit and a late visit get their own openings, which have no cached branch', () => {
  const back = [1, 2].map(ordinal => chooseOpening({ ordinal, returning: true, hour: 14 }))
  const late = [1, 2].map(ordinal => chooseOpening({ ordinal, returning: false, hour: 23 }))
  for (const chosen of [...back, ...late]) assert.equal(chosen.preset, -1)
  assert.match(back[0]!.reply.text, /^You're my 1st visitor today\. /)
  assert.equal(new Set([...back, ...late].map(chosen => chosen.reply.text.replace(/^You're my \S+ visitor today\. /, ''))).size, 4, 'Each condition must have two lines, and the count picks one.')
  for (const hour of [23, 0, 4]) assert.equal(chooseOpening({ ordinal: 1, returning: false, hour }).reply.text, late[0]!.reply.text, `${hour}:00 is late.`)
  // A return is the rarer fact, so it wins over the hour.
  assert.equal(chooseOpening({ ordinal: 1, returning: true, hour: 23 }).reply.text, back[0]!.reply.text)
  assert.deepEqual(chooseOpening({ ordinal: 3, returning: true, hour: 14 }), chooseOpening({ ordinal: 3, returning: true, hour: 14 }), 'A reopened dialog keeps its opening.')
})
test('no approved opening is soft, and the six held openings wait outside the rotation', () => {
  const held = heldOpenings()
  assert.equal(held.length, 6)
  const rotation = new Set(Array.from({ length: 24 }, (_, count) => chooseOpening({ ordinal: count + 1, ...day }).reply.text.replace(/^You're my \S+ visitor today\. /, '')))
  for (const opening of held) {
    assert.notEqual(opening.mood, 'soft')
    assert.ok(!rotation.has(opening.text), opening.text)
  }
})
test('failed replies rotate six neutral fallback lines, and a failed greeting never mentions the visitor\'s words', () => {
  const lines = Array.from({ length: 6 }, (_, failures) => fallbackLine('dialogue', failures))
  assert.equal(new Set(lines.map(line => line.text)).size, 6)
  assert.deepEqual(fallbackLine('dialogue', 6), lines[0])
  for (const line of lines) assert.equal(line.mood, 'neutral')
  const greetings = Array.from({ length: 4 }, (_, failures) => fallbackLine('visit', failures))
  assert.equal(new Set(greetings.map(line => line.text)).size, 2)
  for (const line of greetings) assert.doesNotMatch(line.text, /your words|you said|ask/i)
})
test('a visit reply needs a whole positive count and a return flag', () => {
  assert.deepEqual(parseVisit({ ordinal: 7, returning: true, extra: 'ignored' }), { _tag: 'Ok', value: { ordinal: 7, returning: true } })
  for (const value of [null, {}, { ordinal: 0, returning: false }, { ordinal: 1.5, returning: false }, { ordinal: '7', returning: false }, { ordinal: 7 }, { greeting: { text: 'Old reply shape.' }, opening: 1 }]) assert.equal(parseVisit(value)._tag, 'Err')
})
test('the pending line starts as the canonical one and rotates through seven', () => {
  assert.equal(listeningLine(0), dialogueCopy.loading)
  const lines = Array.from({ length: 7 }, (_, turn) => listeningLine(turn))
  assert.equal(new Set(lines).size, 7)
  assert.equal(listeningLine(7), dialogueCopy.loading)
  for (const line of lines) assert.match(line, /…$/)
})
