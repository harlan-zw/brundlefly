import { NearestFilter, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import type { Texture } from 'three'
import { createOffice } from './office.ts'
import { officePlan } from './office-layout.ts'
import { sceneLayout } from './scene-layout.ts'
import type { SceneSet, SetArt } from './scene-set.ts'

// Served copies of assets/brand/office. The brand sync script owns them.
const artwork = ['floor', 'wall', 'ceiling', 'desk', 'metal', 'screen', 'hazard', 'door'] as const

async function loadOffice(): Promise<SetArt> {
  const results = await Promise.allSettled(artwork.map(name => new TextureLoader().loadAsync(`/brand/office/office-${name}.png`)))
  const loaded = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
  const release = () => loaded.forEach(value => value.dispose())
  if (loaded.length < artwork.length) {
    release()
    return { _tag: 'Err', reasons: results.flatMap(result => result.status === 'rejected' ? [result.reason] : []) }
  }
  const [floor, wall, ceiling, desk, metal, screen, hazard, door] = loaded as [Texture, Texture, Texture, Texture, Texture, Texture, Texture, Texture]
  for (const tile of loaded) {
    tile.colorSpace = SRGBColorSpace
    tile.wrapS = tile.wrapT = RepeatWrapping
    // The tiles are small pixel art. A texel that covers many screen pixels keeps its hard square edge.
    tile.magFilter = NearestFilter
  }
  return {
    _tag: 'Ok',
    release,
    build({ anisotropy }) {
      // The floor and the long walls run away from the camera at shallow angles. Without this they blur there.
      for (const tile of loaded) tile.anisotropy = anisotropy
      const office = createOffice({ floor, wall, ceiling, desk, metal, screen, hazard, door })
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
    walkPauses: officePlan.stops.map(stop => stop.pause), walkHabits: officePlan.stops.map(stop => stop.habit), camera: sceneLayout.camera },
  background: '#080B08',
  fog: { _tag: 'None' },
  effects: ['WetEnvironment'],
  load: loadOffice,
}
