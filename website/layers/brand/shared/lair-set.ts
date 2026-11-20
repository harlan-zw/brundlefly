import { LinearFilter, MirroredRepeatWrapping, NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import type { Texture } from 'three'
import { sceneLayout } from './scene-layout'
import type { SceneSet, SetArt } from './scene-set'
import { createWorld } from './world'

const artwork = ['tunnel-diffuse.webp', 'goo-diffuse.png', 'chitin-diffuse.png', 'floor-diffuse.png', 'egg-diffuse.png', 'room-diffuse.webp', 'room-height.webp'] as const

async function loadLair(): Promise<SetArt> {
  // The tunnel's tissue is a smooth painting of the kit's pixel-art flesh tile, with every fold in the same place.
  const results = await Promise.allSettled(artwork.map(name => new TextureLoader().loadAsync(`/brand/kit/lair/${name}`)))
  const loaded = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
  const release = () => loaded.forEach(value => value.dispose())
  if (loaded.length < artwork.length) {
    release()
    return { _tag: 'Err', reasons: results.flatMap(result => result.status === 'rejected' ? [result.reason] : []) }
  }
  const [tunnel, goo, chitin, floor, egg, room, roomHeight] = loaded as [Texture, Texture, Texture, Texture, Texture, Texture, Texture]
  loaded.forEach(value => { value.colorSpace = SRGBColorSpace })
  roomHeight.colorSpace = NoColorSpace
  for (const tiled of [tunnel, goo, chitin, floor, egg]) tiled.wrapS = tiled.wrapT = MirroredRepeatWrapping
  chitin.repeat.set(2, 2)
  floor.repeat.set(5, 8)
  // The tissue of the lair is a surface in a lit room: hard pixels show there as a grid. So it keeps smooth filtering.
  room.wrapS = room.wrapT = RepeatWrapping
  roomHeight.wrapS = roomHeight.wrapT = RepeatWrapping
  room.magFilter = LinearFilter
  roomHeight.magFilter = LinearFilter
  return {
    _tag: 'Ok',
    release,
    build({ quality, anisotropy }) {
      const heightImage = roomHeight.image as HTMLImageElement
      const heightRaster = document.createElement('canvas')
      heightRaster.width = heightImage.width
      heightRaster.height = heightImage.height
      const heightPainter = heightRaster.getContext('2d')!
      heightPainter.drawImage(heightImage, 0, 0)
      const world = createWorld(tunnel, goo, { chitin, floor, egg, room,
        roomHeight: { texture: roomHeight, raster: heightPainter.getImageData(0, 0, heightRaster.width, heightRaster.height) } }, quality)
      // The floor and the walls run away from the camera at shallow angles. Without this they blur there.
      for (const surface of loaded) surface.anisotropy = anisotropy
      const light = new Vector3(...sceneLayout.opening.position)
      return {
        root: world.root,
        cues: {
          light,
          eggs: sceneLayout.eggs.map(([x, z]) => new Vector3(x, -1.9, z)),
          ceiling: from => from.clone().add(new Vector3(0, 6, 0.5)),
        },
        update: world.update,
        dispose() { world.dispose(); release() },
      }
    },
  }
}

/** The fleshy cave of the homepage: the tunnel, the egg sacs, and the wet floor. */
export const lairSet: SceneSet = {
  name: 'lair',
  layout: { floorLevel: -2.2, mascot: sceneLayout.mascot, exit: sceneLayout.exit, walk: sceneLayout.walk, meshWalk: sceneLayout.meshWalk,
    walkPauses: sceneLayout.walkPauses, walkHabits: sceneLayout.walkHabits, camera: sceneLayout.camera },
  background: '#080B08',
  fog: { _tag: 'Exponential', colour: '#080B08', scale: 1 },
  effects: ['Finish', 'FloorMirror', 'WetEnvironment'],
  load: loadLair,
}
