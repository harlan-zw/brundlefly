import {
  BufferGeometry, CatmullRomCurve3, Color, DoubleSide, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments,
  Mesh, MeshPhysicalMaterial, ShaderMaterial, SphereGeometry, TubeGeometry, Vector3,
} from 'three'
import type { Texture, Vector2 } from 'three'

export const transforms = ['squeeze', 'twist', 'unfurl'] as const
export type Transform = typeof transforms[number]
export type Presentation = 'specimen' | 'lair'
export type OrganismInput = { time: number, pressure: number, wetness: number, pointer: Vector2, opening: number, transform: Transform }

export const vertexShader = `
uniform float uTime;
uniform float uPressure;
uniform float uOpening;
uniform float uTwist;
uniform vec2 uPointer;
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
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
  vPosition = (modelViewMatrix * vec4(p, 1.0)).xyz;
  vNormal = normalize(normalMatrix * vec3(rotation * normal.xy, normal.z));
  gl_Position = projectionMatrix * vec4(vPosition, 1.0);
}`
export const fragmentShader = `
uniform sampler2D uTexture;
uniform float uWetness;
uniform float uChitin;
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
  gl_FragColor = vec4((skin * (0.25 + diffuse * 0.8) + wet + cold) * depth, 1.0);
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
export function createOrganismModel(texture: Texture, presentation: Presentation = 'specimen') {
  const root = new Group()
  const uniforms = {
    uTexture: { value: texture }, uTime: { value: 0 }, uPressure: { value: 0 },
    uWetness: { value: 0.75 }, uPointer: { value: { x: 0, y: 0 } },
    uOpening: { value: 0.5 }, uTwist: { value: 0 },
  }
  const flesh = new ShaderMaterial({ uniforms: { ...uniforms, uChitin: { value: 0 } }, vertexShader, fragmentShader })
  const chitin = new ShaderMaterial({ uniforms: { ...uniforms, uChitin: { value: 1 } }, vertexShader, fragmentShader })
  const radius = presentation === 'lair' ? 2 : 1.04
  const rings: BufferGeometry[] = []
  const folds: Mesh[] = []
  for (let index = 0; index < (presentation === 'lair' ? 6 : 3); index++) {
    const r = presentation === 'lair' ? radius + Math.sin(index * 2) * 0.09 : radius - index * 0.27
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
  const connections: BufferGeometry[] = []
  const layers = presentation === 'lair' ? 5 : 2
  for (let layer = 0; layer < layers; layer++) {
    const depth = layer * (presentation === 'lair' ? 0.95 : 0.28)
    for (let index = 0; index < 8; index++) {
      const angle = index / 8 * Math.PI * 2 + layer * 0.12
      const a = tissuePoint(angle, radius, depth, presentation === 'lair')
      const b = tissuePoint(angle + 0.18, radius - (presentation === 'lair' ? 0 : 0.27), depth + (presentation === 'lair' ? 0.95 : 0.28), presentation === 'lair')
      const middle = a.clone().lerp(b, 0.5).multiplyScalar(0.95)
      const tube = new TubeGeometry(new CatmullRomCurve3([a, middle, b]), 10, 0.014 + index % 3 * 0.006, 6, false)
      connective.add(new Mesh(tube, tendonMaterial))
      connections.push(tube)
      const c = tissuePoint(angle + 0.3, radius, depth, presentation === 'lair')
      const d = tissuePoint(angle + 0.5, radius - (presentation === 'lair' ? 0 : 0.27), depth + (presentation === 'lair' ? 0.95 : 0.28), presentation === 'lair')
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
  const bristles = new LineSegments(bristleGeometry, bristleMaterial)
  root.add(bristles)
  const slimeMaterial = new MeshPhysicalMaterial({ color: '#777648', roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.8 })
  const slimeGeometry = new SphereGeometry(1, 12, 10)
  const slime = new Group()
  for (let index = 0; index < 9; index++) {
    const angle = Math.PI * (0.08 + index / 9 * 0.85)
    const anchor = tissuePoint(angle, radius, 0, presentation === 'lair')
    const { x, y } = anchor
    const length = 0.16 + (Math.sin(index * 19) + 1) * 0.2
    const strand = new Mesh(slimeGeometry, slimeMaterial)
    strand.position.set(x, y - length / 2, 0.04)
    strand.scale.set(0.012, length, 0.012)
    const drop = new Mesh(slimeGeometry, slimeMaterial)
    drop.position.set(x, y - length, 0.04)
    drop.scale.set(0.035, 0.055, 0.035)
    slime.add(strand, drop)
  }
  root.add(slime)
  return {
    root,
    texture,
    update(input: OrganismInput) {
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
        pivot.rotation.y = -0.3 + input.opening * 1.2 + (input.transform === 'unfurl' ? input.pressure * 0.7 : 0)
        pivot.rotation.z = angle + (input.transform === 'twist' ? input.pressure * 0.25 : 0)
      })
      slime.scale.set(stretchX, stretchY * (1 + input.pressure * 0.28), 1)
      bristles.scale.set(stretchX, stretchY, 1)
      root.rotation.y = input.pointer.x * (presentation === 'lair' ? 0.035 : 0.18)
      root.rotation.x = -input.pointer.y * (presentation === 'lair' ? 0.025 : 0.12)
      root.rotation.z = Math.sin(input.time * 0.3) * 0.015
      slimeMaterial.roughness = 0.5 - input.wetness * 0.4
    },
    dispose() {
      rings.forEach(geometry => geometry.dispose())
      connections.forEach(geometry => geometry.dispose())
      membraneMaterial.dispose()
      tendonMaterial.dispose()
      plateGeometry.dispose()
      bristleGeometry.dispose()
      slimeGeometry.dispose()
      flesh.dispose()
      chitin.dispose()
      bristleMaterial.dispose()
      slimeMaterial.dispose()
    },
  }
}
