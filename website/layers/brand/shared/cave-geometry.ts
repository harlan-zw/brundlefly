import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from 'three'
import { displaceRoomGeometry } from './room-height.ts'
import type { RoomHeightRaster } from './room-height.ts'

// Connected shoulders and roof shelves frame the clearing. Every point belongs to the chamber shell.
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
// Each knot holds one random value. A cubic curve joins them, so the wall swells along its length without a crease.
const axialVariation = (z: number, seed: number) => {
  const section = z >= knots.at(-1)! ? knots.length - 2 : axialSection(z)
  const value = (index: number) => seeded(seed + index * 19)
  const slope = (index: number) => {
    const before = Math.max(0, index - 1), after = Math.min(knots.length - 1, index + 1)
    return (value(after) - value(before)) / (knots[after]! - knots[before]!)
  }
  const span = knots[section + 1]! - knots[section]!
  const blend = Math.min(1, Math.max(0, (z - knots[section]!) / span))
  const square = blend * blend, cube = square * blend
  return value(section) * (2 * cube - 3 * square + 1) + slope(section) * span * (cube - 2 * square + blend)
    + value(section + 1) * (3 * square - 2 * cube) + slope(section + 1) * span * (cube - square)
}
// The roof stays above the walking head clearance. A soft limit leaves no flat plane and no step.
const softMaximum = (value: number, limit: number) => (value + limit + Math.sqrt((value - limit) ** 2 + 0.09)) / 2
const smoothStep = (from: number, to: number, value: number) => {
  const blend = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return blend * blend * (3 - 2 * blend)
}

/** The same control section places the cave skin and its attached membrane binders. */
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

/** One connected cave skin. Smooth folds follow the control points of each section. */
export function createCaveGeometry(raster: RoomHeightRaster, worldOffset: readonly [number, number, number]) {
  const angularSubdivisions = 8
  // The tightest bend the skin keeps. It stays wider than the 0.26 unit height relief.
  const bendRadius = 0.4
  const axialSegments = Math.ceil((knots.at(-1)! - knots[0]) / 0.3)
  const angularSegments = (profile.length - 1) * angularSubdivisions
  const row = angularSegments + 1
  const vertices: number[] = []
  const indices: number[] = []
  const bands: number[] = []
  const uvs: number[] = []
  const point = new Vector3()
  const fold = new Float64Array(row * 2)
  const relaxed = new Float64Array(row * 2)
  for (let depth = 0; depth <= axialSegments; depth++) {
    const z = knots[0] + depth / axialSegments * (knots.at(-1)! - knots[0])
    // The membrane binders use the same curve type, so they stay close to this skin.
    const section = new CatmullRomCurve3(caveCrossSection(z))
    for (let segment = 0; segment <= angularSegments; segment++) {
      const part = Math.min(profile.length - 2, Math.floor(segment / angularSubdivisions))
      const blend = (segment - part * angularSubdivisions) / angularSubdivisions
      section.getPoint(segment / angularSegments, point)
      // A soft swell between control points varies the folds. It ends level at each point, so no ridge forms.
      const swell = Math.sin(blend * Math.PI) ** 2 * axialVariation(z, part * 71 + 503) * 0.22
      const edge = Math.min(1, Math.max(0, (point.y + 2.2) / 1.1))
      fold[segment * 2] = point.x + Math.sign(point.x) * swell * edge
      fold[segment * 2 + 1] = point.y + swell * edge
    }
    // The control section has hairpin turns. The inward height relief would fold a tight recess through itself.
    // Each pass opens every bend that is tighter than the relief. Gentle folds keep their place.
    for (let pass = 0, moved = true; moved && pass < 48; pass++) {
      relaxed.set(fold)
      moved = false
      for (let segment = 1; segment < angularSegments; segment++) {
        const x = relaxed[segment * 2]!, y = relaxed[segment * 2 + 1]!
        const inX = x - relaxed[segment * 2 - 2]!, inY = y - relaxed[segment * 2 - 1]!
        const outX = relaxed[segment * 2 + 2]! - x, outY = relaxed[segment * 2 + 3]! - y
        const turn = Math.abs(Math.atan2(inX * outY - inY * outX, inX * outX + inY * outY))
        const radius = (Math.hypot(inX, inY) + Math.hypot(outX, outY)) / 2 / Math.max(turn, 0.0001)
        const tight = Math.min(1, Math.max(0, (bendRadius - radius) / bendRadius * 2))
        if (tight === 0) continue
        moved = true
        fold[segment * 2] = x + ((relaxed[segment * 2 - 2]! + relaxed[segment * 2 + 2]!) / 2 - x) * 0.5 * tight
        fold[segment * 2 + 1] = y + ((relaxed[segment * 2 - 1]! + relaxed[segment * 2 + 3]!) / 2 - y) * 0.5 * tight
      }
    }
    for (let segment = 0; segment <= angularSegments; segment++) {
      const x = fold[segment * 2]!
      const y = softMaximum(fold[segment * 2 + 1]!, 3.4 - smoothStep(2.6, 3.4, Math.abs(x)) * 6)
      vertices.push(x - worldOffset[0], y - worldOffset[1], z - worldOffset[2])
      uvs.push(segment / angularSegments, depth / axialSegments)
      if (depth < axialSegments && segment < angularSegments) {
        const a = depth * row + segment, b = a + 1, c = a + row, d = c + 1
        indices.push(a, c, b, b, c, d)
        bands.push(0, 0)
      }
    }
  }
  // Close both distant ends. Full player turns remain inside the chamber.
  const center = vertices.length / 3
  vertices.push(-worldOffset[0], -0.2 - worldOffset[1], knots[0] - worldOffset[2])
  uvs.push(0.5, 0.5)
  for (let segment = 0; segment < angularSegments; segment++) { indices.push(center, segment, segment + 1); bands.push(1) }
  indices.push(center, angularSegments, 0)
  bands.push(1)
  const frontCenter = vertices.length / 3
  vertices.push(-worldOffset[0], -0.2 - worldOffset[1], knots.at(-1)! - worldOffset[2])
  uvs.push(0.5, 0.5)
  const frontRow = axialSegments * row
  for (let segment = 0; segment < angularSegments; segment++) {
    indices.push(frontCenter, frontRow + segment + 1, frontRow + segment)
    bands.push(2)
  }
  indices.push(frontCenter, frontRow, frontRow + angularSegments)
  bands.push(2)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  displaceRoomGeometry(geometry, raster, worldOffset)
  // The skin shares every lighting normal. Only the two end walls split from it, after displacement.
  // Attached projection normals stay identical at those two seams.
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
