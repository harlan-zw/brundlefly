import assert from 'node:assert/strict'
import test from 'node:test'
import { Box3, Raycaster, Texture, Vector3 } from 'three'
import { createFaceModel } from '../layers/brand/shared/face.ts'

const surface = (root: ReturnType<typeof createFaceModel>['root'], x: number, y: number) =>
  new Raycaster(new Vector3(x, y, 2), new Vector3(0, 0, -1)).intersectObject(root, true)[0]?.point.z
function projectedFace() {
  const width = 120, height = 160
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const opaque = Math.pow((x / width - 0.5) / 0.45, 2) + Math.pow((y / height - 0.5) / 0.49, 2) < 1
    data.set([100, 80, 60, opaque ? 255 : 0], (y * width + x) * 4)
  }
  return createFaceModel(undefined, { texture: new Texture(), raster: { width, height, data } })
}

test('the sculpt has side depth and speech moves the visible jaw surface', () => {
  const face = projectedFace()
  const size = new Box3().setFromObject(face.root).getSize(new Vector3())
  assert.ok(size.z > 0.45, 'The head must remain volumetric from a side view.')
  face.update({ time: 0, speaking: 0, blink: 0 })
  const closed = surface(face.root, 0.09, -0.28)
  face.update({ time: 0, speaking: 1, blink: 0 })
  const open = surface(face.root, 0.09, -0.28)
  assert.ok(closed !== undefined && open !== undefined && Math.abs(closed - open) > 0.015,
    'The visible jaw surface must move when the voice opens the mouth.')
  face.update({ time: 0, speaking: 0, blink: 0 })
  assert.equal(surface(face.root, 0.09, -0.28), closed, 'The jaw must return to its closed pose.')
  face.dispose()
})

test('independent solid eyelids close over both eyes and reopen without holes', () => {
  const face = projectedFace()
  const points = [[-0.13, 0.075], [0.17, 0.025]] as const
  const open = points.map(([x, y]) => surface(face.root, x, y))
  face.update({ time: 0, speaking: 0, blink: 1 })
  const closed = points.map(([x, y]) => surface(face.root, x, y))
  points.forEach((_, index) => assert.ok(open[index] !== undefined && closed[index] !== undefined
    && Math.abs(open[index]! - closed[index]!) > 0.002, 'Each solid lid must cover its eye.'))
  face.update({ time: 0, speaking: 0, blink: 0 })
  points.forEach(([x, y], index) => assert.equal(surface(face.root, x, y), open[index]))
  face.dispose()
})
