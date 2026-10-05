import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Mesh, MeshPhysicalMaterial, Vector3 } from 'three'
import { createCaveGoo } from '../layers/brand/shared/cave-goo.ts'

const attachment = { start: new Vector3(3.5, 3.6, 0), end: new Vector3(4.2, 3.2, 0.2),
  startNormal: new Vector3(0, 1, 0), endNormal: new Vector3(1, 0, 0), length: 1.1, width: 0.32 }

test('attached liquid stretches and travels, frozen clocks and zero motion controls retain its pose', () => {
  const material = new MeshPhysicalMaterial()
  const slime = createCaveGoo(material, [attachment])
  const snapshot = () => {
    slime.root.updateMatrixWorld(true)
    const pose: number[] = []
    slime.root.traverse(object => { if (object instanceof Mesh) pose.push(...object.matrixWorld.elements, Number(object.visible)) })
    return pose
  }
  const initial = snapshot()
  for (let step = 1; step <= 40; step++) slime.update({ time: step * 0.1, flow: 1, breath: 1 })
  const moving = snapshot()
  assert.notDeepEqual(moving, initial)
  slime.update({ time: 4, flow: 1, breath: 1 })
  assert.deepEqual(snapshot(), moving)
  slime.update({ time: 8, flow: 0, breath: 0 })
  assert.deepEqual(snapshot(), moving)
  slime.dispose(); material.dispose()
})

test('liquid teardown releases owned geometry while the shared physical material remains caller-owned', () => {
  const material = new MeshPhysicalMaterial()
  let materialDisposed = false, geometryDisposed = 0
  material.addEventListener('dispose', () => { materialDisposed = true })
  const slime = createCaveGoo(material, [attachment])
  const geometries = new Set<Mesh['geometry']>()
  slime.root.traverse(object => { if (object instanceof Mesh) geometries.add(object.geometry) })
  for (const geometry of geometries) geometry.addEventListener('dispose', () => { geometryDisposed++ })
  slime.dispose()
  assert.equal(geometryDisposed, geometries.size)
  assert.equal(materialDisposed, false)
  material.dispose()
})

test('a falling drop disappears before the cycle resets to its attached neck', () => {
  const material = new MeshPhysicalMaterial()
  const slime = createCaveGoo(material, [attachment])
  let drop: Mesh | undefined
  slime.root.traverse(object => { if (object instanceof Mesh && object.scale.x === 0) drop = object })
  assert.ok(drop)
  for (let step = 1; step <= 83; step++) slime.update({ time: step * 0.1, flow: 1, breath: 0 })
  assert.equal(drop.visible, false)
  const fallen = drop.position.y
  slime.update({ time: 8.4, flow: 1, breath: 0 })
  assert.ok(drop.position.y > fallen + 3)
  assert.equal(drop.visible, false)
  slime.dispose(); material.dispose()
})
