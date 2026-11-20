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
 * The parts of the office that Blender built. `model` is the scene of the model file: every prop, the room, and the test chamber behind the window.
 * `light` is the baked light map of the room's floor, walls, and ceiling. `lightMax` is the light level that a stored value of one stands for.
 */
export type OfficeArt = { model: Object3D, lightMax: number, atlas: Texture, floor: Texture, wall: Texture, ceiling: Texture, concrete: Texture, light: Texture }
/** `light` is how bright the room's tubes are, from 0 to 1. Zero is a dark room: only the things with their own light show. */
export type OfficeInput = { time: number, settings: SceneSettings, light: number }

/** How a surface gets its light and its edge. Each look is one shader program. */
type Look = 'Mapped' | 'Baked' | 'Cut' | 'Glass' | 'Beam'
// The names of the surfaces in the model file. The build script in assets/3d/office gives each face one of them.
const looks: Record<string, Look> = { floor: 'Mapped', wall: 'Mapped', ceiling: 'Mapped', concrete: 'Baked', atlas: 'Baked', marks: 'Cut', glass: 'Glass', beam: 'Beam' }
// A surface with this ending has its own light: a screen, a small lamp, and all of the test chamber. It stays lit when the room's tubes are off.
const ownLight = '-own'

// The file stores light as a square root, so eight bits keep the dark end fine. `stored * stored * uGain` is the light.
// `bake` is the light of a vertex: rgb is the steady light and alpha is the failing tube's share. The room's floor, walls, and ceiling read a light map instead.
// `uRoom` is the level of the room's tubes, from 0 to 1. It scales the baked light of every surface but those with their own light.
const vertexShader = /* glsl */ `
attribute vec4 bake;
uniform float uGain;
uniform float uFlicker;
uniform float uRoom;
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
  #elif defined(OWN)
  vBake = vec4(bake.rgb * bake.rgb * uGain + bake.a * bake.a * uGain * uFlicker * uTube * uRoom, 1.0);
  #else
  vBake = vec4((bake.rgb * bake.rgb * uGain + bake.a * bake.a * uGain * uFlicker * uTube) * uRoom, 1.0);
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const fragmentShader = /* glsl */ `
uniform sampler2D map;
uniform float uGain;
uniform float uFlicker;
uniform float uRoom;
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
  vec3 light = (steady * steady * uGain + failing * failing * uGain * uFlicker * uTube) * uRoom;
  gl_FragColor = vec4(texel.rgb * light, 1.0);
  #elif defined(GLASS)
  // Glass is a thin tint. Its streaks of reflection are brighter and less clear. The tint and the streaks show the room's light, so both follow it.
  float streak = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
  gl_FragColor = vec4((vBake.rgb + texel.rgb * 1.6) * uRoom, min(1.0, vBake.a + streak * 1.4 * uRoom));
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

  const uniforms = { uGain: { value: art.lightMax }, uFlicker: { value: 1 }, uRoom: { value: 1 }, uTube: { value: new Color(1, 0.94, 0.8) } }
  const maps: Record<string, Texture> = { floor: art.floor, wall: art.wall, ceiling: art.ceiling, concrete: art.concrete, marks }
  const materials = new Map<string, ShaderMaterial>()
  const surface = (name: string) => {
    const found = materials.get(name)
    if (found) return found
    const own = name.endsWith(ownLight)
    const base = own ? name.slice(0, -ownLight.length) : name
    const look = looks[base] ?? 'Baked'
    const clear = look === 'Glass' || look === 'Beam'
    const made = new ShaderMaterial({
      name, vertexShader, fragmentShader,
      defines: { ...(look === 'Mapped' ? { MAPPED: '' } : look === 'Cut' ? { CUT: '' } : look === 'Glass' ? { GLASS: '' } : look === 'Beam' ? { BEAM: '' } : {}), ...(own ? { OWN: '' } : {}) },
      // Every surface shares the light uniforms, so one write changes the whole room.
      uniforms: { ...uniforms, map: { value: maps[base] ?? art.atlas }, lightMap: { value: art.light } },
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

  // His lights. The room takes none of them. They light him as the baked tubes light the room: flat and cool, from above.
  // The sky light is the tubes' fill, and its ground colour is the light that the lino throws back up.
  const sky = new HemisphereLight(new Color('#E6EFE4'), new Color('#7C7A56'), 1)
  const tubes = new DirectionalLight(new Color('#F1F6EC'), 1)
  tubes.position.set(0.4, 6, 1.2)
  tubes.target.position.set(0, -1, -0.6)
  // The failing tube lights him from above, so its flicker shows on him.
  const lamp = new PointLight(new Color('#FFF6DF'), 1, 9, 1.6)
  lamp.position.set(plan.cues.ceiling[0], plan.cues.ceiling[1] - 0.25, plan.cues.ceiling[2])
  // Cold light leaks from the test chamber. It is the only strong teal in the room.
  const leak = new PointLight(new Color('#418B90'), 1, 8, 1.6)
  leak.position.set(plan.cues.light[0], plan.cues.light[1], plan.room.minZ - 1.2)
  // In a dark room the eye opens, and the small lights count for more. The chamber's leak edges him from behind,
  // the screen gives him a little green, and the window of the vending machine a little warmth.
  // The tubes drown all three, so each share fades out as the tubes come on, and the lit room keeps its look.
  const screenProp = plan.props.find(prop => prop._tag === 'Monitor')
  const screen = new PointLight(new Color(0.45, 1, 0.85), 0, 9, 1.6)
  if (screenProp) screen.position.set(screenProp.position[0], screenProp.position[1] + 0.14, screenProp.position[2] + screenProp.size[2] / 2 + 0.2)
  const vendingProp = plan.props.find(prop => prop._tag === 'VendingMachine')
  const vending = new PointLight(new Color(1, 0.92, 0.75), 0, 8, 1.6)
  if (vendingProp) vending.position.set(vendingProp.position[0] - vendingProp.size[0] / 2 - 0.3, vendingProp.position[1] + 0.3, vendingProp.position[2] - 0.2)
  root.add(sky, tubes, tubes.target, lamp, leak, screen, vending)
  const levels = { sky: 1.1, tubes: 1.5, lamp: 3.5, leak: 9, dark: { leak: 126, screen: 6, vending: 1.4 } }

  return {
    root,
    update({ time, settings, light }: OfficeInput) {
      // The lighting sliders keep their roles: ambient is the room's light, key his light from above, inner the failing tube, rim the chamber's leak.
      const ambient = settings.ambient / defaultSceneSettings.ambient
      uniforms.uGain.value = art.lightMax * ambient
      // The tubes light the room and him alike, so one level turns both down. The chamber's leak has its own light and stays.
      const room = Math.max(0, Math.min(1, light))
      uniforms.uRoom.value = room
      sky.intensity = levels.sky * ambient * room
      tubes.intensity = levels.tubes * settings.key / defaultSceneSettings.key * room
      const glow = tubeFlicker(time) * settings.inner / defaultSceneSettings.inner
      uniforms.uFlicker.value = glow
      lamp.intensity = levels.lamp * glow * room
      leak.intensity = (levels.leak + levels.dark.leak * (1 - room)) * settings.rim / defaultSceneSettings.rim
      screen.intensity = levels.dark.screen * (1 - room)
      vending.intensity = levels.dark.vending * (1 - room)
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
