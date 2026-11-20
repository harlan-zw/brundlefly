import {
  AdditiveBlending, CanvasTexture, Color, DirectionalLight, Group, HemisphereLight, NearestFilter, NormalBlending, PointLight, ShaderMaterial, SRGBColorSpace,
} from 'three'
import type { BufferGeometry, Material, Mesh, Object3D, Texture } from 'three'
import { officePlan } from './office-layout.ts'
import type { OfficePlan } from './office-layout.ts'
import { marksSize, paintOfficeMarks } from './office-marks.ts'
import { defaultSceneSettings } from './scene-settings.ts'
import type { SceneSettings } from './scene-settings.ts'
import { tubeFlicker } from './office-flicker.ts'

/**
 * The parts of the office that Blender built. `model` is the scene of the model file: every prop, the room, the test chamber, and the corridor.
 * `light` is the baked light map of the room's floor, walls, and ceiling. `lightMax` is the light level that a stored value of one stands for.
 */
export type OfficeArt = { model: Object3D, lightMax: number, atlas: Texture, floor: Texture, wall: Texture, ceiling: Texture, concrete: Texture, light: Texture }
export type OfficeInput = { time: number, settings: SceneSettings }

/** How a surface gets its light and its edge. Each look is one shader program. */
type Look = 'Mapped' | 'Baked' | 'Cut' | 'Glass' | 'Beam'
// The names of the surfaces in the model file. The build script in assets/3d/office gives each face one of them.
const looks: Record<string, Look> = { floor: 'Mapped', wall: 'Mapped', ceiling: 'Mapped', concrete: 'Baked', atlas: 'Baked', marks: 'Cut', glass: 'Glass', beam: 'Beam' }

// The file stores light as a square root, so eight bits keep the dark end fine. `stored * stored * uGain` is the light.
// `bake` is the light of a vertex: rgb is the steady light and alpha is the failing tube's share. The room's floor, walls, and ceiling read a light map instead.
const vertexShader = /* glsl */ `
attribute vec4 bake;
uniform float uGain;
uniform float uFlicker;
uniform vec3 uTube;
varying vec2 vUv;
varying vec4 vBake;
#ifdef MAPPED
attribute vec2 lightUv;
varying vec2 vLightUv;
#endif
void main() {
  vUv = uv;
  #ifdef MAPPED
  vLightUv = lightUv;
  #endif
  #if defined(GLASS) || defined(BEAM)
  vBake = bake;
  #else
  vBake = vec4(bake.rgb * bake.rgb * uGain + bake.a * bake.a * uGain * uFlicker * uTube, 1.0);
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const fragmentShader = /* glsl */ `
uniform sampler2D map;
uniform float uGain;
uniform float uFlicker;
uniform vec3 uTube;
varying vec2 vUv;
varying vec4 vBake;
#ifdef MAPPED
uniform sampler2D lightMap;
varying vec2 vLightUv;
#endif
void main() {
  vec4 texel = texture2D(map, vUv);
  #ifdef CUT
  if (texel.a < 0.5) discard;
  #endif
  #ifdef MAPPED
  // The left half of the light map holds the steady light. The right half holds the failing tube's light.
  vec3 steady = texture2D(lightMap, vec2(vLightUv.x * 0.5, vLightUv.y)).rgb;
  float failing = texture2D(lightMap, vec2(vLightUv.x * 0.5 + 0.5, vLightUv.y)).r;
  vec3 light = steady * steady * uGain + failing * failing * uGain * uFlicker * uTube;
  gl_FragColor = vec4(texel.rgb * light, 1.0);
  #elif defined(GLASS)
  // Glass is a thin tint. Its streaks of reflection are brighter and less clear.
  float streak = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
  gl_FragColor = vec4(vBake.rgb + texel.rgb * 1.6, min(1.0, vBake.a + streak * 1.4));
  #elif defined(BEAM)
  gl_FragColor = vec4(vBake.rgb * uGain, 1.0);
  #else
  gl_FragColor = vec4(texel.rgb * vBake.rgb, 1.0);
  #endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

const isMesh = (object: Object3D): object is Mesh<BufferGeometry, Material> => (object as Mesh).isMesh === true

/**
 * The research office: a late-1990s low-poly room. Blender builds its props and bakes its light, and this function gives each surface its texture.
 * The room takes no light at run time. The lights here are his: they light the mascot as the baked tubes light the room.
 */
export function createOffice(art: OfficeArt, plan: OfficePlan = officePlan) {
  const root = new Group()
  root.name = 'Brundlefly office'
  root.add(art.model)

  // The drawn sheet: the whiteboard, the clock face, the door sign, the mug's label, and the keys.
  const sheet = document.createElement('canvas')
  sheet.width = sheet.height = marksSize
  paintOfficeMarks(sheet.getContext('2d')!)
  const marks = new CanvasTexture(sheet)
  marks.colorSpace = SRGBColorSpace
  marks.magFilter = NearestFilter
  // The model's uv follows the file format: v runs down from the top of the picture.
  marks.flipY = false

  const uniforms = { uGain: { value: art.lightMax }, uFlicker: { value: 1 }, uTube: { value: new Color(1, 0.94, 0.8) } }
  const maps: Record<string, Texture> = { floor: art.floor, wall: art.wall, ceiling: art.ceiling, concrete: art.concrete, marks }
  const materials = new Map<string, ShaderMaterial>()
  const surface = (name: string) => {
    const found = materials.get(name)
    if (found) return found
    const look = looks[name] ?? 'Baked'
    const clear = look === 'Glass' || look === 'Beam'
    const made = new ShaderMaterial({
      name, vertexShader, fragmentShader,
      defines: look === 'Mapped' ? { MAPPED: '' } : look === 'Cut' ? { CUT: '' } : look === 'Glass' ? { GLASS: '' } : look === 'Beam' ? { BEAM: '' } : {},
      // Every surface shares the light uniforms, so one write changes the whole room.
      uniforms: { ...uniforms, map: { value: maps[name] ?? art.atlas }, lightMap: { value: art.light } },
      transparent: clear, depthWrite: !clear, blending: look === 'Beam' ? AdditiveBlending : NormalBlending,
    })
    materials.set(name, made)
    return made
  }
  const geometries: BufferGeometry[] = []
  art.model.traverse((object) => {
    if (!isMesh(object)) return
    const { geometry } = object
    geometries.push(geometry)
    // The shader names its own attributes, so the renderer's vertex colour path stays off.
    geometry.setAttribute('bake', geometry.getAttribute('color'))
    geometry.deleteAttribute('color')
    const second = geometry.getAttribute('uv1')
    if (second) { geometry.setAttribute('lightUv', second); geometry.deleteAttribute('uv1') }
    const placeholder = object.material
    object.material = surface(placeholder.name)
    placeholder.dispose()
    // Glass and beams draw after the solid room.
    if (object.material.transparent) object.renderOrder = 1
  })
  const hand = art.model.getObjectByName('second-hand')
  const beacon = art.model.getObjectByName('beacon')

  // His lights. The sky light fills him as the tubes fill the room, and one light from above shapes him.
  const sky = new HemisphereLight(new Color('#F2EEDC'), new Color('#777648'), 1)
  const sun = new DirectionalLight(new Color('#FFF4DC'), 1)
  sun.position.set(-2.5, 6, 5)
  sun.target.position.set(0, -1, -1)
  // The failing tube lights him from above, so its flicker shows on him.
  const lamp = new PointLight(new Color('#FFF1CF'), 1, 9, 1.6)
  lamp.position.set(plan.cues.ceiling[0], plan.cues.ceiling[1] - 0.25, plan.cues.ceiling[2])
  // Cold light leaks from the test chamber. It is the only strong teal in the room.
  const leak = new PointLight(new Color('#418B90'), 1, 8, 1.6)
  leak.position.set(plan.cues.light[0], plan.cues.light[1], plan.room.minZ - 1.2)
  root.add(sky, sun, sun.target, lamp, leak)
  const levels = { sky: 1.9, sun: 1.5, lamp: 9, leak: 16 }

  return {
    root,
    update({ time, settings }: OfficeInput) {
      // The lighting sliders keep their roles: ambient is the room's light, key his light from above, inner the failing tube, rim the chamber's leak.
      const ambient = settings.ambient / defaultSceneSettings.ambient
      uniforms.uGain.value = art.lightMax * ambient
      sky.intensity = levels.sky * ambient
      sun.intensity = levels.sun * settings.key / defaultSceneSettings.key
      const glow = tubeFlicker(time) * settings.inner / defaultSceneSettings.inner
      uniforms.uFlicker.value = glow
      lamp.intensity = levels.lamp * glow
      leak.intensity = levels.leak * settings.rim / defaultSceneSettings.rim
      // One tick each second. A whole second of scene time must pass, so a still scene keeps a still hand.
      if (hand) hand.rotation.z = -Math.floor(time) / 60 * Math.PI * 2
      // The warning light of the test chamber turns once in four seconds.
      if (beacon) beacon.rotation.y = time / 4 * Math.PI * 2
    },
    dispose() {
      geometries.forEach(geometry => geometry.dispose())
      materials.forEach(material => material.dispose())
      marks.dispose()
      root.clear()
    },
  }
}
