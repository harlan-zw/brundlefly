import assert from 'node:assert/strict'
import test from 'node:test'
import { breathGroups, groupsSaid, revealTimes } from '../shared/line-reveal.ts'
import { createVoicePhrase, voiceDuration } from '../shared/scene-audio.ts'

const wing = 'Mostly. One wing keeps trying to leave before the rest of me. I\'ve asked it to wait.'
const words = (group: string) => group.trim().split(/\s+/).length

test('breath groups rebuild the line exactly', () => {
  for (const line of [wing, '  Two  spaces,\nthen a new line.  ', 'one', 'Hope is a small thing to carry; it fits between two hands.', '"Stay," he said. (Quietly.)'])
    assert.equal(breathGroups(line).join(''), line)
  assert.deepEqual(breathGroups(''), [])
  assert.deepEqual(breathGroups('   '), ['   '])
})

test('a breath group ends at punctuation and holds five words at most', () => {
  const groups = breathGroups(wing)
  assert.equal(groups[0], 'Mostly. ')
  assert.equal(groups.at(-1), 'I\'ve asked it to wait.')
  for (const group of groups) assert.ok(words(group) <= 5, `"${group}" is longer than one breath.`)
  assert.deepEqual(breathGroups('"Stay," he said. (Quietly.)'), ['"Stay," ', 'he said. ', '(Quietly.)'])
  assert.deepEqual(breathGroups('first line\nsecond line'), ['first line\n', 'second line'])
})

test('a long clause splits into even breaths, with no orphan word', () => {
  assert.deepEqual(breathGroups('one two three four five six'), ['one two three ', 'four five six'])
  assert.deepEqual(breathGroups('one two three four five six seven eight nine ten eleven').map(words), [4, 4, 3])
})

test('groups arrive in order inside the voice, and a longer group holds longer', () => {
  const groups = breathGroups(wing)
  const times = revealTimes(groups, 4)
  assert.equal(times.length, groups.length)
  assert.equal(times[0], 0)
  for (let index = 1; index < times.length; index++) assert.ok(times[index]! > times[index - 1]!)
  assert.ok(times.at(-1)! < 4)
  const [short, long] = [revealTimes(['ab ', 'cd ', 'x'], 3), revealTimes(['ab ', 'cdefgh ', 'x'], 3)]
  assert.ok(long[2]! - long[1]! > short[2]! - short[1]!)
  assert.deepEqual(revealTimes([], 4), [])
  assert.deepEqual(revealTimes(['only'], 4), [0])
})

test('he pauses longer after a sentence than after a comma, and longer after a comma than mid-clause', () => {
  const gap = (first: string) => revealTimes([first, 'abcdef ', 'x'], 3)[1]!
  assert.ok(gap('abc. ') > gap('abc, '))
  assert.ok(gap('abc, ') > gap('abcd '))
})

test('the groups said so far follow the clock', () => {
  const times = [0, 0.5, 1.25]
  assert.equal(groupsSaid(times, -1), 0)
  assert.equal(groupsSaid(times, 0), 1)
  assert.equal(groupsSaid(times, 0.6), 2)
  assert.equal(groupsSaid(times, 9), 3)
})

test('a line finishes arriving before its voice ends', () => {
  for (const line of ['Yes.', wing, wing.repeat(12)]) {
    const duration = voiceDuration('reply', line.length)
    assert.equal(duration, createVoicePhrase('reply', line.length, () => 0.5).duration)
    assert.ok(revealTimes(breathGroups(line), duration).at(-1)! < duration)
  }
})
