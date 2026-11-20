import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shotChance, shotLevelAt, shotPeak } from '../shared/audio-shot.ts'
import type { Shot } from '../shared/audio-shot.ts'

test('a level starts at zero, moves in straight lines through its points, and holds its last value', () => {
  const level = [[0.1, 0], [0.2, 1], [0.4, 0.5]] as const
  assert.equal(shotLevelAt(level, 0.05), 0)
  assert.ok(Math.abs(shotLevelAt(level, 0.15) - 0.5) < 1e-9)
  assert.ok(Math.abs(shotLevelAt(level, 0.3) - 0.75) < 1e-9)
  assert.equal(shotLevelAt(level, 2), 0.5)
})

test('the peak of a sound adds the loudest point of each voice', () => {
  const shot: Shot = { duration: 0.2, pan: 0, voices: [
    { _tag: 'Tone', wave: 'sine', pitch: [[0, 200]], level: [[0, 0], [0.01, 0.25], [0.2, 0]] },
    { _tag: 'Noise', filter: { type: 'lowpass', frequency: [[0, 800]], q: 1 }, level: [[0, 0], [0.05, 0.5], [0.2, 0]] },
  ] }
  assert.equal(shotPeak(shot), 0.75)
})

test('the chance of an index and a seed is a share that repeats, and differs from its neighbours', () => {
  const chances = Array.from({ length: 200 }, (_, index) => shotChance(index, 5))
  assert.ok(chances.every(chance => chance >= 0 && chance < 1))
  assert.deepEqual(chances, Array.from({ length: 200 }, (_, index) => shotChance(index, 5)))
  assert.ok(new Set(chances.map(chance => chance.toFixed(6))).size > 190)
  assert.notEqual(shotChance(3, 5), shotChance(3, 6))
  // The values spread over the whole range, so sounds vary and events fall anywhere in their slots.
  assert.ok(Math.min(...chances) < 0.05 && Math.max(...chances) > 0.95)
})
