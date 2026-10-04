import {
  BufferGeometry, Color, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments,
  Mesh, MeshPhysicalMaterial, ShaderMaterial, SphereGeometry, TorusGeometry,
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
  float ripple = sin(length(p.xy - uPointer) * 12.0 - uTime * 3.0) * uPressure * 0.06;
  p += normal * (wrinkle + ripple + sin(uTime * 1.2 + uv.x * 6.283) * 0.014);
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
  vec3 n = normalize(mix(vNormal, deformed, 0.12));
  vec3 light = normalize(vec3(-0.7, 1.0, 1.7));
  vec3 viewDirection = normalize(-vPosition);
  float diffuse = max(dot(n, light), 0.0);
  float sheen = pow(max(dot(n, normalize(light + viewDirection)), 0.0), mix(18.0, 90.0, uWetness));
  float rim = pow(1.0 - max(dot(n, viewDirection), 0.0), 3.0);
  vec3 wet = vec3(0.8, 0.7, 0.45) * sheen * (0.15 + uWetness * 1.2);
  vec3 cold = vec3(0.025, 0.08, 0.085) * rim * (0.3 + uChitin);
  float depth = exp(-max(0.0, -vPosition.z - 4.0) * 0.16);
  gl_FragColor = vec4((skin * (0.25 + diffuse * 0.8) + wet + cold) * depth, 1.0);
  #include <colorspace_fragment>
}`

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
  const rings: TorusGeometry[] = []
  const folds: Mesh[] = []
  for (let index = 0; index < (presentation === 'lair' ? 6 : 3); index++) {
    const r = presentation === 'lair' ? radius + Math.sin(index * 2) * 0.09 : radius - index * 0.27
    const geometry = new TorusGeometry(r, presentation === 'lair' ? 0.18 : 0.23 - index * 0.035, 20, 80)
    const mesh = new Mesh(geometry, index % 3 === 2 ? chitin : flesh)
    mesh.position.z = -index * (presentation === 'lair' ? 1.1 : 0.28)
    mesh.rotation.z = index * 0.6
    mesh.scale.set(presentation === 'lair' ? 1.75 : 1, presentation === 'lair' ? 1.12 : 1, 1)
    rings.push(geometry)
    folds.push(mesh)
    root.add(mesh)
  }
  const plateGeometry = new SphereGeometry(0.18, 16, 12)
  const shutters: { pivot: Group, angle: number }[] = []
  for (let index = 0; index < 12; index++) {
    const angle = index / 12 * Math.PI * 2 + 0.1
    const pivot = new Group()
    pivot.position.set(Math.cos(angle) * radius * (presentation === 'lair' ? 1.75 : 1), Math.sin(angle) * radius * (presentation === 'lair' ? 1.12 : 1), 0.14)
    pivot.rotation.z = angle
    const plate = new Mesh(plateGeometry, chitin)
    plate.position.x = 0.08
    plate.scale.set(presentation === 'lair' ? 3 : 1.6, presentation === 'lair' ? 1.5 : 0.85, 0.8)
    pivot.add(plate)
    shutters.push({ pivot, angle })
    root.add(pivot)
  }
  const bristlePoints: number[] = []
  for (let index = 0; index < 64; index++) {
    const angle = index / 64 * Math.PI * 2
    const outer = radius + 0.25 + Math.sin(index * 17) * 0.025
    const length = 0.06 + (Math.sin(index * 13) + 1) * 0.04
    const x = presentation === 'lair' ? 1.75 : 1
    const y = presentation === 'lair' ? 1.12 : 1
    bristlePoints.push(Math.cos(angle) * outer * x, Math.sin(angle) * outer * y, 0.03,
      Math.cos(angle + 0.025) * (outer + length) * x, Math.sin(angle + 0.025) * (outer + length) * y, 0.07)
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
    const x = Math.cos(angle) * radius * (presentation === 'lair' ? 1.75 : 1)
    const y = Math.sin(angle) * radius * (presentation === 'lair' ? 1.12 : 1)
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
      folds.forEach((fold, index) => { fold.rotation.z = index * 0.6 + (input.transform === 'twist' ? input.pressure * index * 0.25 : 0) })
      shutters.forEach(({ pivot, angle }) => {
        pivot.position.x = Math.cos(angle) * radius * (presentation === 'lair' ? 1.75 : 1) * stretchX
        pivot.position.y = Math.sin(angle) * radius * (presentation === 'lair' ? 1.12 : 1) * stretchY
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
