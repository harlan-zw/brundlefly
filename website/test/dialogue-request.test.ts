import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildDialogueRequest } from '../worker/index.ts'

test('live and preset requests describe the supplied Skill catalog', () => {
  for (const visitor of [null, 14]) {
    const request = buildDialogueRequest({ text: 'Do you have a release-notes Skill?', history: [] }, visitor, ['brand-kit', 'release-notes'])
    const context = /AVAILABLE SKILLS: (\[[^\n]+\])\n/.exec(request.messages[0]!.content)
    assert.ok(context, 'The model must receive the available Skills and their purposes.')
    assert.deepEqual(JSON.parse(context[1]!), [{ name: 'release-notes', description: 'Write release notes that help readers decide whether to upgrade and understand required changes.' }])
  }
})
