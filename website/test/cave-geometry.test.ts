import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BackSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { caveCrossSection, createCaveGeometry } from '../layers/brand/shared/cave-geometry.ts'

const raster = { width: 2, height: 2, data: new Uint8ClampedArray(16).fill(128) }
const offset = [0, 1.8, 5] as const

test('cave forms connected deep roof shelves and wall recesses at the visible staging area', () => {
  const near = caveCrossSection(1), far = caveCrossSection(3.1)
  const depth = Math.max(...near.map((point, index) => point.distanceTo(new Vector3(far[index]!.x, far[index]!.y, point.z))))
  assert.ok(depth > 0.8)
  const rightShelf = near[11]!, adjacentRoof = near[10]!
  assert.ok(rightShelf.x < adjacentRoof.x && rightShelf.y < adjacentRoof.y)
  assert.ok(rightShelf.y >= 3.4)
  const geometry = createCaveGeometry(raster, offset)
  assert.ok(geometry.index!.count / 3 < 22000)
  assert.ok(geometry.boundingBox!.min.z + offset[2] < -10)
  assert.ok(geometry.boundingBox!.max.z + offset[2] >= 24)
  geometry.dispose()
})

test('cave shelves break into irregular axial rock planes instead of uninterrupted corrugated bands', () => {
  const corner = caveCrossSection(1.3), before = caveCrossSection(1.299), after = caveCrossSection(1.301)
  let changes = 0
  for (let index = 0; index < corner.length; index++) {
    const incoming = corner[index]!.clone().sub(before[index]!).multiplyScalar(1000)
    const outgoing = after[index]!.clone().sub(corner[index]!).multiplyScalar(1000)
    if (incoming.distanceTo(outgoing) > 0.1) changes++
  }
  assert.ok(changes > 8)
})

test('structural cave leaves the walking corridor, player travel, and portal sightline clear', () => {
  const geometry = createCaveGeometry(raster, offset)
  const material = new MeshBasicMaterial({ side: BackSide })
  const cave = new Mesh(geometry, material)
  cave.position.set(...offset)
  cave.updateMatrixWorld()
  for (const x of [-1.4, 0, 1.4]) {
    for (const z of [-1, 0, 1]) {
      const ceiling = new Raycaster(new Vector3(x, 1.2, z), new Vector3(0, 1, 0)).intersectObject(cave)[0]
      assert.ok(ceiling && ceiling.distance > 2)
    }
    for (const z of [8.32 / 0.9 - 1.4, 10.4 / 0.9 + 1.4]) {
      const player = new Vector3(x, 0.75, z), portal = new Vector3(0, 0.6, -2.9)
      const obstruction = new Raycaster(player, portal.clone().sub(player).normalize(), 0, player.distanceTo(portal)).intersectObject(cave)
      assert.equal(obstruction.length, 0)
      const reverseView = new Raycaster(player, new Vector3(0, 0, 1)).intersectObject(cave)[0]
      assert.ok(reverseView)
      assert.ok(reverseView.point.z > 23.5 && reverseView.point.z <= 24)
    }
  }
  const normals = geometry.getAttribute('normal')
  for (let index = 0; index < normals.count; index++) assert.ok(Number.isFinite(normals.getX(index)))
  geometry.dispose(); material.dispose()
})

test('major cave folds keep sharp lighting planes while breathing attachment normals remain continuous', () => {
  const geometry = createCaveGeometry(raster, offset)
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal')
  const attached = geometry.getAttribute('roomProjectionNormal')
  const first = new Map<string, number>()
  let sharpSeams = 0
  for (let index = 0; index < positions.count; index++) {
    const key = `${positions.getX(index)},${positions.getY(index)},${positions.getZ(index)}`
    const other = first.get(key)
    if (other === undefined) { first.set(key, index); continue }
    assert.equal(attached.getX(index), attached.getX(other))
    assert.equal(attached.getY(index), attached.getY(other))
    assert.equal(attached.getZ(index), attached.getZ(other))
    const cosine = normals.getX(index) * normals.getX(other) + normals.getY(index) * normals.getY(other) + normals.getZ(index) * normals.getZ(other)
    if (cosine < 0.8) sharpSeams++
  }
  assert.ok(sharpSeams > 100)
  geometry.dispose()
})
