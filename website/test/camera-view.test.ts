import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultCameraView, moveCameraView, resolveCameraView, resolveResponsiveCameraFraming, rotateCameraView } from '../layers/brand/shared/camera-view.ts'

test('mouse look permits a full turn and limits pitch before the view flips', () => {
  const view = rotateCameraView(defaultCameraView, Math.PI * 2 / 0.0028, 10000)
  assert.ok(Math.abs(view.yaw) < 1e-10)
  assert.equal(view.pitch, 1.15)
  const reverse = rotateCameraView(view, 0, -10000)
  assert.equal(reverse.pitch, -1.15)
})

test('opposite keys cancel, diagonal travel keeps the same slow ground speed', () => {
  assert.deepEqual(moveCameraView(defaultCameraView, new Set(['KeyW', 'KeyS']), 0.05), defaultCameraView)
  const straight = moveCameraView(defaultCameraView, new Set(['KeyW']), 0.05)
  const diagonal = moveCameraView(defaultCameraView, new Set(['KeyW', 'KeyD']), 0.05)
  assert.ok(straight.z < 0)
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - Math.abs(straight.z)) < 1e-10)
})

test('held movement remains inside travel bounds', () => {
  let view = { ...defaultCameraView }
  for (let index = 0; index < 1000; index++) view = moveCameraView(view, new Set(['KeyW', 'KeyD']), 0.05)
  assert.equal(view.x, 1.4)
  assert.equal(view.z, -1.4)
})

test('looking turns the view while the camera remains at the player position', () => {
  const standing = { ...defaultCameraView, x: 0.5, z: -0.75 }
  const turned = rotateCameraView(standing, 90, 30)
  const before = resolveCameraView(standing, [0, 0.75, 10.4], [0, -0.35, -2.1], 1)
  const after = resolveCameraView(turned, [0, 0.75, 10.4], [0, -0.35, -2.1], 1)
  assert.deepEqual(before.position, after.position)
  assert.notDeepEqual(before.target, after.target)
  assert.ok(after.target[0] > before.target[0])
})

test('forward movement follows the direction the player faces', () => {
  const view = { ...defaultCameraView, yaw: 0.35 }
  const moved = moveCameraView(view, new Set(['KeyW']), 0.05)
  assert.ok(moved.x > 0)
  assert.ok(moved.z < 0)
  assert.ok(Math.abs(moved.x / -moved.z - Math.tan(view.yaw)) < 1e-10)
})

test('zoom and portrait framing retain player travel without orbiting the position', () => {
  const view = { yaw: 0.3, pitch: -0.1, x: 1, z: -1 }
  const desktop = resolveCameraView(view, [0, 0.75, 10.4], [0, -0.35, -2.1], 1)
  const portrait = resolveCameraView(view, [0, 1.1, 15.2], [0, -0.35, -2.1], 0.85)
  assert.equal(desktop.position[0], view.x)
  assert.equal(portrait.position[0], view.x)
  assert.equal(desktop.position[2], 10.4 + view.z)
  assert.equal(portrait.position[2], 15.2 / 0.85 + view.z)
  assert.ok(desktop.position[1] >= 0.15 && portrait.position[1] >= 0.15)
})

test('mobile staging brings the character closer and reduces optical fog without changing desktop staging', () => {
  const desktop = [0, 0.75, 10.4] as const
  const portrait = [0, 1.1, 15.2] as const
  const wide = resolveResponsiveCameraFraming(desktop, portrait, 1440 / 1000)
  assert.deepEqual(wide, { framing: desktop, fieldOfView: 44, fogScale: 1 })
  const narrow = resolveResponsiveCameraFraming(desktop, portrait, 375 / 812)
  const view = { ...defaultCameraView, x: 0.5, z: -0.75 }
  const camera = resolveCameraView(view, narrow.framing, [0, -0.35, -2.1], 0.9)
  assert.equal(camera.position[0], view.x)
  assert.equal(camera.position[2], 8.32 / 0.9 + view.z)
  assert.equal(narrow.framing[1], desktop[1])
  assert.ok(narrow.fogScale > 0.8 && narrow.fogScale < 0.9)
  // Fog transmission at the character grows from near-black to readable tissue.
  const oldTransmission = Math.exp(-Math.pow(0.075 * (portrait[2] / 0.9 + 0.8), 2))
  const newTransmission = Math.exp(-Math.pow(0.075 * narrow.fogScale * (narrow.framing[2] / 0.9 + 0.8), 2))
  assert.ok(newTransmission > oldTransmission * 3)
})
