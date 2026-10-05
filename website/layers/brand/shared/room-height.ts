import { BoxGeometry, Float32BufferAttribute, Vector3 } from 'three'
import type { BufferGeometry, Texture } from 'three'

export type RoomHeightRaster = { width: number, height: number, data: Uint8ClampedArray }
export type RoomHeight = { texture: Texture, raster: RoomHeightRaster }
const repeat = (value: number) => value - Math.floor(value)
const sample = (raster: RoomHeightRaster, u: number, v: number) => {
  // Canvas rows face downward; Three's uploaded texture flips those rows.
  const x = repeat(u) * raster.width - 0.5
  const y = repeat(1 - v) * raster.height - 0.5
  const pixel = (px: number, py: number) => raster.data[(((py % raster.height + raster.height) % raster.height) * raster.width
    + (px % raster.width + raster.width) % raster.width) * 4]! / 255
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  return (pixel(ix, iy) * (1 - fx) + pixel(ix + 1, iy) * fx) * (1 - fy)
    + (pixel(ix, iy + 1) * (1 - fx) + pixel(ix + 1, iy + 1) * fx) * fy
}

/** Raise texture folds inward. Leave the walkable lower boundary fixed. */
export function displaceRoomGeometry(geometry: BufferGeometry, raster: RoomHeightRaster, worldOffset: readonly [number, number, number]) {
  const positions = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  geometry.setAttribute('roomProjectionPosition', new Float32BufferAttribute(Array.from(positions.array), 3))
  geometry.setAttribute('roomProjectionNormal', new Float32BufferAttribute(Array.from(normals.array), 3))
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index) + worldOffset[0]
    const y = positions.getY(index) + worldOffset[1]
    const z = positions.getZ(index) + worldOffset[2]
    const nx = normals.getX(index), ny = normals.getY(index), nz = normals.getZ(index)
    const wx = Math.pow(Math.abs(nx), 4), wy = Math.pow(Math.abs(ny), 4), wz = Math.pow(Math.abs(nz), 4)
    const height = (sample(raster, y / 3, z / 3) * wx + sample(raster, x / 3, z / 3) * wy
      + sample(raster, x / 3, y / 3) * wz) / Math.max(0.00001, wx + wy + wz)
    const edge = Math.min(1, Math.max(0, (y + 2.2) / 0.5))
    const depth = height * 0.26 * edge * edge * (3 - 2 * edge)
    positions.setXYZ(index, positions.getX(index) - nx * depth, positions.getY(index) - ny * depth,
      positions.getZ(index) - nz * depth)
  }
  positions.needsUpdate = true
  geometry.computeVertexNormals()
  // Face UV seams retain duplicate vertices. Share their lighting normals across the rounded corners.
  const sums = new Map<string, Vector3>()
  const key = (index: number) => `${Math.round(positions.getX(index) * 1e4)},${Math.round(positions.getY(index) * 1e4)},${Math.round(positions.getZ(index) * 1e4)}`
  for (let index = 0; index < normals.count; index++) {
    const id = key(index)
    const sum = sums.get(id) ?? new Vector3()
    sum.add(new Vector3(normals.getX(index), normals.getY(index), normals.getZ(index)))
    sums.set(id, sum)
  }
  for (let index = 0; index < normals.count; index++) {
    const normal = sums.get(key(index))!.clone().normalize()
    normals.setXYZ(index, normal.x, normal.y, normal.z)
  }
  normals.needsUpdate = true
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}

export function createRoomGeometry(raster: RoomHeightRaster, worldOffset: readonly [number, number, number]) {
  const dimensions = [22, 9, 36] as const
  const radius = 1.3
  const geometry = new BoxGeometry(...dimensions, ...dimensions.map(value => Math.ceil(value / 0.3)) as [number, number, number])
  const positions = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const inner = dimensions.map(value => value / 2 - radius)
  for (let index = 0; index < positions.count; index++) {
    const point = new Vector3(positions.getX(index), positions.getY(index), positions.getZ(index))
    const corner = new Vector3(Math.max(-inner[0]!, Math.min(inner[0]!, point.x)),
      Math.max(-inner[1]!, Math.min(inner[1]!, point.y)), Math.max(-inner[2]!, Math.min(inner[2]!, point.z)))
    const normal = point.clone().sub(corner).normalize()
    point.copy(corner).addScaledVector(normal, radius)
    positions.setXYZ(index, point.x, point.y, point.z)
    normals.setXYZ(index, normal.x, normal.y, normal.z)
  }
  displaceRoomGeometry(geometry, raster, worldOffset)
  return geometry
}
