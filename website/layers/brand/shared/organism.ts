import {
  BufferGeometry, CatmullRomCurve3, Color, DoubleSide, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments,
  Mesh, MeshBasicMaterial, MeshPhysicalMaterial, Raycaster, ShaderMaterial, SphereGeometry, TubeGeometry, Vector2, Vector3,
} from 'three'
import type { Texture } from 'three'
import { createDripMaterial, createGooDrips } from './goo-drip.ts'
import type { DripAttachment } from './goo-drip.ts'

export const transforms = ['squeeze', 'twist', 'unfurl'] as const
export type Transform = typeof transforms[number]
export type Presentation = 'specimen' | 'lair'
export type OrganismInput = { time: number, pressure: number, wetness: number, pointer: Vector2, opening: number, transform: Transform, flow?: number }

// Local-space movement stays independent of the world renderer's chamber scale.
const lairMotionShader = `
vec3 flexLair(vec3 p, float time) {
  float depth = max(0.0, -p.z);
  float angle = atan(p.y, p.x);
  float phase = time * 0.95 - depth * 1.3;
  float wave = pow(max(0.0, sin(phase)), 2.0) * 0.065;
  float breath = sin(time * 0.64) * 0.025;
  float lip = exp(-depth * 0.85);
  float uneven = (sin(angle * 3.0 + time * 0.82) * 0.028
    + cos(angle * 5.0 - time * 0.5) * 0.018) * lip;
  p.x *= 1.0 + breath - wave + uneven;
  p.y *= 1.0 + breath * 0.9 - wave * 0.8 - uneven * 0.45;
  p.z += sin(phase + 0.7) * 0.11 * (1.0 - exp(-depth * 0.3))
    + sin(angle * 2.0 + time * 0.8) * 0.09 * lip;
  return p;
}
`

/** CPU counterpart anchors lip plates to the same asymmetric shader movement. */
function flexLair(point: Vector3, time: number) {
  const depth = Math.max(0, -point.z)
  const angle = Math.atan2(point.y, point.x)
  const phase = time * 0.95 - depth * 1.3
  const wave = Math.max(0, Math.sin(phase)) ** 2 * 0.065
  const breath = Math.sin(time * 0.64) * 0.025
  const lip = Math.exp(-depth * 0.85)
  const uneven = (Math.sin(angle * 3 + time * 0.82) * 0.028 + Math.cos(angle * 5 - time * 0.5) * 0.018) * lip
  point.x *= 1 + breath - wave + uneven
  point.y *= 1 + breath * 0.9 - wave * 0.8 - uneven * 0.45
  point.z += Math.sin(phase + 0.7) * 0.11 * (1 - Math.exp(-depth * 0.3))
    + Math.sin(angle * 2 + time * 0.8) * 0.09 * lip
  return point
}

type TissueUniforms = { time: number, pressure: number, opening: number, twist: number, pointer: { x: number, y: number }, lair: boolean }

/** CPU counterpart of the tissue vertex shader, so slime stays on the displaced surface it hangs from. */
function tissueSurface(rest: Vector3, normal: Vector3, uv: { x: number, y: number }, uniforms: TissueUniforms, target: Vector3) {
  const { time, pressure, opening, twist, pointer } = uniforms
  const angle = Math.atan2(rest.y, rest.x)
  const lobe = 1 + Math.sin(angle * 3 + 0.4) * 0.065 + Math.cos(angle * 7) * 0.025
  target.set(rest.x * lobe, rest.y * lobe, rest.z)
  const wrinkle = Math.sin(uv.x * 75.398 + Math.sin(uv.y * 12.566)) * 0.035
  const contraction = Math.sin(angle * 2 - time * 0.7 + target.z * 0.9) * 0.035
  const ripple = Math.sin(Math.hypot(target.x - pointer.x, target.y - pointer.y) * 12 - time * 3) * pressure * 0.06
  target.addScaledVector(normal, wrinkle + ripple + contraction)
  const torsion = twist * (1.8 - Math.min(Math.hypot(target.x, target.y), 1.8)) + target.z * twist * 0.3
  const [x, y] = [target.x, target.y]
  target.x = Math.cos(torsion) * x + Math.sin(torsion) * y
  target.y = -Math.sin(torsion) * x + Math.cos(torsion) * y
  target.x *= (0.8 + opening * 0.4) * (1 + pressure * 0.2)
  target.y *= (0.8 + opening * 0.4) * (1 - pressure * 0.3)
  target.z -= Math.exp(-Math.hypot(target.x - pointer.x * 0.9, target.y - pointer.y * 0.9) * 1.4) * pressure * 0.48
  return uniforms.lair ? flexLair(target, time) : target
}

export const vertexShader = `
uniform float uTime;
uniform float uLair;
uniform float uPressure;
uniform float uOpening;
uniform float uTwist;
uniform vec2 uPointer;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
${lairMotionShader}
void main() {
  vUv = uv;
  vec3 p = position;
  float angle = atan(p.y, p.x);
  p.xy *= 1.0 + sin(angle * 3.0 + 0.4) * 0.065 + cos(angle * 7.0) * 0.025;
  float wrinkle = sin(uv.x * 75.398 + sin(uv.y * 12.566)) * 0.035;
  float contraction = sin(angle * 2.0 - uTime * 0.7 + p.z * 0.9) * 0.035;
  float ripple = sin(length(p.xy - uPointer) * 12.0 - uTime * 3.0) * uPressure * 0.06;
  p += normal * (wrinkle + ripple + contraction);
  float radius = length(p.xy);
  float torsion = uTwist * (1.8 - min(radius, 1.8)) + p.z * uTwist * 0.3;
  mat2 rotation = mat2(cos(torsion), -sin(torsion), sin(torsion), cos(torsion));
  p.xy = rotation * p.xy;
  p.xy *= 0.8 + uOpening * 0.4;
  float localPress = exp(-length(p.xy - uPointer * 0.9) * 1.4);
  p.y *= 1.0 - uPressure * 0.3;
  p.x *= 1.0 + uPressure * 0.2;
  p.z -= localPress * uPressure * 0.48;
  if (uLair > 0.5) p = flexLair(p, uTime);
  vPosition = (modelViewMatrix * vec4(p, 1.0)).xyz;
  vNormal = normalize(normalMatrix * vec3(rotation * normal.xy, normal.z));
  gl_Position = projectionMatrix * vec4(vPosition, 1.0);
}`
export const fragmentShader = `
uniform sampler2D uTexture;
uniform float uWetness;
uniform float uChitin;
uniform float uBrightness;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
void main() {
  vec3 grain = texture2D(uTexture, vUv * vec2(3.0, 1.0)).rgb;
  vec3 skin = mix(grain, vec3(0.034, 0.045, 0.043), uChitin * 0.94);
  vec3 deformed = normalize(cross(dFdx(vPosition), dFdy(vPosition))) * (gl_FrontFacing ? 1.0 : -1.0);
  float pore = dot(grain, vec3(0.299, 0.587, 0.114));
  vec3 n = normalize(mix(vNormal, deformed, 0.18) + vec3(dFdx(pore), dFdy(pore), 0.0) * 1.6);
  vec3 light = normalize(vec3(-0.7, 1.0, 1.7));
  vec3 viewDirection = normalize(-vPosition);
  float diffuse = max(dot(n, light), 0.0);
  float sheen = pow(max(dot(n, normalize(light + viewDirection)), 0.0), mix(18.0, 90.0, uWetness));
  float rim = pow(1.0 - max(dot(n, viewDirection), 0.0), 3.0);
  vec3 wet = vec3(0.8, 0.7, 0.45) * sheen * (0.12 + uWetness * 0.75) * (1.0 - uChitin * 0.45);
  vec3 cold = vec3(0.025, 0.08, 0.085) * rim * (0.3 + uChitin);
  float depth = exp(-max(0.0, -vPosition.z - 4.0) * 0.16);
  gl_FragColor = vec4((skin * (0.25 + diffuse * 0.8) + wet + cold) * depth * uBrightness, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

/** Uneven muscle folds, with the same topology at each depth for membrane attachment. */
function tissuePoint(angle: number, radius: number, depth: number, lair: boolean) {
  const lobe = 1 + Math.sin(angle * 3 + depth * 0.53) * 0.12 + Math.cos(angle * 5 - depth * 0.7) * 0.06
  return new Vector3(Math.cos(angle) * radius * lobe * (lair ? 1.7 : 1),
    Math.sin(angle) * radius * lobe * (lair ? 1.16 : 1), -depth + Math.sin(angle * 4 + depth) * 0.12)
}

function tissueFold(radius: number, thickness: number, depth: number, lair: boolean) {
  const positions: number[] = []
  const uv: number[] = []
  const indices: number[] = []
  const around = 96
  const across = 20
  for (let u = 0; u <= around; u++) {
    const angle = u / around * Math.PI * 2
    const center = tissuePoint(angle, radius, depth, lair)
    const swelling = thickness * (1 + Math.sin(angle * 3.0 + depth) * 0.4 + Math.cos(angle * 7 - depth) * 0.15)
    for (let v = 0; v <= across; v++) {
      const section = v / across * Math.PI * 2
      const crease = 1 + Math.sin(section * 3 + angle * 9) * 0.08
      const radial = Math.cos(section) * swelling * crease
      positions.push(center.x + Math.cos(angle) * radial * (lair ? 1.7 : 1),
        center.y + Math.sin(angle) * radial * (lair ? 1.16 : 1), center.z + Math.sin(section) * swelling * 0.85)
      uv.push(u / around, v / across)
      if (u < around && v < across) {
        const a = u * (across + 1) + v
        const b = a + across + 1
        indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Shared material geometry. The lair is an environment, never mascot anatomy. */
export function createOrganismModel(texture: Texture, presentation: Presentation = 'specimen', brightness = 1) {
  const root = new Group()
  const uniforms = {
    uTexture: { value: texture }, uTime: { value: 0 }, uLair: { value: presentation === 'lair' ? 1 : 0 }, uPressure: { value: 0 },
    uWetness: { value: 0.75 }, uPointer: { value: { x: 0, y: 0 } },
    uOpening: { value: 0.5 }, uTwist: { value: 0 },
    uBrightness: { value: brightness },
  }
  const flesh = new ShaderMaterial({ uniforms: { ...uniforms, uChitin: { value: 0 } }, vertexShader, fragmentShader })
  const chitin = new ShaderMaterial({ uniforms: { ...uniforms, uChitin: { value: 1 } }, vertexShader, fragmentShader })
  const radius = presentation === 'lair' ? 2 : 1.04
  const lairRadius = (layer: number) => radius - layer * 0.18 + Math.sin(layer * 2) * 0.035
  const rings: BufferGeometry[] = []
  const folds: Mesh[] = []
  for (let index = 0; index < (presentation === 'lair' ? 6 : 3); index++) {
    const r = presentation === 'lair' ? lairRadius(index) : radius - index * 0.27
    const geometry = tissueFold(r, presentation === 'lair' ? 0.24 : 0.23 - index * 0.035,
      index * (presentation === 'lair' ? 0.95 : 0.28), presentation === 'lair')
    const mesh = new Mesh(geometry, flesh)
    rings.push(geometry)
    folds.push(mesh)
    root.add(mesh)
  }
  // Thin elastic webs connect layers. Their openings leave a clear central working area.
  const connective = new Group()
  const membraneMaterial = new MeshPhysicalMaterial({ color: '#777648', map: texture, transparent: true,
    opacity: 0.23, side: DoubleSide, roughness: 0.32, clearcoat: 1, depthWrite: false })
  const tendonMaterial = new MeshPhysicalMaterial({ color: '#AA604B', map: texture, roughness: 0.25, clearcoat: 1 })
  if (presentation === 'lair') {
    // Tendons and webs flex at their own depth, alongside all six rings.
    for (const material of [membraneMaterial, tendonMaterial]) {
      material.onBeforeCompile = shader => {
        shader.uniforms.uTime = uniforms.uTime
        shader.vertexShader = 'uniform float uTime;\n' + lairMotionShader + shader.vertexShader
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\ntransformed = flexLair(transformed, uTime);')
      }
      material.customProgramCacheKey = () => 'brundlefly-lair-connective-wave'
    }
  }
  const connections: BufferGeometry[] = []
  const layers = presentation === 'lair' ? 5 : 2
  for (let layer = 0; layer < layers; layer++) {
    const depth = layer * (presentation === 'lair' ? 0.95 : 0.28)
    for (let index = 0; index < 8; index++) {
      const angle = index / 8 * Math.PI * 2 + layer * 0.12
      const currentRadius = presentation === 'lair' ? lairRadius(layer) : radius
      const nextRadius = presentation === 'lair' ? lairRadius(layer + 1) : radius - 0.27
      const a = tissuePoint(angle, currentRadius, depth, presentation === 'lair')
      const b = tissuePoint(angle + 0.18, nextRadius, depth + (presentation === 'lair' ? 0.95 : 0.28), presentation === 'lair')
      const middle = a.clone().lerp(b, 0.5).multiplyScalar(0.95)
      const tube = new TubeGeometry(new CatmullRomCurve3([a, middle, b]), 10, 0.014 + index % 3 * 0.006, 6, false)
      connective.add(new Mesh(tube, tendonMaterial))
      connections.push(tube)
      const c = tissuePoint(angle + 0.3, currentRadius, depth, presentation === 'lair')
      const d = tissuePoint(angle + 0.5, nextRadius, depth + (presentation === 'lair' ? 0.95 : 0.28), presentation === 'lair')
      const web = new BufferGeometry()
      web.setAttribute('position', new Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray(), ...middle.toArray()], 3))
      web.setAttribute('uv', new Float32BufferAttribute([0, 0, 0, 1, 1, 0, 1, 1, 0.5, 0.5], 2))
      web.setIndex([0, 1, 4, 1, 3, 4, 3, 2, 4, 2, 0, 4])
      web.computeVertexNormals()
      connective.add(new Mesh(web, membraneMaterial))
      connections.push(web)
    }
  }
  root.add(connective)
  // An irregular dark end closes only the rear throat, so the room cannot show through the opening.
  const throatGeometry = presentation === 'lair' ? new SphereGeometry(1, 32, 22) : null
  const throatMaterial = presentation === 'lair'
    ? new MeshPhysicalMaterial({ color: '#080B08', map: texture, bumpMap: texture, bumpScale: 0.045,
      roughness: 0.7, clearcoat: 0.25, emissive: '#343C3B', emissiveIntensity: 0.025 })
    : null
  let throat: Mesh | null = null
  if (throatGeometry && throatMaterial) {
    const positions = throatGeometry.getAttribute('position')
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index)
      const y = positions.getY(index)
      const z = positions.getZ(index)
      const angle = Math.atan2(y, x)
      const lobe = 1 + Math.sin(angle * 3 + 1.7) * 0.07 + Math.cos(angle * 5) * 0.04
      positions.setXYZ(index, x * lobe, y * lobe, z + Math.sin(angle * 4 + y * 3) * 0.1)
    }
    throatGeometry.computeVertexNormals()
    throat = new Mesh(throatGeometry, throatMaterial)
    throat.name = 'Dark rear throat'
    throat.position.z = -5.65
    throat.scale.set(1.22 * 1.7, 1.22 * 1.16, 0.24)
    root.add(throat)
  }
  const plateGeometry = new SphereGeometry(0.18, 16, 12)
  const shutters: { pivot: Group, angle: number }[] = []
  for (let index = 0; index < 12; index++) {
    const angle = index / 12 * Math.PI * 2 + 0.1
    const pivot = new Group()
    pivot.position.copy(tissuePoint(angle, radius, 0, presentation === 'lair'))
    pivot.position.z += 0.14
    pivot.rotation.z = angle
    const plate = new Mesh(plateGeometry, chitin)
    plate.position.x = 0.08
    plate.scale.set(presentation === 'lair' ? 1.4 : 1.15, presentation === 'lair' ? 0.8 : 0.7, 0.7)
    pivot.add(plate)
    shutters.push({ pivot, angle })
    root.add(pivot)
  }
  const bristlePoints: number[] = []
  for (let index = 0; index < 64; index++) {
    const angle = index / 64 * Math.PI * 2
    const outer = radius + 0.25 + Math.sin(index * 17) * 0.025
    const length = 0.06 + (Math.sin(index * 13) + 1) * 0.04
    const start = tissuePoint(angle, outer, 0, presentation === 'lair')
    const end = tissuePoint(angle + 0.025, outer + length, 0, presentation === 'lair')
    bristlePoints.push(...start.toArray(), ...end.toArray())
  }
  const bristleGeometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(bristlePoints, 3))
  const bristleMaterial = new LineBasicMaterial({ color: new Color('#69404B') })
  if (presentation === 'lair') {
    bristleMaterial.onBeforeCompile = shader => {
      shader.uniforms.uTime = uniforms.uTime
      shader.vertexShader = 'uniform float uTime;\n' + lairMotionShader + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed = flexLair(transformed, uTime);')
    }
    bristleMaterial.customProgramCacheKey = () => 'brundlefly-lair-bristle-wave'
  }
  const bristles = new LineSegments(bristleGeometry, bristleMaterial)
  root.add(bristles)
  // Clustered drips of uneven weight along the upper arch. Short stubs bead, long threads carry heavy drops.
  // Steeper sides would hide a vertical thread inside the lip.
  const dripLayout = [
    { angle: 0.28, reach: 0.62, drop: 0.05, period: 9.4, phase: 0.08 },
    { angle: 0.3, reach: 0.26, drop: 0.032, period: 7.6, phase: 0.55 },
    { angle: 0.38, reach: 0.95, drop: 0.064, period: 11.8, phase: 0.31 },
    { angle: 0.44, reach: 0.44, drop: 0.042, period: 8.7, phase: 0.83 },
    { angle: 0.455, reach: 0.2, drop: 0.028, period: 7.2, phase: 0.2 },
    { angle: 0.52, reach: 1.15, drop: 0.07, period: 12.6, phase: 0.62 },
    { angle: 0.58, reach: 0.5, drop: 0.046, period: 9.9, phase: 0.44 },
    { angle: 0.6, reach: 0.3, drop: 0.034, period: 8.1, phase: 0.95 },
    { angle: 0.66, reach: 0.78, drop: 0.056, period: 10.7, phase: 0.17 },
    { angle: 0.72, reach: 0.36, drop: 0.038, period: 8.4, phase: 0.71 },
  ]
  const unit = radius / 2
  // Each thread leaves the underside of the front lip and lands on the lip below it.
  const lip = new Mesh(rings[0]!, new MeshBasicMaterial({ side: DoubleSide }))
  const caster = new Raycaster()
  const surfacePoint = (hit: ReturnType<Raycaster['intersectObject']>[number] | undefined, fallback: Vector3) =>
    ({ point: hit?.point ?? fallback, normal: hit?.face?.normal.clone() ?? new Vector3(), uv: hit?.uv?.clone() ?? new Vector2() })
  const dripRest = dripLayout.map(({ angle }) => {
    const anchor = tissuePoint(angle * Math.PI, radius, 0, presentation === 'lair')
    caster.set(anchor, new Vector3(0, -1, 0))
    const [exit, landing] = caster.intersectObject(lip)
    return { exit: surfacePoint(exit, anchor), landing: surfacePoint(landing, new Vector3(anchor.x, -radius * 1.32, anchor.z)) }
  })
  lip.material.dispose()
  const slimeMaterial = createDripMaterial()
  const slime = createGooDrips(slimeMaterial, dripLayout.map(({ reach, drop, period, phase }) => ({
    reach: reach * unit, drop: drop * unit * 1.3, thread: drop * unit * 0.15, bead: drop * unit * 0.7, period, phase })))
  const dripAttachments: DripAttachment[] = dripRest.map(() => ({ exit: new Vector3(), landing: 0 }))
  const landingPoint = new Vector3()
  root.add(slime.root)
  return {
    root,
    texture,
    update(input: OrganismInput) {
      if (throat) {
        const pulse = 1 + Math.sin(input.time * 0.95 - 5.65 * 1.3) * 0.018
        throat.scale.set(1.22 * 1.7 * pulse, 1.22 * 1.16 * pulse, 0.24)
        throat.position.z = -5.65 + Math.sin(input.time * 0.7) * 0.025
      }
      uniforms.uTime.value = input.time
      uniforms.uPressure.value = input.transform === 'squeeze' ? input.pressure : input.pressure * 0.12
      uniforms.uOpening.value = input.opening + (input.transform === 'unfurl' ? input.pressure * 0.5 : 0)
      uniforms.uTwist.value = input.transform === 'twist' ? input.pressure * 1.6 + input.pointer.x * 0.6 : input.pointer.x * 0.08
      uniforms.uWetness.value = input.wetness
      uniforms.uPointer.value = input.pointer
      const expansion = 0.8 + uniforms.uOpening.value * 0.4
      const stretchX = expansion * (1 + uniforms.uPressure.value * 0.2)
      const stretchY = expansion * (1 - uniforms.uPressure.value * 0.3)
      folds.forEach((fold, index) => { fold.rotation.z = input.transform === 'twist' ? input.pressure * index * 0.13 : 0 })
      connective.scale.set(stretchX, stretchY, 1)
      connective.rotation.z = input.transform === 'twist' ? input.pressure * 0.15 : 0
      membraneMaterial.opacity = 0.16 + input.wetness * 0.12
      shutters.forEach(({ pivot, angle }) => {
        const anchor = tissuePoint(angle, radius, 0, presentation === 'lair')
        pivot.position.x = anchor.x * stretchX
        pivot.position.y = anchor.y * stretchY
        if (presentation === 'lair') {
          anchor.set(pivot.position.x, pivot.position.y, anchor.z + 0.14)
          flexLair(anchor, input.time)
          pivot.position.copy(anchor)
        }
        pivot.rotation.y = -0.3 + input.opening * 1.2 + (input.transform === 'unfurl' ? input.pressure * 0.7 : 0)
        pivot.rotation.z = angle + (input.transform === 'twist' ? input.pressure * 0.25 : 0)
          + (presentation === 'lair' ? Math.sin(input.time * 0.82 + angle * 3) * 0.045 : 0)
      })
      // Drips follow the same lip movement as the tissue they leave.
      const surface = { time: input.time, pressure: uniforms.uPressure.value, opening: uniforms.uOpening.value,
        twist: uniforms.uTwist.value, pointer: input.pointer, lair: presentation === 'lair' }
      dripRest.forEach(({ exit, landing }, index) => {
        const attachment = dripAttachments[index]!
        tissueSurface(exit.point, exit.normal, exit.uv, surface, attachment.exit)
        attachment.landing = tissueSurface(landing.point, landing.normal, landing.uv, surface, landingPoint).y
      })
      slime.update({ time: input.time, flow: input.flow ?? 1, attachments: dripAttachments })
      bristles.scale.set(stretchX, stretchY, 1)
      root.rotation.y = input.pointer.x * (presentation === 'lair' ? 0.035 : 0.18)
      root.rotation.x = -input.pointer.y * (presentation === 'lair' ? 0.025 : 0.12)
      root.rotation.z = Math.sin(input.time * 0.3) * 0.015
    },
    dispose() {
      throatGeometry?.dispose()
      throatMaterial?.dispose()
      rings.forEach(geometry => geometry.dispose())
      connections.forEach(geometry => geometry.dispose())
      membraneMaterial.dispose()
      tendonMaterial.dispose()
      plateGeometry.dispose()
      bristleGeometry.dispose()
      slime.dispose()
      flesh.dispose()
      chitin.dispose()
      bristleMaterial.dispose()
      slimeMaterial.dispose()
    },
  }
}
