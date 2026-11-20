import { AdditiveBlending, Matrix4 } from 'three'
import type { ShaderMaterial } from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { createFloorGeometry, floorSurface } from './floor-surface.ts'

export type FloorReflection = {
  mesh: Reflector
  /** `wetness` is the scene's wetness setting, from 0 to 1. A dry floor shows nothing. */
  update: (wetness: number) => void
  dispose: () => void
}

// The picture of the room, mirrored in the floor, is added to the floor as light. It shows in the slime pools and at shallow angles,
// and it breaks up where the floor is rough. Light that is added needs no sorting against the marks painted on the floor.
const vertexShader = `
uniform mat4 textureMatrix;
varying vec4 vMirror;
varying vec3 vWorld;
void main() {
  vMirror = textureMatrix * vec4(position, 1.0);
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const fragmentShader = `
uniform sampler2D tDiffuse;
uniform float uWetness;
varying vec4 vMirror;
varying vec3 vWorld;
float hash(vec2 p) { p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 34.5); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 cell = floor(p), part = fract(p);
  part = part * part * (3.0 - 2.0 * part);
  return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), part.x), mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), part.x), part.y);
}
void main() {
  // Pools of slime are smooth and mirror the room. The skin between them only catches a faint sheen.
  float pool = smoothstep(0.42, 0.7, noise(vWorld.xz * 0.55) * 0.65 + noise(vWorld.xz * 1.7 + 4.0) * 0.35);
  vec2 ripple = (vec2(noise(vWorld.xz * 6.0), noise(vWorld.xz * 6.0 + 9.0)) - 0.5) * mix(0.05, 0.012, pool);
  vec3 mirrored = texture2DProj(tDiffuse, vMirror + vec4(ripple * vMirror.w, 0.0, 0.0)).rgb;
  // A floor shows more of the room at a shallow angle than straight down.
  vec3 toEye = normalize(cameraPosition - vWorld);
  float grazing = pow(1.0 - clamp(toEye.y, 0.0, 1.0), 3.0);
  float strength = uWetness * mix(0.3, 1.1, pool) * mix(0.6, 1.0, grazing);
  // The reflection thins toward the far end of the chamber, as the fog takes the floor.
  strength *= 1.0 - smoothstep(6.0, 16.0, distance(cameraPosition, vWorld));
  gl_FragColor = vec4(min(mirrored, vec3(2.0)) * strength, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

/**
 * The wet floor's reflection of the room: him, the egg sacs, and the tunnel. It draws the room a second time, at a part of its size,
 * so only the highest quality tier has it. The mirror lies on the floor's own triangles, a hair above them.
 */
export function createFloorReflection(width: number, height: number): FloorReflection {
  // The mirror plane is flat ground. The mesh stands at that level and faces up, so its geometry is the floor in the mesh's own frame.
  const frame = new Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, floorSurface.level, 0)
  const geometry = createFloorGeometry().applyMatrix4(frame.clone().invert()).translate(0, 0, 0.004)
  const mesh = new Reflector(geometry, { textureWidth: width, textureHeight: height, multisample: 0, clipBias: 0.003,
    shader: { name: 'FloorReflection', uniforms: { tDiffuse: { value: null }, textureMatrix: { value: null }, color: { value: null }, uWetness: { value: 0.6 } }, vertexShader, fragmentShader } })
  mesh.applyMatrix4(frame)
  const material = mesh.material as ShaderMaterial
  material.transparent = true
  material.blending = AdditiveBlending
  material.depthWrite = false
  material.polygonOffset = true
  material.polygonOffsetFactor = -1
  material.polygonOffsetUnits = -1
  return {
    mesh,
    update(wetness) { material.uniforms.uWetness!.value = wetness },
    dispose() { mesh.dispose(); geometry.dispose() },
  }
}
