import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PlaneGeometry } from 'three'
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
