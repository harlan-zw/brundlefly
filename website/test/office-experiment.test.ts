import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyRun, release, specimenCount, readCommand, voteTotals } from '../shared/office-experiment.ts'

test('a calibration snail, 199 single drops and 100 unexpected handfuls fill the office', () => {
  let run = emptyRun('show')
  const tap = (n: number, host = false) => release(run, host ? 'snail' : 'beetle', String(n), host, n * 100 + (n ? 8000 : 0))
  assert.equal(tap(0), run)
  run = tap(0, true)
  assert.equal(release(run, 'fly', 'early', false, 1000), run)
  for (let n = 1; n <= 199; n++) run = tap(n)
  assert.equal(specimenCount(run), 200)
  run = tap(200)
  assert.equal(run.drops.at(-1)?.size, 6)
  assert.equal(run.drops.at(-1)?.kind, 'beetle')
  assert.equal(tap(200), run)
  for (let n = 201; n <= 299; n++) run = tap(n)
  assert.equal(specimenCount(run), 800)
  assert.deepEqual(voteTotals(run), { beetle: 299, snail: 0, fly: 0, cricket: 0 })
  assert.equal(tap(300), run)
})

test('malformed or unknown incoming tap commands are rejected', () => {
  for (const value of ['{', 'null', '{"op":"tap","kind":"ant"}', '{"op":"host","key":42}']) assert.equal(readCommand(value), undefined)
})
