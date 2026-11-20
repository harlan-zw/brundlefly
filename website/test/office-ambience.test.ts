import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tubeFlicker } from '../layers/brand/shared/office-flicker.ts'
import { shotPeak } from '../shared/audio-shot.ts'
import { buzzChanges, chairCreak, clockTick, coolerGlug, distantDoor, fillOfficeImpulse, flickerBuzz, officeEvents, officeRoomSeconds } from '../shared/office-ambience.ts'
import { assertPlayable } from './playable.ts'

test('the tube buzzes only while its light is down', () => {
  assert.equal(flickerBuzz(1), 0)
  assert.ok(flickerBuzz(0.12) > flickerBuzz(0.45) && flickerBuzz(0.45) > 0)
  assert.ok(flickerBuzz(0) <= 1)
})

test('the buzz changes when the light changes, and at no other time', () => {
  let level = 0
  const changes = buzzChanges(0, 90, level)
  assert.ok(changes.length > 20)
  for (const change of changes) {
    // The light is at one level just before the change and at another just after it.
    assert.notEqual(tubeFlicker(change.time - 0.011), tubeFlicker(change.time + 0.011), `the light changes at ${change.time}`)
    assert.equal(change.level, flickerBuzz(tubeFlicker(change.time + 0.011)))
    assert.notEqual(change.level, level)
    level = change.level
  }
  // Every change of the light is in the list.
  let lit = tubeFlicker(0)
  let seen = 0
  for (let step = 1; step < 90 * 50; step++) {
    const next = tubeFlicker((step + 0.5) * 0.02)
    if (next !== lit) seen++
    lit = next
  }
  assert.equal(changes.length, seen)
})

test('the buzz is the same whether the graph asks for it in one span or in many', () => {
  const whole = buzzChanges(0, 30, 0)
  const parts = []
  let level = 0
  for (let from = 0; from < 30; from += 0.2) {
    // Spans meet at uneven times, as the graph's ticks do.
    const to = Math.min(30, from + 0.2)
    for (const change of buzzChanges(from + 0.003, to + 0.003, level)) { level = change.level; parts.push(change) }
  }
  assert.deepEqual(parts, whole.filter(change => change.time >= 0.003 && change.time < 30.003))
})

test('the wall clock ticks each second, and a tock follows a tick', () => {
  const ticks = officeEvents(0, 10).filter(event => event._tag === 'Tick')
  assert.deepEqual(ticks.map(event => event.time), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.notDeepEqual(clockTick(0), clockTick(1))
  assert.deepEqual(clockTick(0), clockTick(2))
})

test('the cooler, the door, and the chair sound at irregular times that every visit repeats', () => {
  const events = officeEvents(0, 600).filter(event => event._tag !== 'Tick')
  assert.deepEqual(events, officeEvents(0, 600).filter(event => event._tag !== 'Tick'))
  for (const tag of ['Glug', 'Door', 'Creak'] as const) {
    const times = events.filter(event => event._tag === tag).map(event => event.time)
    const gaps = times.slice(1).map((time, index) => time - times[index]!)
    assert.ok(times.length >= 15, `${tag} sounds often enough`)
    // Sparse: never two in four seconds. Irregular: the gaps differ by seconds.
    assert.ok(Math.min(...gaps) > 4, `${tag} is sparse`)
    assert.ok(Math.max(...gaps) - Math.min(...gaps) > 5, `${tag} is irregular`)
  }
  // The first twenty seconds hold one of each, so a short listen hears the whole office.
  assert.deepEqual([...new Set(officeEvents(0, 20).map(event => event._tag))].sort(), ['Creak', 'Door', 'Glug', 'Tick'])
})

test('no event is lost or doubled when the graph asks in small spans', () => {
  const whole = officeEvents(0, 120)
  const parts = []
  for (let step = 0; step < 2400; step++) parts.push(...officeEvents(step / 20, (step + 1) / 20))
  assert.deepEqual(parts.map(event => [event._tag, event.time]), whole.map(event => [event._tag, event.time]))
})

test('every office event is a short, quiet sound the graph can play', () => {
  for (let index = 0; index < 40; index++) {
    for (const [name, shot] of [['tick', clockTick(index)], ['glug', coolerGlug(index)], ['door', distantDoor(index)], ['creak', chairCreak(index)]] as const) {
      assertPlayable(shot, name)
      assert.ok(shotPeak(shot) < 0.2, `${name} is quiet`)
    }
    // The clock is the quietest thing in the room.
    assert.ok(shotPeak(clockTick(index)) < shotPeak(chairCreak(index)))
  }
  assert.notDeepEqual(coolerGlug(0), coolerGlug(1))
})

test('the office room is short and dry, and its two sides differ', () => {
  const rate = 8000
  const sides = [0, 1].map((channel) => {
    const samples = new Float32Array(Math.ceil(rate * officeRoomSeconds))
    fillOfficeImpulse(samples, channel, rate)
    return samples
  })
  const energy = (samples: Float32Array, from: number, to: number) => samples.subarray(Math.floor(from * rate), Math.floor(to * rate)).reduce((sum, value) => sum + value * value, 0)
  for (const samples of sides) {
    assert.ok(samples.every(Number.isFinite))
    // Most of the room answers in the first 50 ms. The cave's echo runs for 2.4 seconds.
    assert.ok(energy(samples, 0, 0.05) > energy(samples, 0, officeRoomSeconds) * 0.75)
    assert.ok(energy(samples, 0.25, officeRoomSeconds) < energy(samples, 0, officeRoomSeconds) * 0.001)
  }
  assert.ok(officeRoomSeconds < 0.5)
  assert.notDeepEqual(sides[0], sides[1])
  const again = new Float32Array(sides[0]!.length)
  fillOfficeImpulse(again, 0, rate)
  assert.deepEqual(again, sides[0])
})
