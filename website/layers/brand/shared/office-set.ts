import { ClampToEdgeWrapping, LinearFilter, NearestFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import type { BufferGeometry, Material, Mesh, Object3D, Texture } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createOffice } from './office.ts'
import { officePlan } from './office-layout.ts'
import { sceneLayout } from './scene-layout.ts'
import type { SceneSet, SetArt } from './scene-set.ts'

// Served copies of assets/brand/office and assets/3d/office/office.glb. The brand sync script owns them.
const folder = '/brand/office'
// Four tiles that repeat across the room, the atlas of every prop texture, and the baked light map.
const pictures = ['office-floor.png', 'office-wall.png', 'office-ceiling.png', 'office-concrete.png', 'office-atlas.png', 'office-light.webp'] as const

const releaseModel = (model: Object3D) => model.traverse((object) => {
  const mesh = object as Mesh<BufferGeometry, Material>
  if (!mesh.isMesh) return
  mesh.geometry.dispose()
  mesh.material.dispose()
})

async function loadOffice(): Promise<SetArt> {
  const [file, ...results] = await Promise.allSettled([
    new GLTFLoader().loadAsync(`${folder}/office.glb`),
    ...pictures.map(name => new TextureLoader().loadAsync(`${folder}/${name}`)),
  ])
  const loaded = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
  const model = file.status === 'fulfilled' ? file.value.scene : undefined
  // The build script writes the light level that a stored value of one stands for.
  const lightMax: unknown = file.status === 'fulfilled' ? (file.value.asset as { extras?: { lightMax?: unknown } }).extras?.lightMax : undefined
  const release = () => { loaded.forEach(value => value.dispose()); if (model) releaseModel(model) }
  if (!model || typeof lightMax !== 'number' || loaded.length < pictures.length) {
    release()
    return { _tag: 'Err', reasons: [...[file, ...results].flatMap(result => result.status === 'rejected' ? [result.reason] : []),
      ...(model && typeof lightMax !== 'number' ? ['The office model does not name its light level.'] : [])] }
  }
  const [floor, wall, ceiling, concrete, atlas, light] = loaded as [Texture, Texture, Texture, Texture, Texture, Texture]
  for (const picture of loaded) {
    picture.colorSpace = SRGBColorSpace
    // The model's uv follows the file format: v runs down from the top of the picture.
    picture.flipY = false
    // The textures are small on purpose. A texel that covers many screen pixels keeps its hard square edge.
    picture.magFilter = NearestFilter
  }
  for (const tile of [floor, wall, ceiling, concrete]) tile.wrapS = tile.wrapT = RepeatWrapping
  // The wall texture runs once from the ceiling to the floor.
  wall.wrapT = ClampToEdgeWrapping
  // A smaller copy of the atlas would mix each cell with its neighbour, so the atlas keeps one size.
  atlas.generateMipmaps = false
  atlas.minFilter = LinearFilter
  // The light map holds numbers, and light is smooth: it keeps smooth filtering.
  light.colorSpace = NoColorSpace
  light.generateMipmaps = false
  light.minFilter = light.magFilter = LinearFilter
  return {
    _tag: 'Ok',
    release,
    build({ anisotropy }) {
      // The floor and the long walls run away from the camera at shallow angles. Without this they blur there.
      for (const tile of [floor, wall, ceiling, concrete]) tile.anisotropy = anisotropy
      const office = createOffice({ model, lightMax, atlas, floor, wall, ceiling, concrete, light })
      const { cues } = officePlan
      const tube = new Vector3(...cues.ceiling)
      return {
        root: office.root,
        // The jars stand in for the eggs, the test chamber for the light, and the failing tube for the ceiling.
        cues: { light: new Vector3(...cues.light), eggs: [new Vector3(...cues.jars)], ceiling: () => tube },
        update: office.update,
        dispose() { office.dispose(); release() },
      }
    },
  }
}

const route = officePlan.stops.map(stop => stop.position)

/** The research office at /office: the same mascot at his old desk. It draws no fog, no finishing pass, and no floor mirror, so it costs far less than the lair. */
export const officeSet: SceneSet = {
  name: 'office',
  // The camera keeps the lair's framing, so the conversation shots hold. The relief rig is flat artwork and can walk the mesh's route.
  layout: { floorLevel: officePlan.room.floorY, mascot: officePlan.start, exit: officePlan.exit, walk: route, meshWalk: route,
    walkPauses: officePlan.stops.map(stop => stop.pause), walkHabits: officePlan.stops.map(stop => stop.habit), walkFacings: officePlan.stops.map(stop => stop.facing), walkAlternates: officePlan.stops.map(stop => stop.alternate), camera: sceneLayout.camera,
    entrance: { ...officePlan.entrance, lightSwitch: officePlan.lightSwitch } },
  background: '#080B08',
  fog: { _tag: 'None' },
  effects: ['WetEnvironment'],
  // White tubes light him from above: his skin is nearer its own colour than in the cave, and his shadows are clear on the bright floor.
  mascot: { shading: { tint: [0.8, 0.8, 0.79], occlusion: 1.3, untinted: ['Brundlefly-wing'] }, key: { colour: '#E9F0E4', rest: 2.5, talk: 9 },
    rim: { colour: '#9CC8C4', rest: 0, talk: 2 }, shadow: { body: 0.62, foot: 0.86 }, vignette: 'Light' },
  load: loadOffice,
}
