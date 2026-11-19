import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ShaderMaterial, Texture, Vector2 } from 'three'
import type { Mesh } from 'three'
import { createOrganismModel } from '../layers/brand/shared/organism.ts'

test('one update moves every tissue material, in both presentations', () => {
  for (const presentation of ['specimen', 'lair'] as const) {
    const texture = new Texture()
    const model = createOrganismModel(texture, presentation, 1.35)
    const materials = new Set<ShaderMaterial>()
    model.root.traverse((object) => {
      const material = (object as Mesh).material
      if (material instanceof ShaderMaterial) materials.add(material)
    })
    // Flesh folds and chitin plates are separate materials. Both must follow the same motion.
    assert.equal(materials.size, 2)
    const input = { pressure: 0.5, wetness: 0.4, pointer: new Vector2(0.2, -0.1), opening: 0.6, transform: 'squeeze' as const }
    for (const time of [2, 3.5]) {
      model.update({ ...input, time })
      for (const material of materials) {
        assert.equal(material.uniforms.uTime!.value, time)
        assert.equal(material.uniforms.uPressure!.value, 0.5)
        assert.equal(material.uniforms.uWetness!.value, 0.4)
        assert.equal(material.uniforms.uBrightness!.value, 1.35)
      }
    }
    model.dispose()
    texture.dispose()
  }
})
