import assert from 'node:assert/strict'
import test from 'node:test'
import { Texture, Vector2, Vector3 } from 'three'
import { createMascotModel } from '../layers/brand/shared/mascot.ts'

test('projected wing tips flex independently and restore their rest pose', () => {
  const width = 48
  const height = 48
  const raster = { width, height, data: new Uint8ClampedArray(width * height * 4).fill(180) }
  const canonical = new Texture()
  const artwork = new Texture()
  const model = createMascotModel(canonical, raster, undefined, undefined, { texture: artwork, raster })
  const vertex = Math.round(height * 0.075) * width + Math.round(width * 0.28)
  const source = new Vector3().fromBufferAttribute(model.mesh.geometry.getAttribute('position'), vertex)
  const pose = (time: number) => {
    model.update({ time, pressure: 0, pointer: new Vector2(), transform: 'squeeze' })
    return model.mesh.applyBoneTransform(vertex, source.clone())
  }
  const rest = pose(0)
  assert.ok(rest.distanceTo(pose(0.5)) > 0.001)
  assert.ok(rest.distanceTo(pose(0)) < 0.000001)
  const torso = new Vector3().fromBufferAttribute(model.mesh.geometry.getAttribute('position'), Math.round(height * 0.5) * width + Math.round(width * 0.5))
  assert.ok(Math.abs(source.z) < Math.abs(torso.z) / 4)
  let sourceDisposed = false
  artwork.addEventListener('dispose', () => { sourceDisposed = true })
  model.dispose()
  assert.equal(sourceDisposed, false)
  artwork.dispose()
  canonical.dispose()
})
