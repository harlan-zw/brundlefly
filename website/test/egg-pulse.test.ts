import assert from 'node:assert/strict'
import { test } from 'node:test'
import { eggGlow, eggPulse } from '../layers/brand/shared/egg-pulse.ts'

test('a sac glows brighter when it swells and dimmer when it shrinks', () => {
  const phase = 1.73
  // The swell peaks where its angle is a quarter turn, and bottoms out half a cycle later.
  const peak = (Math.PI / 2 - phase) / 0.55 + Math.PI * 2 / 0.55
  const trough = peak + Math.PI / 0.55
  assert.ok(Math.abs(eggPulse(peak, phase) - 1) < 1e-9)
  assert.ok(Math.abs(eggPulse(trough, phase) + 1) < 1e-9)
  assert.ok(eggGlow(peak, phase, 1) > 1.1)
  assert.ok(eggGlow(trough, phase, 1) < 0.9)
})

test('the light never goes out and never flares, for any sac at any time', () => {
  for (let phase = 0; phase < 12; phase += 0.37) {
    for (let time = 0; time < 240; time += 0.21) {
      const glow = eggGlow(time, phase, 1)
      assert.ok(glow >= 0.65 && glow <= 1.35, `glow ${glow} at time ${time}`)
    }
  }
})

test('the light changes slowly: no jump between two frames', () => {
  for (let time = 0; time < 120; time += 1 / 60) {
    assert.ok(Math.abs(eggGlow(time + 1 / 60, 2.2, 1) - eggGlow(time, 2.2, 1)) < 0.01)
  }
})

test('no breath holds every light at rest, and breath outside 0 to 1 is clamped', () => {
  for (const time of [0, 3.3, 71.9]) {
    assert.equal(eggGlow(time, 0.4, 0), 1)
    assert.equal(eggGlow(time, 0.4, -2), 1)
    assert.equal(eggGlow(time, 0.4, 5), eggGlow(time, 0.4, 1))
  }
})

test('two sacs with different phases do not glow in step', () => {
  let apart = 0
  for (let time = 0; time < 60; time += 0.5) apart = Math.max(apart, Math.abs(eggGlow(time, 0, 1) - eggGlow(time, 2.2, 1)))
  assert.ok(apart > 0.2)
})
