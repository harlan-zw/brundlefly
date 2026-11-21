import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Vector2 } from 'three'
import { mannerismDuration, poseMannerisms } from '../layers/brand/shared/mannerism.ts'
import type { MannerismTag } from '../layers/brand/shared/mannerism.ts'
import { createMeshMascot, fingerCurl } from '../layers/brand/shared/mascot-mesh.ts'
import { loadMascotModel } from './mascot-model.ts'

const habit = (tag: MannerismTag, age: number, side: 1 | -1 = 1) => poseMannerisms([{ mannerism: { _tag: tag }, age, side }])

test('his work closes the hand that does it: a grip on the marker, a cupped hand at the jar', () => {
  const writing = habit('WriteBoard', 3.2, -1).hands
  assert.ok(writing.right && writing.right.curl > 0.7)
  assert.equal(writing.left, undefined)
  const tending = habit('TendJar', 2.6, 1).hands
  assert.ok(tending.left && tending.left.curl > 0.3 && tending.left.curl < writing.right.curl)
  assert.equal(tending.right, undefined)
  // A habit with no hand work leaves both hands as the model has them.
  assert.deepEqual(habit('ListenCeiling', 1.3).hands, {})
})

test('he holds the marker while his arm is up, and not as it rises or falls', () => {
  const duration = mannerismDuration({ _tag: 'WriteBoard' })
  assert.equal(habit('WriteBoard', 0.05, -1).hands.right?.holds, undefined)
  assert.equal(habit('WriteBoard', duration / 2, -1).hands.right?.holds, 'Marker')
  assert.equal(habit('WriteBoard', duration - 0.05, -1).hands.right?.holds, undefined)
})

test('his fingers strike the keys one after the other, and rest between the bursts', () => {
  const typing = habit('TypeKeys', 1.5).hands
  const taps = typing.left!.taps!
  assert.equal(taps.length, 5)
  assert.ok(new Set(taps.map(tap => tap.toFixed(3))).size > 2, 'the fingers must not move as one')
  // The two hands are half a tap apart.
  assert.notDeepEqual(typing.right!.taps, taps)
  // Between the first and the second burst he reads, and no finger strikes.
  assert.ok(habit('TypeKeys', 2.6).hands.left!.taps!.every(tap => tap === 0))
})

test('two habits at once keep the tighter grip on each hand', () => {
  const both = poseMannerisms([{ mannerism: { _tag: 'TendJar' }, age: 2.6, side: -1 }, { mannerism: { _tag: 'WriteBoard' }, age: 3.2, side: -1 }])
  assert.equal(both.hands.right!.curl, habit('WriteBoard', 3.2, -1).hands.right!.curl)
  assert.equal(both.hands.right!.holds, 'Marker')
})

test('the model closes its finger joints with the grip and shows the marker only while he holds it', async () => {
  const result = createMeshMascot(await loadMascotModel(), 2.5)
  assert.equal(result._tag, 'Ok')
  if (result._tag !== 'Ok') return
  const mascot = result.mascot
  const pose = (mannerism?: ReturnType<typeof poseMannerisms>) => mascot.pose!({ time: 0, pressure: 0, pointer: new Vector2(), transform: 'squeeze', mannerism })
  const finger = mascot.root.getObjectByName('right-finger-3')!
  const marker = mascot.root.getObjectByName('held-marker')!
  const markers: boolean[] = []
  mascot.root.traverse(object => { if (object.name === 'held-marker') markers.push(object.visible) })
  assert.deepEqual(markers, [false, false], 'each long hand has a marker, hidden at rest')
  pose()
  const open = finger.rotation.x
  const writing = habit('WriteBoard', 3.2, -1)
  pose(writing)
  assert.ok(Math.abs(finger.rotation.x - open - writing.hands.right!.curl * fingerCurl.root) < 1e-9)
  const shown: string[] = []
  mascot.root.traverse(object => { if (object.name === 'held-marker' && object.visible) shown.push(object.parent!.name) })
  assert.deepEqual(shown, ['right-hand'], 'only the writing hand shows its marker')
  // The hand opens again and the marker goes when the habit ends.
  pose()
  assert.equal(finger.rotation.x, open)
  assert.equal(marker.visible, false)
  mascot.dispose()
})
