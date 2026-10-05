import assert from 'node:assert/strict'
import test from 'node:test'
import { MeshPhysicalMaterial, ShaderLib, Texture, UniformsUtils } from 'three'
import type { WebGLRenderer } from 'three'
import { applyMascotSurface } from '../layers/brand/shared/mascot-surface.ts'

test('surface time freezes cleanly, preserves artwork, and restores inherited material hooks', () => {
  const artwork = new Texture()
  const material = new MeshPhysicalMaterial({ map: artwork })
  let inheritedCompiles = 0
  const previousCompile: typeof material.onBeforeCompile = () => { inheritedCompiles++ }
  const previousKey = () => 'existing-skin-projection'
  material.onBeforeCompile = previousCompile
  material.customProgramCacheKey = previousKey
  const surface = applyMascotSurface(material, 'skin')
  const shader = { vertexShader: ShaderLib.physical.vertexShader, fragmentShader: ShaderLib.physical.fragmentShader,
    uniforms: UniformsUtils.clone(ShaderLib.physical.uniforms) }
  material.onBeforeCompile(shader, {} as WebGLRenderer)
  assert.equal(inheritedCompiles, 1)
  assert.equal(material.map, artwork)
  surface.update(2.5)
  assert.equal(shader.uniforms.uMascotSurfaceTime!.value, 2.5)
  surface.update(2.5)
  surface.update(NaN)
  assert.equal(shader.uniforms.uMascotSurfaceTime!.value, 2.5)
  surface.dispose()
  surface.update(5)
  assert.equal(shader.uniforms.uMascotSurfaceTime!.value, 2.5)
  assert.equal(material.onBeforeCompile, previousCompile)
  assert.equal(material.customProgramCacheKey, previousKey)
  material.dispose()
  artwork.dispose()
})
