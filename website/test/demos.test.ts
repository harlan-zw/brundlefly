import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analyzeWriting, createGuide, createPullRequest } from '../shared/demos.ts'

test('writing signals preserve source and distinguish review from authorship', () => {
  const text = 'It is worth noting that we may utilize a tool in order to review the release on 4 October.'
  const result = analyzeWriting(text)
  assert.equal(result._tag, 'Ok')
  if (result._tag !== 'Ok') return
  assert.equal(result.source, text)
  assert.deepEqual(result.signals.map(signal => signal.phrase), ['It is worth noting that', 'utilize', 'in order to'])
  assert.equal(analyzeWriting('A tapestry hangs in the gallery.')._tag, 'Ok')
})

test('writing review rejects empty and oversized input', () => {
  assert.deepEqual(analyzeWriting('  '), { _tag: 'Err', message: 'Add some text first.' })
  assert.deepEqual(analyzeWriting('a'.repeat(6001)), { _tag: 'Err', message: 'Keep the text under 6,001 characters.' })
})

test('guide structure follows the reader task and preserves supplied specifics', () => {
  const result = createGuide({ task: 'Set up Nuxt 4', reader: 'Vue developers', purpose: 'how-to' })
  assert.equal(result._tag, 'Ok')
  if (result._tag !== 'Ok') return
  assert.match(result.output, /Set up Nuxt 4/)
  assert.match(result.output, /Vue developers/)
  assert.match(result.output, /Prerequisites/)
  assert.doesNotMatch(result.output, /verified|guaranteed/i)
  assert.equal(createGuide({ task: '', reader: 'Developers', purpose: 'reference' })._tag, 'Err')
})

test('PR formatter preserves supplied description and leaves checks unclaimed', () => {
  const result = createPullRequest({ type: 'fix', scope: 'docs', change: 'repair the setup link', why: 'The setup link opens a removed page.' })
  assert.equal(result._tag, 'Ok')
  if (result._tag !== 'Ok') return
  assert.equal(result.title, 'fix(docs): repair the setup link')
  assert.match(result.output, /The setup link opens a removed page\./)
  assert.doesNotMatch(result.output, /tests pass|verified|\[x\]/i)
  assert.equal(createPullRequest({ type: 'fix', scope: 'bad scope', change: 'repair link', why: 'Broken link' })._tag, 'Err')
})
