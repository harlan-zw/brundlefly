import {
  AdditiveBlending, BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh,
  PlaneGeometry, Points, PointsMaterial, ShaderMaterial, Vector3,
} from 'three'
import type { Material } from 'three'
import { createFloorDecalGeometry, floorSurface } from './floor-surface'
import { createFloorGlowMaterial } from './floor-marks'
import { fogSurvival, fogUniforms } from './fog-fade'
import type { SceneQuality } from './scene-quality'
import { sporeCount, sporeField, sporeVolume } from './spore-field'

export type AirQuality = Pick<SceneQuality, 'spores' | 'haze'>

/** Where the one light shaft leaves the roof and where it meets the floor. It stays left of his walk and of the conversation camera. */
const shaft = { top: [-2.7, 5, 2.4], foot: [-1.75, floorSurface.level, 3.5], topRadius: 0.2, footRadius: 0.9 } as const

const cream = '#E8D4A6'
const olive = '#777648'

/** Slow motes. All motion comes from one time value, so a frozen time freezes them in place, already spread through the room. */
function createSpores(count: number, airTime: { value: number }) {
  const field = sporeField(count)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(field.homes, 3))
  geometry.setAttribute('spore', new Float32BufferAttribute(field.traits, 4))
  const pale = new Color(cream), slime = new Color(olive).lerp(pale, 0.35)
  const colors = new Float32Array(count * 3)
  for (let index = 0; index < count; index++) (field.tints[index] === 1 ? slime : pale).toArray(colors, index * 3)
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  // PointsMaterial brings the renderer's point scale and fog. A raw shader has no way to learn the drawing height here.
  const material = new PointsMaterial({ size: 0.07, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.8,
    blending: AdditiveBlending, depthWrite: false })
  const uniforms = { uAirTime: airTime, uSporeFloor: { value: sporeVolume.min[1] }, uSporeHeight: { value: sporeVolume.max[1] - sporeVolume.min[1] } }
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = 'attribute vec4 spore;\nuniform float uAirTime;\nuniform float uSporeFloor;\nuniform float uSporeHeight;\nvarying float vSporeLight;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
float sporePhase = spore.x * 6.283185;
// Each mote loops through the room's height. It fades out at both ends, so the loop is never seen.
float sporeLift = fract((position.y - uSporeFloor) / uSporeHeight + uAirTime * spore.y / uSporeHeight);
transformed.y = uSporeFloor + sporeLift * uSporeHeight;
float sporePace = 0.6 + spore.z * 0.8;
transformed.x += sin(uAirTime * 0.11 * sporePace + sporePhase) * 0.28 + sin(uAirTime * 0.047 + sporePhase * 5.0) * 0.16;
transformed.z += cos(uAirTime * 0.09 * sporePace + sporePhase * 2.0) * 0.26;
vSporeLight = smoothstep(0.0, 0.1, sporeLift) * (1.0 - smoothstep(0.88, 1.0, sporeLift))
  * (0.7 + 0.3 * sin(uAirTime * 0.37 * sporePace + sporePhase * 9.0));`)
    shader.vertexShader = shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * (0.5 + spore.w);')
    shader.vertexShader = shader.vertexShader.replace('#include <fog_vertex>', `#include <fog_vertex>
// A mote near the lens fades instead of growing into a blob. A far mote keeps a visible size and loses light instead.
vSporeLight *= smoothstep(0.7, 2.6, -mvPosition.z) * min(1.0, gl_PointSize / 1.6);
gl_PointSize = clamp(gl_PointSize, 1.6, scale * 0.026);`)
    shader.fragmentShader = 'varying float vSporeLight;\n' + shader.fragmentShader.replace('#include <fog_pars_fragment>', '#include <fog_pars_fragment>' + fogSurvival)
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_particle_fragment>', `
float sporeEdge = length(gl_PointCoord - 0.5) * 2.0;
diffuseColor.a *= vSporeLight * (1.0 - smoothstep(0.15, 1.0, sporeEdge));`)
    // The motes add light, so fog removes light instead of mixing in its colour.
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', 'gl_FragColor.a *= fogSurvival();')
  }
  material.customProgramCacheKey = () => 'brundlefly-air-spores-v1'
  const points = new Points(geometry, material)
  // The motes move in the shader, beyond the bounds of their start positions.
  points.frustumCulled = false
  points.renderOrder = 3
  return { object: points, geometry, material }
}

const mistNoise = `
float mistHash(vec2 point) {
  vec3 mixed = fract(vec3(point.xyx) * 0.1031);
  mixed += dot(mixed, mixed.yzx + 33.33);
  return fract((mixed.x + mixed.y) * mixed.z);
}
float mistNoise(vec2 point) {
  vec2 cell = floor(point), blend = fract(point);
  blend = blend * blend * (3.0 - 2.0 * blend);
  return mix(mix(mistHash(cell), mistHash(cell + vec2(1.0, 0.0)), blend.x),
    mix(mistHash(cell + vec2(0.0, 1.0)), mistHash(cell + vec2(1.0, 1.0)), blend.x), blend.y);
}`

const airVertex = `
varying vec2 vUv;
varying vec3 vAirWorld;
varying vec3 vAirNormal;
varying vec3 vAirView;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vAirWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  vAirNormal = normalMatrix * normal;
  vAirView = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

/** Thin sheets of mist lie just above the floor. They gather toward the walls and leave the walking line clearer. */
function createMist(airTime: { value: number }) {
  const geometry = new PlaneGeometry(13, 17)
  geometry.rotateX(-Math.PI / 2)
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    // The mist takes fog by losing strength with distance. Far mist then sinks into the dark instead of veiling it.
    uniforms: { ...fogUniforms(), uAirTime: airTime, uMist: { value: new Color('#A4B5A0') }, uMistStrength: { value: 0.11 } },
    vertexShader: airVertex,
    fragmentShader: `
uniform float uAirTime;
uniform vec3 uMist;
uniform float uMistStrength;
varying vec2 vUv;
varying vec3 vAirWorld;
#include <fog_pars_fragment>
${fogSurvival}
${mistNoise}
void main() {
  // Each sheet's height shifts its pattern, so the sheets never line up.
  float sheet = vAirWorld.y * 9.0;
  float billow = mistNoise(vAirWorld.xz * 0.42 + vec2(uAirTime * 0.021, uAirTime * 0.013) + sheet) * 0.62
    + mistNoise(vAirWorld.xz * 1.07 + vec2(-uAirTime * 0.017, uAirTime * 0.024) - sheet * 1.7) * 0.38;
  float density = smoothstep(0.36, 0.8, billow) * mix(0.4, 1.0, smoothstep(0.8, 3.6, abs(vAirWorld.x)));
  vec2 border = abs(vUv - 0.5) * 2.0;
  density *= (1.0 - smoothstep(0.7, 1.0, border.x)) * (1.0 - smoothstep(0.7, 1.0, border.y));
  gl_FragColor = vec4(uMist * 0.55, density * uMistStrength * fogSurvival());
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  })
  const sheets = [0.09, 0.2, 0.34].map(height => {
    const sheet = new Mesh(geometry, material)
    sheet.position.set(0, floorSurface.level + height, 2.2)
    sheet.renderOrder = 2
    return sheet
  })
  return { objects: sheets, geometry, material }
}

/** One soft shaft falls from a crack in the roof. It is a cone that adds light. It is no lamp, so it costs the other materials nothing. */
function createShaft(airTime: { value: number }) {
  const top = new Vector3(...shaft.top), foot = new Vector3(...shaft.foot)
  const length = top.distanceTo(foot)
  const geometry = new CylinderGeometry(shaft.topRadius, shaft.footRadius, length, 28, 1, true)
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, side: DoubleSide, blending: AdditiveBlending,
    uniforms: { ...fogUniforms(), uAirTime: airTime, uShaft: { value: new Color(cream) }, uShaftStrength: { value: 0.058 } },
    vertexShader: airVertex,
    fragmentShader: `
uniform float uAirTime;
uniform vec3 uShaft;
uniform float uShaftStrength;
varying vec2 vUv;
varying vec3 vAirNormal;
varying vec3 vAirView;
#include <fog_pars_fragment>
${fogSurvival}
void main() {
  // The cone's sides turn away from the eye and fade, so the shaft has no hard edge.
  float facing = abs(dot(normalize(vAirNormal), normalize(vAirView)));
  float body = pow(facing, 2.4);
  // Light thins on its way down and fades out before the floor. A floor mark shows where it lands.
  float fall = smoothstep(0.0, 0.22, vUv.y) * mix(0.45, 1.0, vUv.y) * (1.0 - smoothstep(0.86, 1.0, vUv.y));
  float streak = 0.85 + 0.15 * sin(vUv.x * 43.0 + sin(vUv.x * 13.0) * 2.0 + uAirTime * 0.06);
  float shimmer = 0.93 + 0.07 * sin(uAirTime * 0.23);
  gl_FragColor = vec4(uShaft * body * fall * streak * shimmer * uShaftStrength * fogSurvival(), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  })
  const cone = new Mesh(geometry, material)
  cone.position.copy(top).add(foot).multiplyScalar(0.5)
  cone.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), top.clone().sub(foot).normalize())
  cone.renderOrder = 2
  // A pale pool marks the landing. It breathes with the shaft.
  const pool = new Color(cream).multiplyScalar(0.16)
  const level = new Float32Array([1])
  const poolGeometry = createFloorDecalGeometry([{ x: foot.x, z: foot.z, radius: shaft.footRadius * 1.5, data: [pool.r, pool.g, pool.b, 0] }])
  const poolMaterial = createFloorGlowMaterial(level)
  const landing = new Mesh(poolGeometry, poolMaterial)
  landing.renderOrder = 1
  return {
    objects: [cone, landing], geometries: [geometry, poolGeometry], materials: [material, poolMaterial],
    update(time: number) { level[0] = 0.93 + 0.07 * Math.sin(time * 0.23) },
  }
}

/**
 * The air of the lair: drifting spores, low mist, and one light shaft.
 * `spores` is the share of the full spore count. `haze` turns on the mist and the shaft.
 * Every motion reads the time that `update` receives. Nothing here reads a clock.
 */
export function createAir(quality: AirQuality) {
  const root = new Group()
  root.name = 'Lair air'
  const airTime = { value: 0 }
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const count = sporeCount(quality.spores)
  if (count > 0) {
    const spores = createSpores(count, airTime)
    root.add(spores.object)
    geometries.add(spores.geometry)
    materials.add(spores.material)
  }
  if (quality.haze) {
    const mist = createMist(airTime)
    root.add(...mist.objects)
    geometries.add(mist.geometry)
    materials.add(mist.material)
  }
  const lightShaft = quality.haze ? createShaft(airTime) : undefined
  if (lightShaft) {
    root.add(...lightShaft.objects)
    lightShaft.geometries.forEach(value => geometries.add(value))
    lightShaft.materials.forEach(value => materials.add(value))
  }
  return {
    root,
    update(time: number) {
      airTime.value = time
      lightShaft?.update(time)
    },
    dispose() {
      geometries.forEach(value => value.dispose())
      materials.forEach(value => value.dispose())
      root.clear()
    },
  }
}
