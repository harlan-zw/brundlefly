import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { defaultPreset, parsePreset, vueForPreset } from '../layers/brand/shared/catalogue.ts'

test('composition presets reject untrusted values before they become Vue attributes', () => {
  for (const override of [{ density: -1 }, { density: 2 }, { density: '0.5' }, { material: 'flesh" onclick="bad' }, { version: 2 }, { edges: 'full-frame' }, { layout: 'unknown' }]) {
    assert.equal(parsePreset(JSON.stringify({ ...defaultPreset, ...override }))._tag, 'Err')
  }
})
test('an exported preset reproduces its material, edges, density, and layout', () => {
  const source = { ...defaultPreset, material: 'chitin' as const, density: 0.8, layout: 'split' as const }
  const result = parsePreset(JSON.stringify(source))
  assert.equal(result._tag, 'Ok')
  if (result._tag === 'Ok') {
    assert.deepEqual(result.preset, source)
    assert.match(vueForPreset(result.preset), /layout="split"/)
    assert.match(vueForPreset(result.preset), /material="chitin"/)
    assert.match(vueForPreset(result.preset), /:density="0.8"/)
  }
})
test('malformed and oversized presets return a useful boundary error', () => {
  for (const raw of ['{', 'null', '[]', 'x'.repeat(4097)]) assert.equal(parsePreset(raw)._tag, 'Err')
})
