import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BackSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import type { BufferGeometry } from 'three'
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
  assert.ok(geometry.index!.count / 3 < 40000)
  assert.ok(geometry.boundingBox!.min.z + offset[2] < -10)
  assert.ok(geometry.boundingBox!.max.z + offset[2] >= 24)
  geometry.dispose()
})

test('cave control sections swell along the tunnel without a crease at a knot', () => {
  for (const knot of [-2.2, 0, 1.3, 3.5]) {
    const corner = caveCrossSection(knot), before = caveCrossSection(knot - 0.001), after = caveCrossSection(knot + 0.001)
    let moving = 0
    for (let index = 0; index < corner.length; index++) {
      const incoming = corner[index]!.clone().sub(before[index]!).multiplyScalar(1000)
      const outgoing = after[index]!.clone().sub(corner[index]!).multiplyScalar(1000)
      assert.ok(incoming.distanceTo(outgoing) < 0.02)
      if (Math.hypot(incoming.x, incoming.y) > 0.01) moving++
    }
    assert.ok(moving > 8)
  }
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

const tubeEdges = (geometry: BufferGeometry, visit: (a: number, b: number) => void) => {
  const positions = geometry.getAttribute('position'), index = geometry.index!
  const onEndWall = (vertex: number) => Math.abs(positions.getZ(vertex) + offset[2] + 11) < 0.2 || Math.abs(positions.getZ(vertex) + offset[2] - 24) < 0.2
  for (let face = 0; face < index.count; face += 3) {
    const corners = [index.getX(face), index.getX(face + 1), index.getX(face + 2)]
    if (corners.some(onEndWall)) continue
    for (let edge = 0; edge < 3; edge++) visit(corners[edge]!, corners[(edge + 1) % 3]!)
  }
}

test('cave skin shares its lighting normals, and only the two end walls split from it', () => {
  const geometry = createCaveGeometry(raster, offset)
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal')
  const attached = geometry.getAttribute('roomProjectionNormal')
  const first = new Map<string, number>()
  for (let index = 0; index < positions.count; index++) {
    const key = `${positions.getX(index)},${positions.getY(index)},${positions.getZ(index)}`
    const other = first.get(key)
    if (other === undefined) { first.set(key, index); continue }
    const z = positions.getZ(index) + offset[2]
    assert.ok(Math.abs(z + 11) < 0.2 || Math.abs(z - 24) < 0.2)
    assert.equal(attached.getX(index), attached.getX(other))
    assert.equal(attached.getY(index), attached.getY(other))
    assert.equal(attached.getZ(index), attached.getZ(other))
  }
  // Neighbouring normals turn gradually. A hard seam would turn them by more than a right angle.
  let edges = 0
  tubeEdges(geometry, (a, b) => {
    edges++
    assert.ok(normals.getX(a) * normals.getX(b) + normals.getY(a) * normals.getY(b) + normals.getZ(a) * normals.getZ(b) > 0.3)
  })
  assert.ok(edges > 50000)
  geometry.dispose()
})

test('height relief turns no cave triangle over, for flat and for busy height artwork', () => {
  const busy = { width: 96, height: 96, data: Uint8ClampedArray.from({ length: 96 * 96 * 4 }, (_, index) => {
    const pixel = Math.floor(index / 4)
    return (Math.sin(pixel % 96 * 0.9) * Math.cos(Math.floor(pixel / 96) * 0.7) * 0.5 + 0.5) * 255
  }) }
  for (const height of [raster, busy]) {
    const geometry = createCaveGeometry(height, offset)
    const positions = geometry.getAttribute('position'), rest = geometry.getAttribute('roomProjectionPosition'), index = geometry.index!
    const normal = (attribute: typeof positions, face: number) => {
      const [a, b, c] = [0, 1, 2].map(corner => new Vector3().fromBufferAttribute(attribute, index.getX(face + corner)))
      return b!.sub(a!).cross(c!.sub(a!))
    }
    for (let face = 0; face < index.count; face += 3) assert.ok(normal(positions, face).dot(normal(rest, face)) >= 0)
    geometry.dispose()
  }
})
