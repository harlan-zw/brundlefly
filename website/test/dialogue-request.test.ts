import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildDialogueRequest } from '../worker/index.ts'

test('live and preset requests describe the supplied Skill catalog', () => {
  for (const visitor of [null, 14]) {
    const request = buildDialogueRequest({ text: 'Do you have a release-notes Skill?', history: [], place: 'lair' }, visitor, ['brand-kit', 'release-notes'])
    const context = /AVAILABLE SKILLS: (\[[^\n]+\])\n/.exec(request.messages[0]!.content)
    assert.ok(context, 'The model must receive the available Skills and their purposes.')
    assert.deepEqual(JSON.parse(context[1]!), [{ name: 'release-notes', description: 'Write release notes that help readers decide whether to upgrade and understand required changes.' }])
  }
})

test('the server tells the model when he is at the office, and says nothing new in the cave', () => {
  const context = (place: 'lair' | 'office') => buildDialogueRequest({ text: 'Where are we?', history: [], place }, 3).messages[0]!.content
  assert.match(context('office'), /PLACE: For this conversation he is at the office/)
  assert.doesNotMatch(context('lair'), /PLACE:/)
  // The office line is the only difference, so the cave's request is the one the cached replies were written for.
  assert.equal(context('office').replace(/ PLACE: [^\n]*?(?= Allowed link IDs:)/, ''), context('lair'))
})
