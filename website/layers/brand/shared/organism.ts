import {
  BufferGeometry, Color, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments,
  Mesh, MeshPhysicalMaterial, ShaderMaterial, SphereGeometry, TorusGeometry,
} from 'three'
import type { Texture, Vector2 } from 'three'

export type OrganismInput = { time: number, pressure: number, wetness: number, pointer: Vector2 }

export const vertexShader = `
uniform float uTime;
uniform float uPressure;
uniform vec2 uPointer;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vUv = uv;
  vec3 p = position;
  float wrinkle = sin(uv.x * 75.398 + sin(uv.y * 12.566)) * 0.025;
  float uneven = sin(uv.x * 18.849) * 0.04 + cos(uv.x * 31.416) * 0.018;
  p += normal * (wrinkle + sin(uTime * 1.2 + uv.x * 6.283) * 0.012);
  p.xy *= 1.0 + uneven;
  float localPress = exp(-length(p.xy - uPointer * 0.9) * 1.4);
  p.y *= 1.0 - uPressure * 0.25;
  p.x *= 1.0 + uPressure * 0.18;
  p.z -= localPress * uPressure * 0.32;
  vPosition = (modelViewMatrix * vec4(p, 1.0)).xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * vec4(vPosition, 1.0);
}`
export const fragmentShader = `
uniform sampler2D uTexture;
uniform float uWetness;
uniform float uChitin;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vec3 grain = texture2D(uTexture, vUv * vec2(3.0, 1.0)).rgb;
  vec3 skin = mix(grain, vec3(0.034, 0.045, 0.043), uChitin * 0.88);
  vec3 n = normalize(vNormal + vec3(sin(vUv.x * 150.0) * 0.12, cos(vUv.y * 90.0) * 0.1, 0.0));
  vec3 light = normalize(vec3(-0.7, 1.0, 1.7));
  vec3 viewDirection = normalize(-vPosition);
  float diffuse = max(dot(n, light), 0.0);
  float sheen = pow(max(dot(n, normalize(light + viewDirection)), 0.0), mix(18.0, 90.0, uWetness));
  float rim = pow(1.0 - max(dot(n, viewDirection), 0.0), 3.0);
  vec3 wet = vec3(0.8, 0.7, 0.45) * sheen * (0.15 + uWetness * 1.2);
  vec3 cold = vec3(0.025, 0.08, 0.085) * rim * (0.3 + uChitin);
  gl_FragColor = vec4(skin * (0.3 + diffuse * 0.85) + wet + cold, 1.0);
  #include <colorspace_fragment>
}`

/** Material model, independent of Vue, the renderer, and lifecycle. No mascot anatomy. */
export function createOrganismModel(texture: Texture) {
  const root = new Group()
  const pointer = { value: { x: 0, y: 0 } }
  const uniforms = {
    uTexture: { value: texture }, uTime: { value: 0 }, uPressure: { value: 0 },
    uWetness: { value: 0.75 }, uPointer: pointer,
  }
  const flesh = new ShaderMaterial({ uniforms: { ...uniforms, uChitin: { value: 0 } }, vertexShader, fragmentShader })
  const chitin = new ShaderMaterial({ uniforms: { ...uniforms, uChitin: { value: 1 } }, vertexShader, fragmentShader })
  const rings = [new TorusGeometry(1.04, 0.23, 24, 96), new TorusGeometry(0.75, 0.18, 24, 96), new TorusGeometry(0.48, 0.14, 24, 96)]
  rings.forEach((geometry, index) => {
    const mesh = new Mesh(geometry, flesh)
    mesh.position.z = index * 0.035
    mesh.rotation.z = index * 0.6
    root.add(mesh)
  })
  const plateGeometry = new SphereGeometry(0.18, 20, 16)
  for (let index = 0; index < 9; index++) {
    const angle = index / 9 * Math.PI * 2 + 0.1
    const plate = new Mesh(plateGeometry, chitin)
    plate.position.set(Math.cos(angle) * 1.07, Math.sin(angle) * 1.07, 0.18)
    plate.scale.set(1.2, 0.8, 0.6)
    plate.rotation.z = angle
    root.add(plate)
  }
  const bristlePoints: number[] = []
  for (let index = 0; index < 48; index++) {
    const angle = index / 48 * Math.PI * 2
    const outer = 1.32 + Math.sin(index * 17) * 0.025
    const length = 0.06 + (Math.sin(index * 13) + 1) * 0.04
    bristlePoints.push(Math.cos(angle) * outer, Math.sin(angle) * outer, 0.03,
      Math.cos(angle + 0.025) * (outer + length), Math.sin(angle + 0.025) * (outer + length), 0.07)
  }
  const bristleGeometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(bristlePoints, 3))
  const bristleMaterial = new LineBasicMaterial({ color: new Color('#69404B') })
  root.add(new LineSegments(bristleGeometry, bristleMaterial))
  const slimeMaterial = new MeshPhysicalMaterial({ color: '#777648', roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.8 })
  const slimeGeometry = new SphereGeometry(1, 12, 10)
  const slime = new Group()
  for (let index = 0; index < 5; index++) {
    const x = (index - 2) * 0.37
    const y = -Math.sqrt(1.2 * 1.2 - x * x)
    const length = 0.16 + (Math.sin(index * 19) + 1) * 0.14
    const strand = new Mesh(slimeGeometry, slimeMaterial)
    strand.position.set(x, y - length / 2, 0.04)
    strand.scale.set(0.014, length, 0.014)
    const drop = new Mesh(slimeGeometry, slimeMaterial)
    drop.position.set(x, y - length, 0.04)
    drop.scale.set(0.045, 0.065, 0.045)
    slime.add(strand, drop)
  }
  root.add(slime)
  return {
    root,
    texture,
    update(input: OrganismInput) {
      uniforms.uTime.value = input.time
      uniforms.uPressure.value = input.pressure
      uniforms.uWetness.value = input.wetness
      uniforms.uPointer.value = input.pointer
      slime.scale.y = 1 + input.pressure * 0.18
      root.rotation.y = input.pointer.x * 0.12
      root.rotation.x = -input.pointer.y * 0.09
      root.rotation.z = Math.sin(input.time * 0.3) * 0.025
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
