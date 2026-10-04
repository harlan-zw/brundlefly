import assert from 'node:assert/strict'
import test from 'node:test'
import { Texture, Vector2, Vector3 } from 'three'
import { createMascotModel } from '../layers/brand/shared/mascot.ts'

test('pressure moves a weighted arm vertex and release restores its pose', () => {
  const width = 48
  const height = 48
  const texture = new Texture()
  const data = new Uint8ClampedArray(width * height * 4).fill(180)
  const model = createMascotModel(texture, { width, height, data })
  const vertex = Math.round(height * 0.45) * width + Math.round(width * 0.13)
  const rest = new Vector3().fromBufferAttribute(model.mesh.geometry.getAttribute('position'), vertex)
  const pose = (pressure: number) => {
    model.update({ time: 0, pressure, pointer: new Vector2(), transform: 'squeeze' })
    return model.mesh.applyBoneTransform(vertex, rest.clone())
  }
  const before = pose(0)
  const pressed = pose(1)
  assert.ok(before.distanceTo(pressed) > 0.02, 'Arm skin must follow its moving joints.')
  assert.ok(before.distanceTo(pose(0)) < 0.000001, 'Release must restore the weighted pose.')
  model.dispose()
  texture.dispose()
})
