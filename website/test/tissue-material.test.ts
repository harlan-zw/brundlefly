import assert from 'node:assert/strict'
import test from 'node:test'
import { NoColorSpace, ShaderLib, Texture, UniformsUtils } from 'three'
import type { WebGLRenderer } from 'three'
import { createTissueMaterial } from '../layers/brand/shared/tissue-material.ts'

test('room tissue owns raw bump and roughness maps without disposing its caller texture', () => {
  const artwork = new Texture()
  const height = new Texture({ name: 'Dedicated room height' })
  let sourceDisposals = 0
  artwork.addEventListener('dispose', () => { sourceDisposals++ })
  const surface = createTissueMaterial({ surface: 'enclosure', texture: artwork, height, color: '#69404B',
    bumpScale: 0.14, emissive: '#69404B', glow: 0.28, roughness: 0.84 })
  assert.ok(surface.material.roughnessMap)
  assert.equal(surface.material.roughnessMap, surface.material.bumpMap)
  assert.equal(surface.material.aoMap, surface.material.bumpMap)
  assert.equal(surface.material.bumpMap!.image, height.image)
  assert.equal(surface.material.bumpMap!.colorSpace, NoColorSpace)
  assert.equal(surface.material.map, artwork)
  let ownedDisposals = 0
  surface.material.bumpMap!.addEventListener('dispose', () => { ownedDisposals++ })
  surface.dispose()
  assert.equal(ownedDisposals, 1)
  assert.equal(sourceDisposals, 0)
  artwork.dispose()
})

test('room motion keeps native material clocks frozen when flow and breath stop', () => {
  const artwork = new Texture()
  const height = new Texture()
  const surface = createTissueMaterial({ surface: 'enclosure', texture: artwork, height, color: '#69404B',
    bumpScale: 0.14, emissive: '#69404B', glow: 0.28, roughness: 0.84 })
  const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader,
    uniforms: UniformsUtils.clone(ShaderLib.standard.uniforms) }
  surface.material.onBeforeCompile(shader, {} as WebGLRenderer)
  surface.update({ time: 0, breath: 1, flow: 1 })
  surface.update({ time: 0.05, breath: 2, flow: 0.5 })
  assert.equal(shader.uniforms.uTissueBreath!.value, 0.1)
  assert.equal(shader.uniforms.uTissueFlow!.value, 0.025)
  surface.update({ time: 0.1, breath: 0, flow: 0 })
  assert.equal(shader.uniforms.uTissueBreath!.value, 0.1)
  assert.equal(shader.uniforms.uTissueFlow!.value, 0.025)
  surface.update({ time: 3, breath: 0, flow: 0 })
  surface.update({ time: 3.05, breath: 1, flow: 1 })
  assert.ok(Math.abs(shader.uniforms.uTissueBreath!.value - 0.15) < 0.00001)
  assert.ok(Math.abs(shader.uniforms.uTissueFlow!.value - 0.075) < 0.00001)
  surface.dispose(); artwork.dispose()
})
