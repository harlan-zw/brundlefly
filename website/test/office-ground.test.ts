import assert from 'node:assert/strict'
import { test } from 'node:test'
import { groundAt, platformsOf } from '../shared/office-ground.ts'
import { officePlan } from '../layers/brand/shared/office-layout.ts'

const prop = (id: string) => {
  const found = officePlan.props.find(prop => prop.id === id)!
  const [x, y, z] = found.position
  const [width, height, depth] = found.size
  return { x, z, minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, top: y + height / 2 }
}
const desk = prop('desk')
const monitor = prop('monitor')
const floor = officePlan.room.floorY
const ground = (x: number, z: number) => groundAt(platformsOf(officePlan), floor, x, z)

test('a specimen over the desk lands on the desk top', () => {
  // The left quarter of the desk, clear of the monitor.
  const x = desk.minX + (desk.maxX - desk.minX) / 4
  assert.ok(x < monitor.minX)
  assert.equal(ground(x, desk.z), desk.top)
  assert.ok(desk.top > floor)
})

test('a specimen over the monitor lands on the monitor, above the desk', () => {
  assert.equal(ground(monitor.x, monitor.z), monitor.top)
  assert.ok(monitor.top > desk.top)
})

test('a specimen over open floor lands on the floor', () => {
  // He starts on open floor.
  assert.equal(ground(...officePlan.start), floor)
})

test('a specimen just past the front edge of the desk lands on the floor, and one just inside it on the desk', () => {
  const x = desk.minX + (desk.maxX - desk.minX) / 4
  assert.equal(ground(x, desk.maxZ + 0.01), floor)
  assert.equal(ground(x, desk.maxZ - 0.01), desk.top)
  assert.equal(ground(desk.minX - 0.01, desk.z), floor)
})
