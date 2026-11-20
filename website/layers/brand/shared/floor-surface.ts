import { BufferGeometry, Float32BufferAttribute, PlaneGeometry } from 'three'

/** The floor's lattice in world units. `level` is the height of flat ground, and `z` is the middle of its depth. */
export const floorSurface = { width: 22, depth: 36, columns: 44, rows: 48, level: -2.235, z: 5 } as const

/** One soft mark painted on the floor. `data` holds four numbers that the mark's material reads. */
export type FloorSpot = { x: number, z: number, radius: number, data: readonly [number, number, number, number] }

const cellWidth = floorSurface.width / floorSurface.columns
const cellDepth = floorSurface.depth / floorSurface.rows
const west = -floorSurface.width / 2
const north = floorSurface.z - floorSurface.depth / 2

/** Height above flat ground. The middle stays nearly level. Raised seams collect at the cave edges. */
export function floorRelief(x: number, z: number) {
  const along = floorSurface.z - z
  const edge = Math.min(1, Math.max(0, (Math.abs(x) - 2) / 3))
  return Math.sin(x * 3 + along * 0.9) * 0.025 + edge * Math.sin(along * 2.4 + x) * 0.11
}

/** The floor in world space. Its mesh needs no turn and no offset. */
export function createFloorGeometry() {
  const geometry = new PlaneGeometry(floorSurface.width, floorSurface.depth, floorSurface.columns, floorSurface.rows)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, floorSurface.level, floorSurface.z)
  const positions = geometry.getAttribute('position')
  for (let index = 0; index < positions.count; index++) {
    positions.setY(index, floorSurface.level + floorRelief(positions.getX(index), positions.getZ(index)))
  }
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Floor marks as one mesh. Each mark reuses the floor's own triangles under its square, so it lies on the drawn floor at every point.
 * A flat plane would sink into the raised seams near the walls.
 * Attributes: `spot` is the mark's x, z, and radius. `spotData` is the mark's `data`.
 */
export function createFloorDecalGeometry(spots: readonly FloorSpot[]) {
  const positions: number[] = []
  const marks: number[] = []
  const data: number[] = []
  const indices: number[] = []
  for (const spot of spots) {
    const firstColumn = Math.max(0, Math.floor((spot.x - spot.radius - west) / cellWidth))
    const lastColumn = Math.min(floorSurface.columns, Math.ceil((spot.x + spot.radius - west) / cellWidth))
    const firstRow = Math.max(0, Math.floor((spot.z - spot.radius - north) / cellDepth))
    const lastRow = Math.min(floorSurface.rows, Math.ceil((spot.z + spot.radius - north) / cellDepth))
    const start = positions.length / 3
    const stride = lastColumn - firstColumn + 1
    for (let row = firstRow; row <= lastRow; row++) {
      for (let column = firstColumn; column <= lastColumn; column++) {
        const x = west + column * cellWidth, z = north + row * cellDepth
        positions.push(x, floorSurface.level + floorRelief(x, z), z)
        marks.push(spot.x, spot.z, spot.radius)
        data.push(...spot.data)
      }
    }
    for (let row = 0; row < lastRow - firstRow; row++) {
      for (let column = 0; column < stride - 1; column++) {
        // The same diagonal as the floor's cells.
        const a = start + row * stride + column, b = a + stride, c = b + 1, d = a + 1
        indices.push(a, b, d, b, c, d)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('spot', new Float32BufferAttribute(marks, 3))
  geometry.setAttribute('spotData', new Float32BufferAttribute(data, 4))
  geometry.setIndex(indices)
  return geometry
}
