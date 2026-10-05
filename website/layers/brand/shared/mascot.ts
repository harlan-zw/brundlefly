import {
  AnimationClip, Bone, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, MeshPhysicalMaterial, MeshStandardMaterial, NoColorSpace,
  QuaternionKeyframeTrack, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector2, Vector3, VectorKeyframeTrack,
} from 'three'
import type { Texture } from 'three'
import type { Transform } from './organism'
import { createFaceModel } from './face.ts'
import type { HeadProjection } from './face.ts'
import { applyMascotSurface } from './mascot-surface.ts'

type Raster = { width: number, height: number, data: Uint8ClampedArray }
export type BodyProjection = { texture: Texture, raster: Raster }
type Joint = { name: string, parent: string | null, start: [number, number], end: [number, number] }
const bodyJoints: Joint[] = [
  { name: 'pelvis', parent: null, start: [0.48, 0.57], end: [0.5, 0.44] },
  { name: 'chest', parent: 'pelvis', start: [0.5, 0.44], end: [0.54, 0.28] },
  { name: 'head', parent: 'chest', start: [0.57, 0.22], end: [0.61, 0.32] },
  { name: 'left-shoulder', parent: 'chest', start: [0.3, 0.23], end: [0.14, 0.4] },
  { name: 'left-elbow', parent: 'left-shoulder', start: [0.14, 0.4], end: [0.1, 0.51] },
  { name: 'left-hand', parent: 'left-elbow', start: [0.1, 0.51], end: [0.08, 0.63] },
  { name: 'right-shoulder', parent: 'chest', start: [0.73, 0.27], end: [0.85, 0.46] },
  { name: 'right-elbow', parent: 'right-shoulder', start: [0.85, 0.46], end: [0.9, 0.58] },
  { name: 'right-hand', parent: 'right-elbow', start: [0.9, 0.58], end: [0.91, 0.68] },
  { name: 'left-rib', parent: 'chest', start: [0.47, 0.34], end: [0.42, 0.43] },
  { name: 'left-small-elbow', parent: 'left-rib', start: [0.42, 0.43], end: [0.47, 0.49] },
  { name: 'left-small-hand', parent: 'left-small-elbow', start: [0.47, 0.49], end: [0.5, 0.55] },
  { name: 'right-rib', parent: 'chest', start: [0.58, 0.36], end: [0.68, 0.43] },
  { name: 'right-small-elbow', parent: 'right-rib', start: [0.68, 0.43], end: [0.72, 0.48] },
  { name: 'right-small-hand', parent: 'right-small-elbow', start: [0.72, 0.48], end: [0.7, 0.55] },
  { name: 'left-hip', parent: 'pelvis', start: [0.44, 0.55], end: [0.4, 0.68] },
  { name: 'left-knee', parent: 'left-hip', start: [0.4, 0.68], end: [0.25, 0.8] },
  { name: 'left-foot', parent: 'left-knee', start: [0.25, 0.8], end: [0.28, 0.92] },
  { name: 'right-hip', parent: 'pelvis', start: [0.57, 0.54], end: [0.66, 0.67] },
  { name: 'right-knee', parent: 'right-hip', start: [0.66, 0.67], end: [0.59, 0.86] },
  { name: 'right-foot', parent: 'right-knee', start: [0.59, 0.86], end: [0.7, 0.92] },
  { name: 'left-wing', parent: 'chest', start: [0.43, 0.19], end: [0.28, 0.075] },
  { name: 'right-wing', parent: 'chest', start: [0.75, 0.2], end: [0.86, 0.22] },
  { name: 'left-wing-tip', parent: 'left-wing', start: [0.35, 0.13], end: [0.23, 0.045] },
  { name: 'right-wing-tip', parent: 'right-wing', start: [0.83, 0.22], end: [0.94, 0.25] },
]
const joints = bodyJoints
const point = (x: number, y: number, z = 0) => new Vector3((x - 0.5) * 2.3, (0.5 - y) * 2.6, z)
function segmentDistance(x: number, y: number, joint: Joint) {
  const [a, b] = joint.start
  const dx = joint.end[0] - a
  const dy = joint.end[1] - b
  const t = Math.max(0, Math.min(1, ((x - a) * dx + (y - b) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - a - t * dx, y - b - t * dy)
}

/** A volumetric relief of the canonical artwork, with real skin weights and articulated joints. */
export function createMascotModel(texture: Texture, raster: Raster, faceTexture?: Texture, headProjection?: HeadProjection, bodyProjection?: BodyProjection) {
  const { width, height, data } = raster
  const count = width * height
  const mask = new Uint8Array(count)
  const distance = new Float32Array(count)
  const projectionSample = (x: number, y: number) => {
    const image = bodyProjection!.raster
    return (Math.round(y / (height - 1) * (image.height - 1)) * image.width
      + Math.round(x / (width - 1) * (image.width - 1))) * 4
  }
  for (let i = 0; i < count; i++) {
    // Mapped artwork supplies a real silhouette. Dark tissue stays solid.
    mask[i] = bodyProjection ? Number(bodyProjection.raster.data[projectionSample(i % width, Math.floor(i / width)) + 3]! > 32)
      : Number(data[i * 4 + 3]! > 32 && Math.max(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!) > 18)
  }
  if (!headProjection) for (let index = 0; index < count; index++) {
    if (data[index * 4 + 3]! <= 32) continue
    const x = index % width / (width - 1)
    const y = Math.floor(index / width) / (height - 1)
    // Canonical eye shadows are opaque artwork, even where their black edge touches the backdrop.
    const leftSocket = Math.pow((x - 0.632) / 0.045, 2) + Math.pow((y - 0.214) / 0.038, 2) <= 1
    const rightSocket = Math.pow((x - 0.758) / 0.041, 2) + Math.pow((y - 0.231) / 0.033, 2) <= 1
    if (leftSocket || rightSocket) mask[index] = 1
  }
  for (let i = 0; i < count; i++) distance[i] = mask[i] ? 100 : 0
  for (let y = 1; y < height; y++) for (let x = 1; x < width; x++) {
    const i = y * width + x
    distance[i] = Math.min(distance[i]!, distance[i - 1]! + 1, distance[i - width]! + 1)
  }
  for (let y = height - 2; y >= 0; y--) for (let x = width - 2; x >= 0; x--) {
    const i = y * width + x
    distance[i] = Math.min(distance[i]!, distance[i + 1]! + 1, distance[i + width]! + 1)
  }
  const bodyDepth = new Float32Array(count)
  if (bodyProjection) {
    const kernel = [1, 4, 6, 4, 1]
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const index = y * width + x
      if (!mask[index]) continue
      let depth = 0, total = 0
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const px = x + dx, py = y + dy
        if (px < 0 || px >= width || py < 0 || py >= height) continue
        const sample = py * width + px
        if (!mask[sample]) continue
        const weight = kernel[dx + 2]! * kernel[dy + 2]!
        depth += (0.006 + 0.17 * (1 - Math.exp(-distance[sample]! / 5))) * weight
        total += weight
      }
      bodyDepth[index] = depth / total
    }
  }
  const positions: number[] = []
  const uv: number[] = []
  const skinIndices: number[] = []
  const skinWeights: number[] = []
  const indices: number[] = []
  const wingIndices: number[] = []
  const isWing = (x: number, y: number) => (y < 0.205 && x < 0.48) || (x > 0.79 && y > 0.17 && y < 0.29)
  function projectedLuminance(x: number, y: number) {
    if (!bodyProjection) return undefined
    const image = bodyProjection.raster
    const index = (Math.min(image.height - 1, Math.round(y * (image.height - 1))) * image.width
      + Math.min(image.width - 1, Math.round(x * (image.width - 1)))) * 4
    return (image.data[index]! * 0.3 + image.data[index + 1]! * 0.59 + image.data[index + 2]! * 0.11) / 255
  }
  for (let side = 0; side < 2; side++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x
    const sx = x / (width - 1)
    const sy = y / (height - 1)
    const luminance = (data[i * 4]! * 0.3 + data[i * 4 + 1]! * 0.59 + data[i * 4 + 2]! * 0.11) / 255
    const detail = projectedLuminance(sx, sy) ?? luminance
    const wing = bodyProjection && isWing(sx, sy)
    const depth = mask[i] ? wing ? 0.006 + Math.min(distance[i]! * 0.0012, 0.014) + detail * 0.003
      : bodyProjection ? bodyDepth[i]! : 0.018 + Math.min(distance[i]! * 0.018, 0.16) + detail * 0.035 : 0
    positions.push(...point(sx, sy, side ? -depth * 0.8 : depth).toArray())
    uv.push(sx, 1 - sy)
    const closest = bodyJoints.map((joint, index) => ({ index, distance: segmentDistance(sx, sy, joint) }))
      .filter(value => bodyProjection || !bodyJoints[value.index]!.name.endsWith('-tip'))
      .filter(value => !wing || bodyJoints[value.index]!.name.includes('wing'))
      .sort((a, b) => a.distance - b.distance).slice(0, 2)
    const a = 1 / (Math.pow(closest[0]!.distance, 4) + 0.000002)
    const b = 1 / (Math.pow(closest[1]!.distance, 4) + 0.000002)
    skinIndices.push(closest[0]!.index, closest[1]!.index, 0, 0)
    skinWeights.push(a / (a + b), b / (a + b), 0, 0)
  }
  const occupied = new Uint8Array((width - 1) * (height - 1))
  for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
    const a = y * width + x
    const sx = (x + 0.5) / (width - 1)
    const sy = (y + 0.5) / (height - 1)
    // Replace the raster head with an actual sculpt. Keep shoulder arms and both wing silhouettes.
    const neckJoin = sx >= 0.54 && sx <= 0.62 && sy >= 0.07
    if (headProjection && !neckJoin && sy < 0.315 && Math.pow((sx - 0.67) / 0.146, 2) + Math.pow((sy - 0.218) / 0.19, 2) <= 1) continue
    // Include a cell only when all corners are tissue. Holes remain open, including fingers and wings.
    if (!(mask[a] && mask[a + 1] && mask[a + width] && mask[a + width + 1])) continue
    occupied[y * (width - 1) + x] = 1
    const triangles = bodyProjection && isWing(sx, sy) ? wingIndices : indices
    triangles.push(a, a + width, a + 1, a + 1, a + width, a + width + 1)
    const b = a + count
    triangles.push(b, b + 1, b + width, b + 1, b + width + 1, b + width)
  }
  const skinEnd = indices.length
  indices.push(...wingIndices)
  const wingEnd = indices.length
  const contourNeighbors = new Map<number, Set<number>>()
  for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
    if (!occupied[y * (width - 1) + x]) continue
    const a = y * width + x
    const boundaries = [
      { outside: y === 0 || !occupied[(y - 1) * (width - 1) + x], start: a, end: a + 1 },
      { outside: x === width - 2 || !occupied[y * (width - 1) + x + 1], start: a + 1, end: a + width + 1 },
      { outside: y === height - 2 || !occupied[(y + 1) * (width - 1) + x], start: a + width + 1, end: a + width },
      { outside: x === 0 || !occupied[y * (width - 1) + x - 1], start: a + width, end: a },
    ]
    for (const { outside, start, end } of boundaries) if (outside) {
      indices.push(start, end, start + count, end, end + count, start + count)
      if (!bodyProjection || isWing((x + 0.5) / (width - 1), (y + 0.5) / (height - 1))) continue
      if (!contourNeighbors.has(start)) contourNeighbors.set(start, new Set())
      if (!contourNeighbors.has(end)) contourNeighbors.set(end, new Set())
      contourNeighbors.get(start)!.add(end)
      contourNeighbors.get(end)!.add(start)
    }
  }
  // Relax only silhouette loops. Interior UV samples and all skin weights remain intact.
  for (let pass = 0; pass < 3 && bodyProjection; pass++) {
    const previous = positions.slice()
    for (const [vertex, neighbors] of contourNeighbors) {
      if (neighbors.size !== 2) continue
      for (const axis of [0, 1]) {
        let average = 0
        for (const neighbor of neighbors) average += previous[neighbor * 3 + axis]! / 2
        const value = previous[vertex * 3 + axis]! * 0.5 + average * 0.5
        positions[vertex * 3 + axis] = value
        positions[(vertex + count) * 3 + axis] = value
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4))
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4))
  geometry.setIndex(indices)
  geometry.addGroup(0, skinEnd, 0)
  geometry.addGroup(skinEnd, wingEnd - skinEnd, 2)
  geometry.addGroup(wingEnd, indices.length - wingEnd, 1)
  geometry.computeVertexNormals()
  const artwork = bodyProjection?.texture ?? texture
  const heightMap = bodyProjection?.texture.clone()
  if (heightMap) { heightMap.colorSpace = NoColorSpace; heightMap.needsUpdate = true }
  const front = new MeshPhysicalMaterial({ map: artwork, bumpMap: heightMap ?? null, bumpScale: 0.008,
    alphaTest: bodyProjection ? 0.18 : 0, roughness: bodyProjection ? 0.53 : 0.65, metalness: 0.02, clearcoat: bodyProjection ? 0.28 : 0 })
  // Frontal alpha cannot describe an extruded side. Keep those surfaces solid and softly lit.
  const sides = new MeshStandardMaterial({ color: bodyProjection ? '#80644E' : '#69404B', roughness: 0.65, metalness: 0.02 })
  const wingMaterial = new MeshPhysicalMaterial({ map: artwork, bumpMap: heightMap ?? null, bumpScale: 0.003,
    side: DoubleSide, alphaTest: 0.18, roughness: 0.38, metalness: 0, transmission: 0.22, thickness: 0.018,
    ior: 1.36, clearcoat: 0.45, clearcoatRoughness: 0.27, attenuationColor: '#a4b5a0', attenuationDistance: 0.28 })
  const bodySurfaces = bodyProjection ? [applyMascotSurface(front, 'skin'), applyMascotSurface(sides, 'skin'), applyMascotSurface(wingMaterial, 'wing')] : []
  const bones = joints.map(joint => { const bone = new Bone(); bone.name = joint.name; return bone })
  joints.forEach((joint, index) => {
    const bone = bones[index]!
    const parentIndex = joints.findIndex(value => value.name === joint.parent)
    const position = point(...joint.start)
    bone.position.copy(parentIndex < 0 ? position : position.sub(point(...joints[parentIndex]!.start)))
    if (parentIndex >= 0) bones[parentIndex]!.add(bone)
  })
  const mesh = new SkinnedMesh(geometry, [front, sides, wingMaterial])
  mesh.name = 'Brundlefly-canonical-relief'
  mesh.add(bones[0]!)
  mesh.updateMatrixWorld(true)
  const skeleton = new Skeleton(bones)
  mesh.bind(skeleton)
  mesh.frustumCulled = false // Animated wing and claw bounds exceed the static mesh bounds.
  const root = new Group()
  root.name = 'Brundlefly-rig'
  root.add(mesh)
  const joint = (name: string) => bones[joints.findIndex(value => value.name === name)]!
  const face = createFaceModel(faceTexture, headProjection)
  face.root.position.copy(point(0.643, 0.225, 0.015).sub(point(0.57, 0.22)))
  joint('head').add(face.root)
  root.updateMatrixWorld(true)
  skeleton.update()
  function updateMaterials(time: number) {
    bodySurfaces.forEach(surface => surface.update(time))
    face.updateMaterials(time)
  }
  function update(input: { time: number, pressure: number, pointer: Vector2, transform: Transform, walking?: boolean, walkPhase?: number, speaking?: number, blink?: number, brow?: number, squint?: number }) {
      const { time, pressure, pointer, transform, walking = false, walkPhase = time * 3.6 } = input
      const speaking = Math.min(1, Math.max(0, input.speaking ?? 0))
      const blinkPhase = ((time + 2.7) % 4.8 + 4.8) % 4.8
      const blink = Math.min(1, Math.max(0, input.blink ?? Math.max(0, 1 - Math.abs(blinkPhase - 4.5) / 0.12)))
      const pulse = Math.sin(time * 1.4)
      const stride = walking ? Math.sin(walkPhase) : 0
      const leftLift = walking ? Math.max(0, Math.cos(walkPhase)) : 0
      const rightLift = walking ? Math.max(0, -Math.cos(walkPhase)) : 0
      // Small rotations preserve the canonical relief while depth travel gives each foot a real stride.
      joint('pelvis').rotation.set(0, stride * 0.035, stride * 0.016)
      joint('chest').rotation.x = pulse * 0.025 + pressure * 0.035
      joint('chest').rotation.z = -stride * 0.025
      joint('head').rotation.set(-pointer.y * 0.08, pointer.x * 0.14, pulse * 0.015)
      joint('left-shoulder').rotation.z = -pressure * 0.09 + pulse * 0.02
      joint('right-shoulder').rotation.z = pressure * 0.09 - pulse * 0.02
      joint('left-shoulder').rotation.x = -stride * 0.15
      joint('right-shoulder').rotation.x = stride * 0.15
      joint('left-elbow').rotation.z = pressure * 0.1
      joint('right-elbow').rotation.z = -pressure * 0.1
      joint('left-elbow').rotation.x = leftLift * 0.045
      joint('right-elbow').rotation.x = rightLift * 0.045
      joint('left-rib').rotation.x = stride * 0.11
      joint('right-rib').rotation.x = -stride * 0.11
      joint('left-rib').rotation.z = stride * 0.028
      joint('right-rib').rotation.z = -stride * 0.028
      joint('left-small-elbow').rotation.z = -pressure * 0.13
      joint('right-small-elbow').rotation.z = pressure * 0.13
      joint('left-small-elbow').rotation.x = -stride * 0.075
      joint('right-small-elbow').rotation.x = stride * 0.075
      joint('left-hand').rotation.y = pressure * 0.18
      joint('right-hand').rotation.y = -pressure * 0.18
      const spread = transform === 'unfurl' ? pressure * 0.6 : pressure * 0.1
      joint('left-wing').rotation.y = -spread + Math.sin(time * 2.2) * 0.035 + stride * 0.035
      joint('right-wing').rotation.y = spread - Math.sin(time * 2.2 + 1) * 0.025 - stride * 0.018
      joint('left-wing').rotation.z = leftLift * 0.018
      joint('right-wing').rotation.z = -rightLift * 0.012
      joint('left-wing-tip').rotation.set(Math.sin(time * 3.1 + 0.7) * 0.032 + leftLift * 0.04, -spread * 0.38, 0)
      joint('right-wing-tip').rotation.set(Math.sin(time * 2.7 + 1.9) * 0.018 + rightLift * 0.022, spread * 0.26, 0)
      joint('left-hip').rotation.set(stride * 0.22, 0, stride * 0.045)
      joint('right-hip').rotation.set(-stride * 0.22, 0, -stride * 0.045)
      joint('left-knee').rotation.set(pulse * 0.018 - leftLift * 0.18, 0, leftLift * 0.055)
      joint('right-knee').rotation.set(-pulse * 0.015 - rightLift * 0.18, 0, -rightLift * 0.055)
      joint('left-foot').rotation.set(leftLift * 0.11 - stride * 0.06, 0, -leftLift * 0.04)
      joint('right-foot').rotation.set(rightLift * 0.11 + stride * 0.06, 0, rightLift * 0.04)
      root.rotation.y = pointer.x * 0.16 + (transform === 'twist' ? pressure * 0.22 : 0)
      root.position.y = pulse * 0.012 + (walking ? Math.abs(Math.sin(walkPhase)) * 0.035 : 0)
      root.scale.y = transform === 'squeeze' ? 1 - pressure * 0.04 : 1
      face.update({ time, speaking, blink, brow: input.brow, squint: input.squint })
      updateMaterials(time)
      root.updateMatrixWorld(true)
      skeleton.update()
    }
  function bakeAnimation(name: string, duration: number, pose: (time: number) => Parameters<typeof update>[0]) {
    const times = Array.from({ length: 97 }, (_, i) => i / 96 * duration)
    const nodes = [...bones, ...face.animatedNodes]
    const rotations = nodes.map(() => [] as number[])
    const positions = nodes.map(() => [] as number[])
    const scales = nodes.map(() => [] as number[])
    const rootPositions: number[] = []
    const rootRotations: number[] = []
    times.forEach((time, sample) => {
      update(pose(sample === 96 ? 0 : time))
      nodes.forEach((bone, index) => {
        rotations[index]!.push(...bone.quaternion.toArray())
        positions[index]!.push(...bone.position.toArray())
        scales[index]!.push(...bone.scale.toArray())
      })
      rootPositions.push(...root.position.toArray())
      rootRotations.push(...root.quaternion.toArray())
    })
    return new AnimationClip(name, duration, [
      ...nodes.flatMap((bone, index) => [
        new QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, rotations[index]!),
        new VectorKeyframeTrack(`${bone.name}.position`, times, positions[index]!),
        new VectorKeyframeTrack(`${bone.name}.scale`, times, scales[index]!),
      ]),
      new VectorKeyframeTrack(`${root.name}.position`, times, rootPositions),
      new QuaternionKeyframeTrack(`${root.name}.quaternion`, times, rootRotations),
    ])
  }
  return {
    root, mesh, skeleton, update,
    updateMaterials,
    idleAnimation() {
      return bakeAnimation('Brundlefly-idle', 4.8, time => ({ time, pressure: 0, pointer: new Vector2(), transform: 'squeeze' }))
    },
    walkAnimation() {
      const duration = 1.75
      return bakeAnimation('Brundlefly-walk', duration, time => ({
        time: 0, pressure: 0, pointer: new Vector2(), transform: 'squeeze', walking: true,
        walkPhase: time / duration * Math.PI * 2,
      }))
    },
    speakingAnimation() {
      return bakeAnimation('Brundlefly-speaking', 3.2, time => ({
        time: 0, pressure: 0, pointer: new Vector2(), transform: 'squeeze',
        speaking: Math.pow(Math.sin(time * Math.PI * 5 / 3.2), 2) * (0.6 + Math.sin(time * 9) * 0.22),
        blink: Math.max(0, 1 - Math.abs(time - 2.45) / 0.12),
      }))
    },
    dispose() { bodySurfaces.forEach(surface => surface.dispose()); face.dispose(); geometry.dispose(); front.dispose(); sides.dispose(); wingMaterial.dispose(); heightMap?.dispose(); skeleton.dispose() },
  }
}
