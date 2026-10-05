import {
  AnimationClip, Bone, BufferGeometry, Float32BufferAttribute, Group, MeshStandardMaterial,
  QuaternionKeyframeTrack, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector2, Vector3, VectorKeyframeTrack,
} from 'three'
import type { Texture } from 'three'
import type { Transform } from './organism'

type Raster = { width: number, height: number, data: Uint8ClampedArray }
type Joint = { name: string, parent: string | null, start: [number, number], end: [number, number] }
const joints: Joint[] = [
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
]
const point = (x: number, y: number, z = 0) => new Vector3((x - 0.5) * 2.3, (0.5 - y) * 2.6, z)
function segmentDistance(x: number, y: number, joint: Joint) {
  const [a, b] = joint.start
  const dx = joint.end[0] - a
  const dy = joint.end[1] - b
  const t = Math.max(0, Math.min(1, ((x - a) * dx + (y - b) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - a - t * dx, y - b - t * dy)
}

/** A volumetric relief of the canonical artwork, with real skin weights and articulated joints. */
export function createMascotModel(texture: Texture, raster: Raster) {
  const { width, height, data } = raster
  const count = width * height
  const mask = new Uint8Array(count)
  const distance = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    // The supplied artwork has a black background. Infer mesh occupancy, without changing its pixels.
    mask[i] = data[i * 4 + 3]! > 32 && Math.max(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!) > 18 ? 1 : 0
  }
  // Facial shadow uses the same black as the backdrop. Keep its opaque pixels as actual skin.
  // Restrict repair to the canonical head, so finger spaces and perforated wings remain open.
  const insideHead = (index: number) => {
    const x = index % width / (width - 1)
    const y = Math.floor(index / width) / (height - 1)
    return x >= 0.48 && x <= 0.81 && y >= 0.15 && y <= 0.37
  }
  // The outer socket rims are opaque black artwork connected directly to the backdrop.
  // Protect their canonical footprints before extracting holes. Pixel colors remain unchanged.
  for (let index = 0; index < count; index++) {
    if (data[index * 4 + 3]! <= 32) continue
    const x = index % width / (width - 1)
    const y = Math.floor(index / width) / (height - 1)
    const leftSocket = Math.pow((x - 0.632) / 0.045, 2) + Math.pow((y - 0.214) / 0.038, 2) <= 1
    const rightSocket = Math.pow((x - 0.758) / 0.041, 2) + Math.pow((y - 0.231) / 0.033, 2) <= 1
    if (leftSocket || rightSocket) mask[index] = 1
  }
  const visited = new Uint8Array(count)
  const maximumSocket = Math.max(4, Math.ceil(count * 0.004))
  for (let start = 0; start < count; start++) {
    if (mask[start] || visited[start]) continue
    const region = [start]
    visited[start] = 1
    let enclosedFaceShadow = true
    for (let cursor = 0; cursor < region.length; cursor++) {
      const index = region[cursor]!
      const x = index % width
      const y = Math.floor(index / width)
      if (!insideHead(index) || data[index * 4 + 3]! <= 32 || x === 0 || y === 0 || x === width - 1 || y === height - 1) enclosedFaceShadow = false
      const neighbors = [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1, y < height - 1 ? index + width : -1]
      for (const neighbor of neighbors) if (neighbor >= 0 && !mask[neighbor] && !visited[neighbor]) {
        visited[neighbor] = 1
        region.push(neighbor)
      }
    }
    if (enclosedFaceShadow && region.length <= maximumSocket) for (const index of region) mask[index] = 1
  }
  // A thin dark crease can connect a socket to the backdrop. Three nearby tissue directions
  // identify its interior without growing the outer silhouette or filling explicit alpha holes.
  const faceMask = mask.slice()
  const reach = Math.max(2, Math.ceil(Math.min(width, height) * 0.075))
  for (let index = 0; index < count; index++) {
    if (mask[index] || !insideHead(index) || data[index * 4 + 3]! <= 32) continue
    const x = index % width
    const y = Math.floor(index / width)
    let surroundingTissue = 0
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      for (let step = 1; step <= reach; step++) {
        const nx = x + dx * step
        const ny = y + dy * step
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) break
        const neighbor = ny * width + nx
        if (data[neighbor * 4 + 3]! <= 32) break
        if (faceMask[neighbor]) { surroundingTissue++; break }
      }
    }
    if (surroundingTissue >= 3) mask[index] = 1
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
  const positions: number[] = []
  const uv: number[] = []
  const skinIndices: number[] = []
  const skinWeights: number[] = []
  const indices: number[] = []
  for (let side = 0; side < 2; side++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x
    const sx = x / (width - 1)
    const sy = y / (height - 1)
    const luminance = (data[i * 4]! * 0.3 + data[i * 4 + 1]! * 0.59 + data[i * 4 + 2]! * 0.11) / 255
    const depth = mask[i] ? 0.018 + Math.min(distance[i]! * 0.018, 0.16) + luminance * 0.035 : 0
    positions.push(...point(sx, sy, side ? -depth * 0.8 : depth).toArray())
    uv.push(sx, 1 - sy)
    const closest = joints.map((joint, index) => ({ index, distance: segmentDistance(sx, sy, joint) })).sort((a, b) => a.distance - b.distance).slice(0, 2)
    const a = 1 / (Math.pow(closest[0]!.distance, 4) + 0.000002)
    const b = 1 / (Math.pow(closest[1]!.distance, 4) + 0.000002)
    skinIndices.push(closest[0]!.index, closest[1]!.index, 0, 0)
    skinWeights.push(a / (a + b), b / (a + b), 0, 0)
  }
  const occupied = new Uint8Array((width - 1) * (height - 1))
  for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
    const a = y * width + x
    // Include a cell only when all corners are tissue. Holes remain open, including fingers and wings.
    if (!(mask[a] && mask[a + 1] && mask[a + width] && mask[a + width + 1])) continue
    occupied[y * (width - 1) + x] = 1
    indices.push(a, a + width, a + 1, a + 1, a + width, a + width + 1)
    const b = a + count
    indices.push(b, b + 1, b + width, b + 1, b + width + 1, b + width)
  }
  const skinEnd = indices.length
  for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
    if (!occupied[y * (width - 1) + x]) continue
    const a = y * width + x
    const boundaries = [
      { outside: y === 0 || !occupied[(y - 1) * (width - 1) + x], start: a, end: a + 1 },
      { outside: x === width - 2 || !occupied[y * (width - 1) + x + 1], start: a + 1, end: a + width + 1 },
      { outside: y === height - 2 || !occupied[(y + 1) * (width - 1) + x], start: a + width + 1, end: a + width },
      { outside: x === 0 || !occupied[y * (width - 1) + x - 1], start: a + width, end: a },
    ]
    for (const { outside, start, end } of boundaries) if (outside) indices.push(start, end, start + count, end, end + count, start + count)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4))
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4))
  geometry.setIndex(indices)
  geometry.addGroup(0, skinEnd, 0)
  geometry.addGroup(skinEnd, indices.length - skinEnd, 1)
  geometry.computeVertexNormals()
  const front = new MeshStandardMaterial({ map: texture, roughness: 0.65, metalness: 0.02 })
  const sides = new MeshStandardMaterial({ color: '#69404B', roughness: 0.4, metalness: 0.1 })
  const bones = joints.map(joint => { const bone = new Bone(); bone.name = joint.name; return bone })
  joints.forEach((joint, index) => {
    const bone = bones[index]!
    const parentIndex = joints.findIndex(value => value.name === joint.parent)
    const position = point(...joint.start)
    bone.position.copy(parentIndex < 0 ? position : position.sub(point(...joints[parentIndex]!.start)))
    if (parentIndex >= 0) bones[parentIndex]!.add(bone)
  })
  const mesh = new SkinnedMesh(geometry, [front, sides])
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
  function update(input: { time: number, pressure: number, pointer: Vector2, transform: Transform, walking?: boolean, walkPhase?: number }) {
      const { time, pressure, pointer, transform, walking = false, walkPhase = time * 3.6 } = input
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
      joint('left-hip').rotation.set(stride * 0.22, 0, stride * 0.045)
      joint('right-hip').rotation.set(-stride * 0.22, 0, -stride * 0.045)
      joint('left-knee').rotation.set(pulse * 0.018 - leftLift * 0.18, 0, leftLift * 0.055)
      joint('right-knee').rotation.set(-pulse * 0.015 - rightLift * 0.18, 0, -rightLift * 0.055)
      joint('left-foot').rotation.set(leftLift * 0.11 - stride * 0.06, 0, -leftLift * 0.04)
      joint('right-foot').rotation.set(rightLift * 0.11 + stride * 0.06, 0, rightLift * 0.04)
      root.rotation.y = pointer.x * 0.16 + (transform === 'twist' ? pressure * 0.22 : 0)
      root.position.y = pulse * 0.012 + (walking ? Math.abs(Math.sin(walkPhase)) * 0.035 : 0)
      root.scale.y = transform === 'squeeze' ? 1 - pressure * 0.04 : 1
      root.updateMatrixWorld(true)
      skeleton.update()
    }
  return {
    root, mesh, skeleton, update,
    idleAnimation() {
      const times = Array.from({ length: 49 }, (_, i) => i / 48 * 4.5)
      const values = bones.map(() => [] as number[])
      times.forEach((time, sample) => {
        update({ time: sample === 48 ? 0 : time, pressure: 0, pointer: new Vector2(), transform: 'squeeze' })
        bones.forEach((bone, index) => values[index]!.push(...bone.quaternion.toArray()))
      })
      return new AnimationClip('Brundlefly-idle', 4.5, bones.map((bone, index) =>
        new QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values[index]!)))
    },
    walkAnimation() {
      const duration = 1.75
      const times = Array.from({ length: 49 }, (_, i) => i / 48 * duration)
      const values = bones.map(() => [] as number[])
      const positions: number[] = []
      const rotations: number[] = []
      times.forEach((time, sample) => {
        const phase = sample === 48 ? 0 : time / duration * Math.PI * 2
        update({ time: 0, pressure: 0, pointer: new Vector2(), transform: 'squeeze', walking: true, walkPhase: phase })
        bones.forEach((bone, index) => values[index]!.push(...bone.quaternion.toArray()))
        positions.push(...root.position.toArray())
        rotations.push(...root.quaternion.toArray())
      })
      return new AnimationClip('Brundlefly-walk', duration, [
        ...bones.map((bone, index) => new QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values[index]!)),
        new VectorKeyframeTrack(`${root.name}.position`, times, positions),
        new QuaternionKeyframeTrack(`${root.name}.quaternion`, times, rotations),
      ])
    },
    dispose() { geometry.dispose(); front.dispose(); sides.dispose(); skeleton.dispose() },
  }
}
