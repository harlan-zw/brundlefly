import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveSceneQuality } from '../layers/brand/shared/scene-quality.ts'

const desktop = { requested: undefined, coarsePointer: false, cores: 12, memory: 8, shortSide: 900 }
const phone = { requested: undefined, coarsePointer: true, cores: 8, memory: 8, shortSide: 412 }

test('a desktop draws the whole picture, and a strong phone leaves out the blur and the reflection', () => {
  assert.deepEqual(resolveSceneQuality(desktop), { tier: 'high', pixelRatio: 1.5, finish: true, depthBlur: true, spores: 1, haze: true, reflection: true })
  const strongPhone = resolveSceneQuality(phone)
  assert.equal(strongPhone.tier, 'medium')
  assert.equal(strongPhone.finish, true)
  assert.equal(strongPhone.depthBlur, false)
  assert.equal(strongPhone.reflection, false)
})

test('a weak phone gets no finishing pass, by cores, by memory, or by screen size', () => {
  for (const weak of [{ ...phone, cores: 4 }, { ...phone, memory: 4 }, { ...phone, shortSide: 360 }]) {
    const quality = resolveSceneQuality(weak)
    assert.equal(quality.tier, 'low')
    assert.equal(quality.finish, false)
    assert.equal(quality.haze, false)
  }
})

test('a browser that hides its cores and memory is judged on the rest', () => {
  assert.equal(resolveSceneQuality({ ...phone, cores: undefined, memory: undefined }).tier, 'medium')
  assert.equal(resolveSceneQuality({ ...desktop, cores: undefined, memory: undefined }).tier, 'high')
  assert.equal(resolveSceneQuality({ ...desktop, cores: 2 }).tier, 'medium')
})

test('the query value wins when it names a tier, and any other value is ignored', () => {
  assert.equal(resolveSceneQuality({ ...phone, cores: 2, requested: 'high' }).tier, 'high')
  assert.equal(resolveSceneQuality({ ...desktop, requested: 'low' }).tier, 'low')
  assert.equal(resolveSceneQuality({ ...desktop, requested: 'ultra' }).tier, 'high')
  assert.equal(resolveSceneQuality({ ...desktop, requested: ['low'] }).tier, 'high')
})
