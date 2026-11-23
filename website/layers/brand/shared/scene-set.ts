import type { Object3D, Vector3 } from 'three'
import type { MannerismTag } from './mannerism.ts'
import type { MeshShading } from './mascot-mesh.ts'
import type { SceneQuality } from './scene-quality.ts'
import type { SceneSettings } from './scene-settings.ts'

/**
 * A set is the place the mascot stands in. The scene owns the mascot, the camera, and the conversation. The set owns everything else.
 * The scene can change the set while it runs. The mascot is one model in every set. A set names how he looks in it, and the scene applies that each time it raises the set.
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
  /** The way he faces at each walk point, as a turn about the vertical. A point without one keeps his three-quarter turn to the viewer. */
  walkFacings?: readonly (number | undefined)[]
  /** A second habit for a walk point. He performs it on every second visit to the point, so his round is not the same each time. */
  walkAlternates?: readonly (MannerismTag | undefined)[]
  camera: { desktop: Place, portrait: Place, target: Place }
  /** A set whose lamps are off when a visitor loads it names its entrance. */
  entrance?: SetEntrance
}

/** Where he stands in the dark, where he stands to reach the switch, the way he faces there as a turn about the vertical, and the switch itself. */
export type SetEntrance = { start: Point, stand: Point, facing: number, lightSwitch: Place }

/** `scale` multiplies the Fog setting, so the slider keeps its meaning in every set. */
export type SetFog = { _tag: 'None' } | { _tag: 'Exponential', colour: string, scale: number }

/**
 * The optional effects a set asks the scene for. The quality tier can still refuse one.
 * `Finish` is the bloom, grade, and grain pass. `FloorMirror` shows the room in a wet floor. `WetEnvironment` gives wet surfaces their glints.
 */
export type SetEffect = 'Finish' | 'FloorMirror' | 'WetEnvironment'

/** The world points his habits and dialogue beats look at. `eggs` holds one point or more, and he looks at the nearest. */
export type SetCues = { light: Vector3, eggs: readonly Vector3[], ceiling: (from: Vector3) => Vector3 }

/** A stage light of his: its colour, its level between talks, and the level a close shot adds. */
export type StageLight = { colour: string, rest: number, talk: number }

/**
 * How a set shows the mascot. Each set lights him as it lights its own room, so he reads as a part of it.
 * The scene applies this when the set rises: at the first build, and after every journey.
 */
export type SetMascot = {
  /** The tint and the occlusion of the full-bodied model. */
  shading: MeshShading
  /** The key stands above his face, on the side he faces. The rim edges him on his far side. */
  key: StageLight
  rim: StageLight
  /** How dark his shadows are, from 0 to 1: the patch under his body, and the patch under each planted foot. */
  shadow: { body: number, foot: number }
  /** The dark edge of the picture. A dark set holds the eye with it. A lit room needs little. */
  vignette: 'Heavy' | 'Light'
}

/**
 * His look at a light level of the set, from 0 to 1. With the lamps out he has no stage light and casts no shadow, and the picture takes the heavy dark edge.
 * The set's own lights still reach him: the scene leaves those to the set.
 */
export function mascotInLight(look: SetMascot, light: number): SetMascot {
  const level = Math.max(0, Math.min(1, light))
  if (level === 1) return look
  const dim = (lamp: StageLight): StageLight => ({ ...lamp, rest: lamp.rest * level, talk: lamp.talk * level })
  return { ...look, key: dim(look.key), rim: dim(look.rim), shadow: { body: look.shadow.body * level, foot: look.shadow.foot * level },
    vignette: level < 0.5 ? 'Heavy' : look.vignette }
}

/**
 * `time` is scene time in seconds. It stands still under reduced motion, so a set that follows it stands still too.
 * `light` is how bright the set's own lamps are, from 0 to 1. A set whose lamps can go out follows it.
 */
export type SetInput = { time: number, pressure: number, settings: SceneSettings, light: number }

/** The drawing calls a drawn sheet needs. A 2D canvas context has them. The type names no browser API, so the Worker's check can read this file. */
export type SetPainter = { fillStyle: string | object, fillRect: (x: number, y: number, width: number, height: number) => void, clearRect: (x: number, y: number, width: number, height: number) => void }
/** The drawn sheet of a set: the painter that draws on it, and the call that shows what it drew. */
export type SetMarks = { painter: SetPainter, changed: () => void }

/**
 * A set in the scene. `dispose` releases its geometry, its materials, and the artwork it loaded.
 * A set with a drawn sheet gives `marks`, so the scene can draw on it while it runs.
 */
export type BuiltSet = { root: Object3D, cues: SetCues, update: (input: SetInput) => void, dispose: () => void, marks?: SetMarks }

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
  mascot: SetMascot
  load: () => Promise<SetArt>
}
