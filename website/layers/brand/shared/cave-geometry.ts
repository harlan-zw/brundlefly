import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'
import { displaceRoomGeometry } from './room-height.ts'
import type { RoomHeightRaster } from './room-height.ts'

// Connected chitin shoulders and roof shelves frame the clearing. Every point belongs to the chamber shell.
const profile = [
  [-5.2, -2.2], [-5.6, -0.7], [-4.65, 0.3], [-5.05, 1.5], [-3.7, 2.55], [-4.55, 3.6],
  [-2.8, 4.55], [-1.55, 3.95], [-0.35, 5.4], [1.1, 4.65], [2.1, 4.25], [1.8, 3.65],
  [3.6, 3.8], [4.8, 2.5], [4.15, 1.2], [5.2, 0.1], [5.8, -0.8], [5.1, -2.2],
] as const
const knots = [-11, -7.8, -4.9, -2.2, 0, 1.3, 3.5, 5.1, 7.4, 10.8, 14.9, 19.2, 24] as const
const seeded = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return (value - Math.floor(value)) * 2 - 1
}
const axialSection = (z: number) => Math.min(knots.length - 2, Math.max(0, knots.findIndex((value, index) => index < knots.length - 1 && z < knots[index + 1]!) ))
const axialVariation = (z: number, seed: number) => {
  const section = z >= knots.at(-1)! ? knots.length - 2 : axialSection(z)
  const blend = Math.min(1, Math.max(0, (z - knots[section]!) / (knots[section + 1]! - knots[section]!)))
  return seeded(seed + section * 19) * (1 - blend) + seeded(seed + (section + 1) * 19) * blend
}

/** The same jagged section places the stone shell and its attached membrane binders. */
export function caveCrossSection(z: number) {
  return profile.map(([x, y], index) => {
    const edge = Math.min(1, Math.max(0, (y + 2.2) / 1.1))
    const ridge = axialVariation(z, index * 43 + 7)
    const recess = axialVariation(z, index * 29 + 311)
    const width = x + Math.sign(x) * (ridge * 0.8 + recess * 0.4) * edge
    const roof = Math.max(0, (y - 1.5) / 3.9)
    const ceiling = y + ridge * 0.8 * roof + recess * 0.45 * roof
    // Keep the portal and the walking head clearance open beneath the irregular roof.
    return new Vector3(width, Math.abs(width) < 2.6 ? Math.max(3.4, ceiling) : ceiling, z)
  })
}

/** One connected cave skin replaces the distant rounded room box. */
export function createCaveGeometry(raster: RoomHeightRaster, worldOffset: readonly [number, number, number]) {
  const angularSubdivisions = 4
  const depths: { z: number, section: number }[] = []
  for (let section = 0; section < knots.length - 1; section++) {
    const segments = Math.ceil((knots[section + 1]! - knots[section]!) / 0.25)
    for (let step = 0; step < segments; step++) depths.push({ z: knots[section]! + step / segments * (knots[section + 1]! - knots[section]!), section })
  }
  depths.push({ z: 24, section: knots.length - 2 })
  const axialSegments = depths.length - 1
  const angularSegments = (profile.length - 1) * angularSubdivisions
  const row = angularSegments + 1
  const vertices: number[] = []
  const indices: number[] = []
  const bands: number[] = []
  const uvs: number[] = []
  for (let depth = 0; depth <= axialSegments; depth++) {
    const { z, section } = depths[depth]!
    const points = caveCrossSection(z)
    for (let segment = 0; segment <= angularSegments; segment++) {
      const part = Math.min(profile.length - 2, Math.floor(segment / angularSubdivisions))
      const blend = (segment - part * angularSubdivisions) / angularSubdivisions
      const point = points[part]!.clone().lerp(points[part + 1]!, blend)
      // Chipped corners break broad plates without adding detached shards or obstructing the clearing.
      const chip = Math.sin(blend * Math.PI) * axialVariation(z, part * 71 + 503) * 0.22
      const edge = Math.min(1, Math.max(0, (point.y + 2.2) / 1.1))
      point.x += Math.sign(point.x) * chip * edge
      point.y += chip * edge
      if (Math.abs(point.x) < 2.6) point.y = Math.max(3.4, point.y)
      vertices.push(point.x - worldOffset[0], point.y - worldOffset[1], point.z - worldOffset[2])
      uvs.push(segment / angularSegments, depth / axialSegments)
      if (depth < axialSegments && segment < angularSegments) {
        const a = depth * row + segment, b = a + 1, c = a + row, d = c + 1
        indices.push(a, c, b, b, c, d)
        const band = Math.floor(segment / angularSubdivisions) + section * profile.length
        bands.push(band, band)
      }
    }
  }
  // Close both distant ends. Full player turns remain inside the chamber.
  const center = vertices.length / 3
  vertices.push(-worldOffset[0], -0.2 - worldOffset[1], -11 - worldOffset[2])
  uvs.push(0.5, 0.5)
  const backBand = knots.length * profile.length
  for (let segment = 0; segment < angularSegments; segment++) { indices.push(center, segment, segment + 1); bands.push(backBand) }
  indices.push(center, angularSegments, 0)
  bands.push(backBand)
  const frontCenter = vertices.length / 3
  vertices.push(-worldOffset[0], -0.2 - worldOffset[1], 24 - worldOffset[2])
  uvs.push(0.5, 0.5)
  const frontRow = axialSegments * row
  for (let segment = 0; segment < angularSegments; segment++) {
    indices.push(frontCenter, frontRow + segment + 1, frontRow + segment)
    bands.push(backBand + 1)
  }
  indices.push(frontCenter, frontRow, frontRow + angularSegments)
  bands.push(backBand + 1)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  displaceRoomGeometry(geometry, raster, worldOffset)
  // Split only the major rock folds after displacement. Attached projection normals stay identical at seams.
  const sculpted = new BufferGeometry()
  const copies = new Map<string, number>()
  const splitIndices: number[] = []
  const attributes = Object.entries(geometry.attributes).map(([name, attribute]) => ({ name, attribute, values: [] as number[] }))
  for (let index = 0; index < indices.length; index++) {
    const source = indices[index]!, band = bands[Math.floor(index / 3)]!
    const key = `${source}:${band}`
    let target = copies.get(key)
    if (target === undefined) {
      target = copies.size
      copies.set(key, target)
      for (const { attribute, values } of attributes) {
        for (let component = 0; component < attribute.itemSize; component++) values.push(attribute.array[source * attribute.itemSize + component]!)
      }
    }
    splitIndices.push(target)
  }
  for (const { name, attribute, values } of attributes) sculpted.setAttribute(name, new Float32BufferAttribute(values, attribute.itemSize))
  sculpted.setIndex(splitIndices)
  sculpted.computeVertexNormals()
  sculpted.computeBoundingBox()
  sculpted.computeBoundingSphere()
  geometry.dispose()
  return sculpted
}
