import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addTaps, emptyExperiment, goCritical, revealExperiment } from '../shared/office-experiment.ts'
import { clickerAction, clickerRevealAfterSeconds, readClickerKey, showSlideCount } from '../shared/show-deck.ts'

test('readClickerKey maps USB presenter keys to Next and Prev', () => {
  for (const key of ['ArrowRight', 'PageDown', ' ']) assert.equal(readClickerKey(key), 'Next')
  for (const key of ['ArrowLeft', 'PageUp']) assert.equal(readClickerKey(key), 'Prev')
  for (const key of ['Escape', 'b', 'Enter', 'ArrowUp']) assert.equal(readClickerKey(key), undefined)
})

test('show mode steps through slides 1 to 4, cuts to 3D office, then opens beetle QR', () => {
  const idle = emptyExperiment()
  assert.deepEqual(clickerAction('Next', { show: true, slide: 0, station: 'room', experiment: idle, criticalAge: undefined }), { _tag: 'Slide', index: 1 })
  assert.deepEqual(clickerAction('Next', { show: true, slide: showSlideCount - 1, station: 'room', experiment: idle, criticalAge: undefined }), { _tag: 'Slide', index: null })
  assert.deepEqual(clickerAction('Next', { show: true, slide: null, station: 'room', experiment: idle, criticalAge: undefined }), { _tag: 'Station', station: 'code' })
  // Even if someone tapped early from Slide 4, Next from the office still summons the beetle QR.
  const counting = addTaps(idle, 'fly', 3, 100)
  assert.deepEqual(clickerAction('Next', { show: true, slide: null, station: 'room', experiment: counting, criticalAge: undefined }), { _tag: 'Station', station: 'code' })
  // Once the beetle QR is showing, accidental Next clicks do nothing.
  assert.deepEqual(clickerAction('Next', { show: true, slide: null, station: 'code', experiment: counting, criticalAge: undefined }), { _tag: 'None' })
})

test('Prev backs up slides and returns from QR without interrupting active counting into slides', () => {
  const idle = emptyExperiment()
  const counting = addTaps(idle, 'snail', 2, 100)
  assert.deepEqual(clickerAction('Prev', { show: true, slide: 0, station: 'room', experiment: idle, criticalAge: undefined }), { _tag: 'None' })
  assert.deepEqual(clickerAction('Prev', { show: true, slide: 2, station: 'room', experiment: idle, criticalAge: undefined }), { _tag: 'Slide', index: 1 })
  assert.deepEqual(clickerAction('Prev', { show: true, slide: null, station: 'code', experiment: counting, criticalAge: undefined }), { _tag: 'Station', station: 'room' })
  assert.deepEqual(clickerAction('Prev', { show: true, slide: null, station: 'room', experiment: idle, criticalAge: undefined }), { _tag: 'Slide', index: showSlideCount - 1 })
  assert.deepEqual(clickerAction('Prev', { show: true, slide: null, station: 'room', experiment: counting, criticalAge: undefined }), { _tag: 'None' })
})

test('during critical, Next triggers reveal only after the guard window and only once', () => {
  const critical = goCritical(emptyExperiment(), 1000)
  assert.deepEqual(clickerAction('Next', { show: true, slide: null, station: 'room', experiment: critical, criticalAge: clickerRevealAfterSeconds - 0.1 }), { _tag: 'None' })
  assert.deepEqual(clickerAction('Next', { show: true, slide: null, station: 'room', experiment: critical, criticalAge: clickerRevealAfterSeconds }), { _tag: 'Reveal' })
  assert.deepEqual(clickerAction('Prev', { show: true, slide: null, station: 'room', experiment: critical, criticalAge: 22 }), { _tag: 'None' })
  const revealed = revealExperiment(critical, 25_000)
  assert.deepEqual(clickerAction('Next', { show: true, slide: null, station: 'room', experiment: revealed, criticalAge: 25 }), { _tag: 'None' })
})
