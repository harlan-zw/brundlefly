import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BufferGeometry, Float32BufferAttribute, PlaneGeometry, Vector3 } from 'three'
import { createRoomGeometry, displaceRoomGeometry } from '../layers/brand/shared/room-height.ts'

const flatHeight = (value: number) => ({ width: 2, height: 2, data: new Uint8ClampedArray(Array.from({ length: 16 }, (_, i) => i % 4 === 3 ? 255 : value)) })

test('height raises room folds inward while black cavities and the floor boundary stay fixed', () => {
  const raised = new PlaneGeometry(1, 1, 2, 2)
  displaceRoomGeometry(raised, flatHeight(255), [0, 0, 0])
  assert.ok(Math.abs(raised.getAttribute('position').getZ(0) + 0.26) < 1e-6)
  assert.equal(raised.getAttribute('roomProjectionPosition').getZ(0), 0)
  assert.equal(raised.getAttribute('roomProjectionNormal').getZ(0), 1)
  const cavity = new PlaneGeometry(1, 1)
  displaceRoomGeometry(cavity, flatHeight(0), [0, 0, 0])
  assert.equal(cavity.getAttribute('position').getZ(0), 0)
  const floorEdge = new PlaneGeometry(1, 1)
  displaceRoomGeometry(floorEdge, flatHeight(255), [0, -3, 0])
  assert.equal(floorEdge.getAttribute('position').getZ(0), 0)
  raised.dispose(); cavity.dispose(); floorEdge.dispose()
})

test('rounded room macro relief stays bounded with finite lighting normals and a mobile triangle budget', () => {
  const room = createRoomGeometry(flatHeight(255), [0, 1.8, 5])
  assert.ok(room.index!.count / 3 < 60000)
  const positions = room.getAttribute('position'), original = room.getAttribute('roomProjectionPosition')
  const normals = room.getAttribute('normal')
  let reliefCount = 0
  for (let index = 0; index < positions.count; index++) {
    const distance = Math.hypot(positions.getX(index) - original.getX(index), positions.getY(index) - original.getY(index), positions.getZ(index) - original.getZ(index))
    assert.ok(distance < 0.26001)
    if (distance > 0.2) reliefCount++
    if (original.getY(index) + 1.8 <= -2.2) assert.equal(distance, 0)
    assert.ok(Math.abs(Math.hypot(normals.getX(index), normals.getY(index), normals.getZ(index)) - 1) < 1e-5)
  }
  assert.ok(reliefCount > 10000)
  room.dispose()
})

test('mesh relief follows the broad height, so single bright pixels raise no vertex alone', () => {
  const speckled = { width: 128, height: 128, data: Uint8ClampedArray.from({ length: 128 * 128 * 4 }, (_, index) => (Math.floor(index / 4) + Math.floor(index / 4 / 128)) % 2 * 255) }
  const plane = new PlaneGeometry(3, 3, 40, 40)
  displaceRoomGeometry(plane, speckled, [0, 0, 0])
  const positions = plane.getAttribute('position')
  for (let index = 0; index < positions.count; index++) assert.ok(Math.abs(positions.getZ(index) + 0.13) < 0.01)
  plane.dispose()
})

test('height relief deeper than a recess turns no triangle over', () => {
  // A gutter of radius 0.05. The full 0.26 relief would push each side through the other.
  const points: number[] = [], indices: number[] = []
  for (let step = 0; step <= 16; step++) {
    const angle = step / 16 * Math.PI
    for (const z of [0, 1]) points.push(Math.cos(angle) * 0.05, Math.sin(angle) * 0.05, z)
    if (step < 16) indices.push(step * 2, step * 2 + 2, step * 2 + 1, step * 2 + 1, step * 2 + 2, step * 2 + 3)
  }
  const gutter = new BufferGeometry()
  gutter.setAttribute('position', new Float32BufferAttribute(points, 3))
  gutter.setIndex(indices)
  gutter.computeVertexNormals()
  // The relief moves against the normal. These normals point away from the gutter axis.
  assert.ok(gutter.getAttribute('normal').getY(16) > 0.9)
  displaceRoomGeometry(gutter, flatHeight(255), [0, 0, 0])
  const positions = gutter.getAttribute('position'), rest = gutter.getAttribute('roomProjectionPosition')
  const normal = (attribute: typeof positions, face: number) => {
    const [a, b, c] = [0, 1, 2].map(corner => new Vector3().fromBufferAttribute(attribute, indices[face + corner]!))
    return b!.sub(a!).cross(c!.sub(a!))
  }
  let moved = 0
  for (let face = 0; face < indices.length; face += 3) assert.ok(normal(positions, face).dot(normal(rest, face)) >= 0)
  for (let index = 0; index < positions.count; index++) if (positions.getY(index) !== rest.getY(index)) moved++
  assert.ok(moved > 0)
  gutter.dispose()
})
