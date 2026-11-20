import type { Object3D, Vector3 } from 'three'
import type { MannerismTag } from './mannerism.ts'
import type { SceneQuality } from './scene-quality.ts'
import type { SceneSettings } from './scene-settings.ts'

/**
 * A set is the place the mascot stands in. The scene owns the mascot, the camera, and the conversation. The set owns everything else.
 * The scene can change the set while it runs. The mascot is the same in every set, so a set lights him and never reshades him.
 */
export type SetName = 'lair' | 'office'
type Point = readonly [x: number, z: number]
type Place = readonly [x: number, y: number, z: number]

/** Where he stands and walks, and where the camera stands. Coordinates are world units. */
export type SetLayout = {
  /** The height of the floor he stands on. */
  floorLevel: number
  /** Where he starts. */
  mascot: Point
  /** The way out to another set: the point he walks toward when he leaves, and where he comes in. */
  exit: Point
  /** The relief rig's walk route. */
  walk: readonly Point[]
  /** The walk route of the full-bodied mesh, which needs more room. */
  meshWalk: readonly Point[]
  /** Seconds he stands at each walk point before he moves on. */
  walkPauses: readonly number[]
  /** What he does at each walk point. */
  walkHabits: readonly MannerismTag[]
  camera: { desktop: Place, portrait: Place, target: Place }
}

/** `scale` multiplies the Fog setting, so the slider keeps its meaning in every set. */
export type SetFog = { _tag: 'None' } | { _tag: 'Exponential', colour: string, scale: number }

/**
 * The optional effects a set asks the scene for. The quality tier can still refuse one.
 * `Finish` is the bloom, grade, and grain pass. `FloorMirror` shows the room in a wet floor. `WetEnvironment` gives wet surfaces their glints.
 */
export type SetEffect = 'Finish' | 'FloorMirror' | 'WetEnvironment'

/** The world points his habits and dialogue beats look at. `eggs` holds one point or more, and he looks at the nearest. */
export type SetCues = { light: Vector3, eggs: readonly Vector3[], ceiling: (from: Vector3) => Vector3 }

/** `time` is scene time in seconds. It stands still under reduced motion, so a set that follows it stands still too. */
export type SetInput = { time: number, pressure: number, settings: SceneSettings }

/** A set in the scene. `dispose` releases its geometry, its materials, and the artwork it loaded. */
export type BuiltSet = { root: Object3D, cues: SetCues, update: (input: SetInput) => void, dispose: () => void }

/** What a set needs from the device to build itself. */
export type SetContext = { quality: SceneQuality, anisotropy: number }

/** Loaded artwork. `release` frees it when the scene ends before it builds the set. A failed load is an error value and holds nothing. */
export type SetArt = { _tag: 'Ok', build: (context: SetContext) => BuiltSet, release: () => void } | { _tag: 'Err', reasons: readonly unknown[] }

export type SceneSet = {
  name: SetName
  layout: SetLayout
  /** The colour behind everything the set draws. */
  background: string
  fog: SetFog
  effects: readonly SetEffect[]
  load: () => Promise<SetArt>
}
