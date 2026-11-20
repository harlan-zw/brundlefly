import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pathForSet, setForPath, travelAction } from '../shared/travel.ts'
import { parseDialogueInput } from '../shared/conversation.ts'
import { advanceTravel, startTravel, travelShade, travelTimes } from '../layers/brand/shared/set-travel.ts'
import type { Travel } from '../layers/brand/shared/set-travel.ts'

test('each address shows its set, with or without a trailing slash', () => {
  assert.equal(setForPath('/'), 'lair')
  assert.equal(setForPath('/office'), 'office')
  assert.equal(setForPath('/office/'), 'office')
  assert.equal(pathForSet('lair'), '/')
  assert.equal(pathForSet('office'), '/office')
  for (const set of ['lair', 'office'] as const) assert.equal(setForPath(pathForSet(set)), set)
})

test('an address of no set shows no set, so the site can answer with its 404 page', () => {
  for (const path of ['/offices', '/office/desk', '/brand-kit/', '/Office']) assert.equal(setForPath(path), undefined)
})

test('each set offers the journey to the other set, under its approved label', () => {
  assert.deepEqual(travelAction('office'), { _tag: 'Travel', to: 'lair', label: 'Follow him to the cave' })
  assert.deepEqual(travelAction('lair'), { _tag: 'Travel', to: 'office', label: 'Follow him to the office' })
})

test('a travel action is not a message: the dialogue service refuses it, so it can take no chat turn', () => {
  // The service reserves a turn only for input that parses. A travel action has no text and no history.
  for (const set of ['lair', 'office'] as const) assert.equal(parseDialogueInput(travelAction(set))._tag, 'Err')
})

const run = (still: boolean, swappedAfter: number, settledAfter: number) => {
  let travel: Travel = startTravel({ _tag: 'Home' })
  const phases: string[] = [travel._tag]
  let time = 0, dark = 0
  while (travel._tag !== 'Home' && time < 30) {
    travel = advanceTravel(travel, { delta: 0.05, still, swapped: time >= swappedAfter, settled: time >= settledAfter })
    time += 0.05
    if (travelShade(travel, still) === 1) dark += 0.05
    if (phases.at(-1) !== travel._tag) phases.push(travel._tag)
  }
  return { phases, time, dark }
}

test('a journey leaves, goes dark, arrives, and ends at home', () => {
  const { phases, time } = run(false, 0, 4)
  assert.deepEqual(phases, ['Leaving', 'Dark', 'Arriving', 'Home'])
  assert.ok(time > travelTimes.leave + travelTimes.hold + travelTimes.fadeIn)
})

test('the dark holds until the scene has changed the set', () => {
  // The new set's artwork takes six seconds to load. The picture must stay dark for all of them.
  const { phases, dark } = run(false, 6, 6)
  assert.deepEqual(phases, ['Leaving', 'Dark', 'Arriving', 'Home'])
  assert.ok(dark >= 6 - travelTimes.leave)
})

test('the picture is fully dark before the set changes and clears only after it', () => {
  const leaving: Travel = { _tag: 'Leaving', age: travelTimes.leave - 0.001 }
  assert.ok(travelShade(leaving, false) > 0.99)
  assert.equal(travelShade({ _tag: 'Leaving', age: 0.5 }, false), 0)
  assert.equal(travelShade({ _tag: 'Dark', age: 0 }, false), 1)
  assert.equal(travelShade({ _tag: 'Arriving', age: 0 }, false), 1)
  assert.equal(travelShade({ _tag: 'Arriving', age: travelTimes.fadeIn }, false), 0)
  assert.equal(travelShade({ _tag: 'Home' }, false), 0)
})

test('without motion a journey is a cut with a short dark hold: no walk and no fade', () => {
  const { phases, time } = run(true, 0, 99)
  assert.deepEqual(phases, ['Leaving', 'Dark', 'Arriving', 'Home'])
  // One step leaves, the hold passes, and one step each arrives and ends.
  assert.ok(time >= travelTimes.stillHold && time < travelTimes.stillHold + 0.3)
  assert.equal(travelShade({ _tag: 'Leaving', age: 0 }, true), 1)
  assert.equal(travelShade({ _tag: 'Arriving', age: 0 }, true), 0)
})

test('a journey in progress is not restarted, and he arrives even if he never settles', () => {
  const dark: Travel = { _tag: 'Dark', age: 0.1 }
  assert.equal(startTravel(dark), dark)
  assert.deepEqual(run(false, 0, 99).phases, ['Leaving', 'Dark', 'Arriving', 'Home'])
})
