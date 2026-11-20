import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildDialogueRequest, voiceCatchTurn } from '../worker/index.ts'

test('live and preset requests describe the supplied Skill catalog', () => {
  for (const visitor of [null, 14]) {
    const request = buildDialogueRequest({ text: 'Do you have a release-notes Skill?', history: [], beats: [] }, visitor, ['brand-kit', 'release-notes'])
    const context = /AVAILABLE SKILLS: (\[[^\n]+\])\n/.exec(request.messages[0]!.content)
    assert.ok(context, 'The model must receive the available Skills and their purposes.')
    assert.deepEqual(JSON.parse(context[1]!), [{ name: 'release-notes', description: 'Write release notes that help readers decide whether to upgrade and understand required changes.' }])
  }
})

test('the server line permits a voice catch only when told, and lists his recent beats', () => {
  const line = (beats: string[], voiceCatch?: boolean) => buildDialogueRequest({ text: 'Hello', history: [], beats }, 3, undefined, voiceCatch).messages[0]!.content
  assert.match(line([]), /Voice catch is not permitted this turn\. His recent beats, newest first: none\. /)
  assert.match(line(['His jaw catches.', '', 'One wing twitches.'], true), /Voice catch is permitted this turn\. His recent beats, newest first: "His jaw catches\.", "One wing twitches\."\. /)
})

test('the voice catch falls on a session\'s live turns 2, 7, and 12 of the day', () => {
  assert.deepEqual(Array.from({ length: 13 }, (_, index) => index + 1).filter(voiceCatchTurn), [2, 7, 12])
})
