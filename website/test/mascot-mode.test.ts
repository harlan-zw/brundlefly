import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveMascotMode } from '../layers/brand/shared/mascot-mode.ts'

test('a visitor with no query value gets the full 3D model', () => {
  assert.equal(resolveMascotMode(undefined), 'mesh')
  assert.equal(resolveMascotMode('mesh'), 'mesh')
})

test('the query value picks the relief rig or the sprite relief', () => {
  assert.equal(resolveMascotMode('relief'), 'relief')
  assert.equal(resolveMascotMode('sprite'), 'sprite')
})

test('an unknown or repeated query value gives the model', () => {
  assert.equal(resolveMascotMode('fly'), 'mesh')
  assert.equal(resolveMascotMode(['relief', 'sprite']), 'mesh')
})
