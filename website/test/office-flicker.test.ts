import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tubeFlicker } from '../layers/brand/shared/office-flicker.ts'

const samples = (from: number, to: number, step = 0.01) => Array.from({ length: Math.round((to - from) / step) }, (_, index) => tubeFlicker(from + index * step))

test('the failing tube is fully lit at time zero, so a still scene shows it lit', () => {
  assert.equal(tubeFlicker(0), 1)
})

test('the failing tube holds steady for most of a cycle and dims in the rest', () => {
  const cycle = samples(0, 9)
  assert.ok(cycle.filter(level => level === 1).length / cycle.length > 0.8)
  assert.ok(cycle.some(level => level < 0.5))
  assert.ok(cycle.every(level => level > 0 && level <= 1))
})

test('the failing tube never flashes more than three times in a second', () => {
  // A flash is a fall and a rise. Six changes of level in one second are three flashes.
  const levels = samples(0, 90)
  for (let start = 0; start + 100 < levels.length; start += 5) {
    let changes = 0
    for (let index = start + 1; index <= start + 100; index++) if (levels[index] !== levels[index - 1]) changes++
    assert.ok(changes <= 6, `${changes} changes in the second from ${start / 100}`)
  }
})

test('the same scene time gives the same light, so a paused scene does not flicker', () => {
  assert.equal(tubeFlicker(7.83), tubeFlicker(7.83))
})
