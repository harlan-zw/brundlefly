import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { createFloorDecalGeometry, createFloorGeometry, floorRelief, floorSurface } from '../layers/brand/shared/floor-surface.ts'

const material = new MeshBasicMaterial({ side: DoubleSide })
const down = new Vector3(0, -1, 0)
const floorAt = (floor: Mesh, x: number, z: number) => new Raycaster(new Vector3(x, 5, z), down).intersectObject(floor)[0]

test('the walking corridor stays nearly level, and the seams rise only near the walls', () => {
  let corridor = 0, edge = 0
  for (let z = -4; z <= 8; z += 0.13) {
    corridor = Math.max(corridor, Math.abs(floorRelief(0.7, z)), Math.abs(floorRelief(-1.6, z)))
    edge = Math.max(edge, Math.abs(floorRelief(4.6, z)))
  }
  assert.ok(corridor <= 0.026)
  assert.ok(edge > 0.08)
})

test('a floor mark lies on the drawn floor at its corners and inside its triangles', () => {
  const floor = new Mesh(createFloorGeometry(), material)
  floor.updateMatrixWorld()
  // These marks sit near the walls, where the floor's triangles leave the smooth relief by several centimetres.
  const decal = createFloorDecalGeometry([{ x: -4.1, z: 2.3, radius: 1.4, data: [0, 0, 0, 0] }, { x: 4.3, z: -0.6, radius: 0.9, data: [0, 0, 0, 0] }])
  const positions = decal.getAttribute('position')
  const index = decal.index!
  const corner = (at: number) => new Vector3().fromBufferAttribute(positions, index.getX(at))
  let checked = 0
  for (let triangle = 0; triangle < index.count; triangle += 3) {
    const middle = corner(triangle).add(corner(triangle + 1)).add(corner(triangle + 2)).divideScalar(3)
    const hit = floorAt(floor, middle.x, middle.z)
    assert.ok(hit, 'the mark stays over the floor')
    assert.ok(Math.abs(hit.point.y - middle.y) < 1e-5, `mark ${middle.y} leaves floor ${hit.point.y}`)
    checked++
  }
  assert.ok(checked > 40)
  floor.geometry.dispose()
  decal.dispose()
})

test('a floor mark covers its whole circle and tells each vertex which mark it serves', () => {
  const spots = [{ x: -3.05, z: 1.4, radius: 1.1, data: [0.2, 0.4, 0.6, 3] }, { x: 3.4, z: 0.2, radius: 0.7, data: [1, 0, 0, 5] }] as const
  const decal = createFloorDecalGeometry(spots)
  const mark = new Mesh(decal, material)
  mark.updateMatrixWorld()
  for (const spot of spots) {
    for (let step = 0; step < 24; step++) {
      const angle = step / 24 * Math.PI * 2
      const hit = floorAt(mark, spot.x + Math.cos(angle) * spot.radius * 0.999, spot.z + Math.sin(angle) * spot.radius * 0.999)
      assert.ok(hit, 'the rim of the circle is covered')
    }
  }
  const positions = decal.getAttribute('position'), served = decal.getAttribute('spot'), data = decal.getAttribute('spotData')
  for (let vertex = 0; vertex < positions.count; vertex++) {
    const spot = spots.find(value => Math.abs(value.x - served.getX(vertex)) < 1e-6)!
    assert.ok(spot)
    assert.ok(Math.abs(served.getZ(vertex) - spot.radius) < 1e-6)
    assert.ok(Math.abs(data.getW(vertex) - spot.data[3]) < 1e-6)
    // No vertex strays more than one floor cell beyond its mark's square.
    assert.ok(Math.abs(positions.getX(vertex) - spot.x) <= spot.radius + floorSurface.width / floorSurface.columns + 1e-6)
    assert.ok(Math.abs(positions.getZ(vertex) - spot.z) <= spot.radius + floorSurface.depth / floorSurface.rows + 1e-6)
  }
  decal.dispose()
})
