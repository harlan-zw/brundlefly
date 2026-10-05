import {
  Bone, BufferGeometry, Float32BufferAttribute,
  Group, Mesh, MeshPhysicalMaterial, NoColorSpace, ShaderChunk, Skeleton, SkinnedMesh, SphereGeometry,
  Uint16BufferAttribute, Vector3,
} from 'three'
import type { Texture } from 'three'

export type FaceInput = { time: number, speaking: number, blink: number, brow?: number, squint?: number }
export type HeadProjection = { texture: Texture, raster: { width: number, height: number, data: Uint8ClampedArray } }

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
  const eyeMaterial = front.clone()
  eyeMaterial.roughness = 0.28
  eyeMaterial.clearcoat = 0.6
  eyeMaterial.clearcoatRoughness = 0.2
  const eyeTime = { value: 0 }
  eyeMaterial.onBeforeCompile = shader => {
    shader.uniforms.uEyeTime = eyeTime
    shader.vertexShader = `uniform float uEyeTime;
${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
transformed += normal * sin(position.x * 130.0 + position.y * 90.0 - uEyeTime * 1.7) * 0.00035;`)
    const gaze = '(vMapUv + vec2(sin(uEyeTime * 0.53 + sin(uEyeTime * 1.4)) * 0.00065, sin(uEyeTime * 0.37) * 0.00035))'
    shader.fragmentShader = `uniform float uEyeTime;
${shader.fragmentShader}`
      .replace('#include <map_fragment>', ShaderChunk.map_fragment.replaceAll('vMapUv', gaze))
      .replace('#include <opaque_fragment>', `outgoingLight += vec3(0.002, 0.012, 0.014) * pow(1.0 - max(dot(normal, geometryViewDir), 0.0), 4.0) * (0.5 + sin(uEyeTime * 0.41) * 0.2);
#include <opaque_fragment>`)
  }
  eyeMaterial.customProgramCacheKey = () => 'brundlefly-wet-eye-v1'
  const materials = [front, back, eyeMaterial]
  let minX = width - 1, maxX = 0, minY = height - 1, maxY = 0
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3]! > 24) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  const spanX = Math.max(1, maxX - minX)
  const spanY = Math.max(1, maxY - minY)
  const headWidth = 0.67
  const headHeight = 0.86
  const uvAt = (x: number, y: number) => [(minX + (x / headWidth + 0.5) * spanX) / (width - 1),
    1 - (minY + (0.5 - y / headHeight) * spanY) / (height - 1)] as const
  const localAt = (x: number, y: number) => new Vector3((x - minX) / spanX * headWidth - headWidth * 0.5,
    headHeight * 0.5 - (y - minY) / spanY * headHeight, 0)
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
  for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
    const a = y * width + x
    if (!(occupied[a] && occupied[a + 1] && occupied[a + width] && occupied[a + width + 1])) continue
    const center = localAt(x + 0.5, y + 0.5)
    if (eyes.some(eye => Math.pow((center.x - eye.x) / (eye.rx * 0.98), 2) + Math.pow((center.y - eye.y) / (eye.ry * 0.98), 2) < 1)) continue
    indices.push(a, a + width, a + 1, a + 1, a + width, a + width + 1)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4))
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4))
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometries.push(geometry)
  const face = new SkinnedMesh(geometry, front)
  face.name = 'face-reference-surface'
  face.add(fixed); face.updateMatrixWorld(true)
  const skeleton = new Skeleton(bones)
  face.bind(skeleton); face.frustumCulled = false; face.castShadow = true; face.receiveShadow = true
  root.add(face)
  const rearGeometry = new SphereGeometry(1, 48, 40)
  geometries.push(rearGeometry)
  const rear = new Mesh(rearGeometry, back)
  rear.scale.set(0.285, 0.365, 0.225); rear.position.z = -0.017; rear.castShadow = true; rear.receiveShadow = true; root.add(rear)
  function projectedMesh(geometry: BufferGeometry, parent: Group | Bone, eyeIndex: number, lid = false) {
    geometries.push(geometry)
    const eye = eyes[eyeIndex]!
    const uv: number[] = []
    const position = geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      const p = new Vector3().fromBufferAttribute(position, i)
      const sourceY = lid ? eye.y + Math.abs(p.y) + eye.ry * 0.5 : eye.y + p.y
      uv.push(...uvAt(eye.x + p.x, sourceY))
    }
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    const value = new Mesh(geometry, lid ? front : eyeMaterial)
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
      projectedMesh(cap, animatedNodes[5 + index * 2 + (upper ? 0 : 1)]!, index, true)
    }
  })
  function updateMaterials(time: number) { eyeTime.value = time }
  function update({ time, speaking, blink, brow = 0, squint = 0 }: FaceInput) {
    updateMaterials(time)
    const voice = Math.max(0, Math.min(1, speaking))
    const close = Math.max(0, Math.min(1, blink))
    animatedNodes.forEach((bone, index) => { bone.position.copy(anchors[index]!); bone.rotation.set(0, 0, 0) })
    animatedNodes[0]!.position.y -= voice * 0.055
    animatedNodes[0]!.position.z += voice * 0.018
    animatedNodes[0]!.rotation.x = -voice * 0.16
    animatedNodes[1]!.position.x -= voice * 0.004
    animatedNodes[2]!.position.x += voice * 0.006
    for (let index = 0; index < eyes.length; index++) {
      const closure = Math.min(1, close + squint * (index === 0 ? 0.18 : 0.63))
      animatedNodes[3 + index]!.position.y += brow * (index === 0 ? 0.018 : 0.027)
      animatedNodes[5 + index * 2]!.rotation.x = -0.96 + closure * 1.12
      animatedNodes[6 + index * 2]!.rotation.x = 0.96 - closure * 1.12
      const z = depthAt(eyes[index]!.x, eyes[index]!.y) - eyes[index]!.rz * 0.3
      animatedNodes[5 + index * 2]!.position.z = z
      animatedNodes[6 + index * 2]!.position.z = z
    }
    root.updateMatrixWorld(true); skeleton.update()
  }
  update({ time: 0, speaking: 0, blink: 0 })
  return { root, animatedNodes, update, updateMaterials, dispose() { geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); heightTexture?.dispose(); skeleton.dispose() } }
}
