import {
  Bone, BufferGeometry, Float32BufferAttribute,
  Group, Mesh, MeshPhysicalMaterial, NoColorSpace, RepeatWrapping, Skeleton, SkinnedMesh, SphereGeometry,
  Uint16BufferAttribute, Vector3,
} from 'three'
import type { Texture } from 'three'
import { createEyeMaterial } from './eye-material.ts'
import { applyMascotSurface } from './mascot-surface.ts'

export type FaceInput = { time: number, speaking: number, blink: number, brow?: number, squint?: number }
export type HeadProjection = { texture: Texture, raster: { width: number, height: number, data: Uint8ClampedArray } }

const headWidth = 0.67
const headHeight = 0.86

/** Places projected head pixels in face-local units. The body uses `covers` to hide only what the sculpt hides. */
export function createHeadOutline({ width, height, data }: HeadProjection['raster']) {
  let minX = width - 1, maxX = 0, minY = height - 1, maxY = 0
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3]! > 24) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  const spanX = Math.max(1, maxX - minX)
  const spanY = Math.max(1, maxY - minY)
  return {
    uvAt: (x: number, y: number) => [(minX + (x / headWidth + 0.5) * spanX) / (width - 1),
      1 - (minY + (0.5 - y / headHeight) * spanY) / (height - 1)] as const,
    localAt: (x: number, y: number) => new Vector3((x - minX) / spanX * headWidth - headWidth * 0.5,
      headHeight * 0.5 - (y - minY) / spanY * headHeight, 0),
    covers(x: number, y: number) {
      const px = Math.round(minX + (x / headWidth + 0.5) * spanX)
      const py = Math.round(minY + (0.5 - y / headHeight) * spanY)
      return px >= 0 && py >= 0 && px < width && py < height && data[(py * width + px) * 4 + 3]! > 24
    },
  }
}

/** The caller may retain the original sprite when the reference texture is unavailable. */
export function createFaceModel(texture?: Texture, projection?: HeadProjection) {
  if (projection) return createProjectedFace(texture, projection)
  const root = new Group()
  return { root, animatedNodes: [] as Bone[], update(_input: FaceInput) { root.updateMatrixWorld(true) }, updateMaterials(_time: number) {}, dispose() {} }
}

/** Exact frontal artwork over a skinned volume. Alpha describes silhouette, never pixel brightness. */
function createProjectedFace(skinTexture: Texture | undefined, { texture, raster }: HeadProjection) {
  const root = new Group()
  root.name = 'Brundlefly-reference-head'
  const { width, height, data } = raster
  const geometries: BufferGeometry[] = []
  const heightTexture = skinTexture?.clone()
  if (heightTexture) { heightTexture.colorSpace = NoColorSpace; heightTexture.needsUpdate = true }
  const front = new MeshPhysicalMaterial({ color: '#FFFFFF', map: texture,
    emissiveIntensity: 0, roughness: 0.65, metalness: 0.02, clearcoat: 0, alphaTest: 0.06 })
  const back = new MeshPhysicalMaterial({ color: '#B6B8A6', map: skinTexture ?? null, bumpMap: heightTexture ?? null,
    bumpScale: 0.012, roughness: 0.71, clearcoat: 0.08 })
  const sideTexture = skinTexture?.clone()
  if (sideTexture) { sideTexture.wrapS = sideTexture.wrapT = RepeatWrapping; sideTexture.needsUpdate = true }
  const side = back.clone()
  side.map = sideTexture ?? null
  const lidSkin = new MeshPhysicalMaterial({ map: skinTexture ?? null, color: '#BAAA96', bumpMap: heightTexture ?? null,
    bumpScale: 0.004, roughness: 0.72, metalness: 0.02, clearcoat: 0.03 })
  if (heightTexture) { heightTexture.wrapS = heightTexture.wrapT = RepeatWrapping; heightTexture.needsUpdate = true }
  const eye = createEyeMaterial(texture)
  const eyeMaterial = eye.material
  const materials = [front, back, side, lidSkin]
  const surfaces = materials.map(material => applyMascotSurface(material, 'skin'))
  const { uvAt, localAt } = createHeadOutline(raster)
  const depthAt = (x: number, y: number) => 0.028 + Math.sqrt(Math.max(0, 1 - Math.pow(x / 0.35, 2) * 0.82
    - Math.pow(y / 0.44, 2) * 0.75)) * 0.23
  const eyeCenters = [localAt(width * 0.3934, height * 0.4417), localAt(width * 0.6916, height * 0.4826)]
  const eyes = [
    { x: eyeCenters[0]!.x, y: eyeCenters[0]!.y, rx: 0.078, ry: 0.074, rz: 0.061 },
    { x: eyeCenters[1]!.x, y: eyeCenters[1]!.y, rx: 0.054, ry: 0.044, rz: 0.045 },
  ]
  const anchors = [new Vector3(0.045, -0.11, 0.13), new Vector3(-0.21, -0.1, 0.1), new Vector3(0.23, -0.13, 0.1),
    ...eyes.map(eye => new Vector3(eye.x, eye.y + eye.ry, depthAt(eye.x, eye.y))),
    ...eyes.flatMap(eye => [new Vector3(eye.x, eye.y, depthAt(eye.x, eye.y)), new Vector3(eye.x, eye.y, depthAt(eye.x, eye.y))])]
  const names = ['jaw', 'cheek-left', 'cheek-right', 'brow-0', 'brow-1', 'upper-lid-0', 'lower-lid-0', 'upper-lid-1', 'lower-lid-1']
  const animatedNodes = anchors.map((anchor, index) => {
    const bone = new Bone(); bone.name = `face-${names[index]}`; bone.position.copy(anchor); return bone
  })
  const fixed = new Bone()
  fixed.name = 'face-fixed-skull'
  const bones = [fixed, ...animatedNodes]
  bones.slice(1).forEach(bone => fixed.add(bone))
  function influences(x: number, y: number) {
    const jaw = Math.pow(Math.max(0, 1 - Math.pow((x - 0.045) / 0.155, 2) - Math.pow((y + 0.26) / 0.17, 2)), 1.3) * 0.93
    const leftCheek = Math.pow(Math.max(0, 1 - Math.pow((x + 0.21) / 0.085, 2) - Math.pow((y + 0.12) / 0.17, 2)), 2) * 0.5
    const rightCheek = Math.pow(Math.max(0, 1 - Math.pow((x - 0.23) / 0.075, 2) - Math.pow((y + 0.14) / 0.16, 2)), 2) * 0.5
    const brow = eyes.map(eye => Math.pow(Math.max(0, 1 - Math.pow((x - eye.x) / (eye.rx * 1.35), 2)
      - Math.pow((y - eye.y - eye.ry) / 0.048, 2)), 2) * 0.78)
    const weights = [{ index: 1, weight: jaw }, { index: 2, weight: leftCheek }, { index: 3, weight: rightCheek },
      { index: 4, weight: brow[0]! }, { index: 5, weight: brow[1]! }].sort((a, b) => b.weight - a.weight).slice(0, 3)
    const sum = weights.reduce((value, weight) => value + weight.weight, 0)
    const scale = sum > 0.96 ? 0.96 / sum : 1
    return { indices: [0, ...weights.map(value => value.index)], weights: [1 - sum * scale, ...weights.map(value => value.weight * scale)] }
  }
  const positions: number[] = [], uvs: number[] = [], skinIndices: number[] = [], skinWeights: number[] = [], indices: number[] = []
  const count = width * height
  const occupied = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = localAt(x, y)
    p.z = depthAt(p.x, p.y)
    const beak = Math.exp(-Math.pow((p.x - 0.037) / 0.039, 2) - Math.pow((p.y + 0.03) / 0.3, 2))
    p.z += beak * 0.07
    const mouth = Math.exp(-Math.pow((p.x - 0.044) / 0.09, 2) - Math.pow((p.y + 0.235) / 0.115, 2))
    p.z -= mouth * 0.055
    positions.push(...p.toArray())
    uvs.push(x / (width - 1), 1 - y / (height - 1))
    const weight = influences(p.x, p.y)
    skinIndices.push(...weight.indices); skinWeights.push(...weight.weights)
    occupied[y * width + x] = data[(y * width + x) * 4 + 3]! > 24 ? 1 : 0
  }
  const cells = new Uint8Array((width - 1) * (height - 1))
  for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
    const a = y * width + x
    if (!(occupied[a] && occupied[a + 1] && occupied[a + width] && occupied[a + width + 1])) continue
    cells[y * (width - 1) + x] = 1
    const center = localAt(x + 0.5, y + 0.5)
    if (eyes.some(eye => Math.pow((center.x - eye.x) / (eye.rx * 0.98), 2) + Math.pow((center.y - eye.y) / (eye.ry * 0.98), 2) < 1)) continue
    indices.push(a, a + width, a + 1, a + 1, a + width, a + width + 1)
  }
  const outlineDistance = Float32Array.from(occupied, value => value ? 100 : 0)
  for (let y = 1; y < height; y++) for (let x = 1; x < width; x++) {
    const index = y * width + x
    outlineDistance[index] = Math.min(outlineDistance[index]!, outlineDistance[index - 1]! + 1, outlineDistance[index - width]! + 1)
  }
  for (let y = height - 2; y >= 0; y--) for (let x = width - 2; x >= 0; x--) {
    const index = y * width + x
    outlineDistance[index] = Math.min(outlineDistance[index]!, outlineDistance[index + 1]! + 1, outlineDistance[index + width]! + 1)
  }
  const frontEnd = indices.length
  // Close the exact mapped outline. A separate ellipsoid cannot follow an asymmetric cutout.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = localAt(x, y)
    const rearDepth = -0.018 - Math.sqrt(Math.max(0, 1 - Math.pow(p.x / 0.35, 2) * 0.82
      - Math.pow(p.y / 0.44, 2) * 0.75)) * 0.22
    const t = Math.max(0, Math.min(1, (outlineDistance[y * width + x]! - 1) / 5))
    const thickness = t * t * (3 - 2 * t)
    p.z = (positions[(y * width + x) * 3 + 2]! - 0.008) * (1 - thickness) + rearDepth * thickness
    positions.push(...p.toArray())
    uvs.push(x / (width - 1), 1 - y / (height - 1))
    const weight = influences(p.x, p.y)
    skinIndices.push(...weight.indices); skinWeights.push(...weight.weights)
  }
  const kernel = [1, 4, 6, 4, 1]
  for (let pass = 0; pass < 2; pass++) {
    const previous = Float32Array.from({length: count}, (_, index) => positions[(index + count) * 3 + 2]!)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (!occupied[y * width + x]) continue
      let depth = 0, weight = 0
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const px = x + dx, py = y + dy
        if (px < 0 || px >= width || py < 0 || py >= height || !occupied[py * width + px]) continue
        const amount = kernel[dx + 2]! * kernel[dy + 2]!
        depth += previous[py * width + px]! * amount; weight += amount
      }
      positions[(y * width + x + count) * 3 + 2] = depth / weight
    }
  }
  for (let index = 0; index < count; index++) {
    const vertex = index + count
    // Rear skin follows the curved volume. Frontal projection UVs remain untouched.
    uvs[vertex * 2] = (Math.atan2(positions[vertex * 3]!, -positions[vertex * 3 + 2]!) + Math.PI) / (Math.PI * 2)
    uvs[vertex * 2 + 1] = positions[vertex * 3 + 1]! / headHeight + 0.5
  }
  const sideEdges: { start: number, end: number }[] = []
  for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
    if (!cells[y * (width - 1) + x]) continue
    const a = y * width + x
    const boundaries = [
      { outside: y === 0 || !cells[(y - 1) * (width - 1) + x], start: a, end: a + 1 },
      { outside: x === width - 2 || !cells[y * (width - 1) + x + 1], start: a + 1, end: a + width + 1 },
      { outside: y === height - 2 || !cells[(y + 1) * (width - 1) + x], start: a + width + 1, end: a + width },
      { outside: x === 0 || !cells[y * (width - 1) + x - 1], start: a + width, end: a },
    ]
    for (const {outside, start, end} of boundaries) if (outside) sideEdges.push({start, end})
  }
  const remaining = new Set(sideEdges)
  const connected = new Map<number, typeof sideEdges>()
  sideEdges.forEach(edge => {
    if (!connected.has(edge.start)) connected.set(edge.start, [])
    connected.get(edge.start)!.push(edge)
  })
  while (remaining.size) {
    let edge = remaining.values().next().value!
    let arc = 0
    while (edge && remaining.has(edge)) {
      remaining.delete(edge)
      const length = Math.hypot(positions[edge.end * 3]! - positions[edge.start * 3]!,
        positions[edge.end * 3 + 1]! - positions[edge.start * 3 + 1]!)
      const vertex = positions.length / 3
      // Side UVs follow contour distance and depth, so skin pores do not stretch into row stripes.
      for (const [source, u] of [[edge.start, arc], [edge.end, arc + length], [edge.start + count, arc], [edge.end + count, arc + length]]) {
        positions.push(...positions.slice(source! * 3, source! * 3 + 3))
        uvs.push(u! * 4, -positions[source! * 3 + 2]! * 4)
        skinIndices.push(...skinIndices.slice(source! * 4, source! * 4 + 4))
        skinWeights.push(...skinWeights.slice(source! * 4, source! * 4 + 4))
      }
      indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2)
      arc += length
      edge = connected.get(edge.end)?.find(value => remaining.has(value))!
    }
  }
  const sideEnd = indices.length
  for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
    if (!cells[y * (width - 1) + x]) continue
    const a = y * width + x + count
    indices.push(a, a + 1, a + width, a + 1, a + width + 1, a + width)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4))
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4))
  geometry.setIndex(indices)
  geometry.addGroup(0, frontEnd, 0)
  geometry.addGroup(frontEnd, sideEnd - frontEnd, 2)
  geometry.addGroup(sideEnd, indices.length - sideEnd, 1)
  geometry.computeVertexNormals(); geometries.push(geometry)
  const face = new SkinnedMesh(geometry, [front, back, side])
  face.name = 'face-reference-surface'
  face.add(fixed); face.updateMatrixWorld(true)
  const skeleton = new Skeleton(bones)
  face.bind(skeleton); face.frustumCulled = false; face.castShadow = true; face.receiveShadow = true
  root.add(face)
  function projectedMesh(geometry: BufferGeometry, parent: Group | Bone, eyeIndex: number, lid?: 'upper' | 'lower') {
    geometries.push(geometry)
    const eye = eyes[eyeIndex]!
    const uv: number[] = []
    const position = geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      const p = new Vector3().fromBufferAttribute(position, i)
      if (lid) uv.push(0.5 + p.x / eye.rx * 0.22, 0.5 + p.y / eye.ry * 0.22)
      else uv.push(...uvAt(eye.x + p.x, eye.y + p.y))
    }
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    const value = new Mesh(geometry, lid ? lidSkin : eyeMaterial)
    value.castShadow = true; value.receiveShadow = true
    parent.add(value)
    return value
  }
  eyes.forEach((eye, index) => {
    const sphere = new SphereGeometry(1, 48, 32)
    sphere.scale(eye.rx, eye.ry, eye.rz)
    const globe = projectedMesh(sphere, root, index)
    globe.position.set(eye.x, eye.y, depthAt(eye.x, eye.y) - eye.rz * 0.3)
    globe.name = `face-reference-eye-${index}`
    for (const upper of [true, false]) {
      const cap = new SphereGeometry(1, 40, 24, 0, Math.PI * 2, upper ? 0 : Math.PI * 0.5, Math.PI * 0.5)
      cap.scale(eye.rx * 1.055, eye.ry * 1.055, eye.rz * 1.13)
      projectedMesh(cap, animatedNodes[5 + index * 2 + (upper ? 0 : 1)]!, index, upper ? 'upper' : 'lower')
    }
  })
  function updateMaterials(time: number) { eye.updateTime(time); surfaces.forEach(surface => surface.update(time)) }
  function update({ time, speaking, blink, brow = 0, squint = 0 }: FaceInput) {
    updateMaterials(time)
    const voice = Math.max(0, Math.min(1, speaking))
    const close = Math.max(0, Math.min(1, blink))
    animatedNodes.forEach((bone, index) => { bone.position.copy(anchors[index]!); bone.rotation.set(0, 0, 0); bone.scale.set(1, 1, 1) })
    animatedNodes[0]!.position.y -= voice * 0.055
    animatedNodes[0]!.position.z += voice * 0.018
    animatedNodes[0]!.rotation.x = -voice * 0.16
    animatedNodes[1]!.position.x -= voice * 0.004
    animatedNodes[2]!.position.x += voice * 0.006
    for (let index = 0; index < eyes.length; index++) {
      const closure = Math.min(1, close + squint * (index === 0 ? 0.18 : 0.63))
      animatedNodes[3 + index]!.position.y += brow * (index === 0 ? 0.018 : 0.027)
      animatedNodes[5 + index * 2]!.rotation.x = -0.96 * (1 - closure)
      animatedNodes[6 + index * 2]!.rotation.x = 0.96 * (1 - closure)
      const z = depthAt(eyes[index]!.x, eyes[index]!.y) - eyes[index]!.rz * 0.3
      for (const lid of [animatedNodes[5 + index * 2]!, animatedNodes[6 + index * 2]!]) {
        lid.position.z = z + eyes[index]!.rz * 0.42 * closure
        lid.scale.z = 1 - closure * 0.35
      }
    }
    root.updateMatrixWorld(true); skeleton.update()
  }
  update({ time: 0, speaking: 0, blink: 0 })
  return { root, animatedNodes, update, updateMaterials, dispose() { surfaces.forEach(surface => surface.dispose()); geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); eye.dispose(); heightTexture?.dispose(); sideTexture?.dispose(); skeleton.dispose() } }
}
