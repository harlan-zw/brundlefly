// Test support: replays the scene's stroll loop for a mascot with a full body, as _WorldScene.client.vue advances it each frame.
import { advanceStroll, advanceTurn, startStroll, startTurn } from '../layers/brand/shared/mascot-stroll.ts'
import type { Stroll, StrollAttention, Turn } from '../layers/brand/shared/mascot-stroll.ts'
import { officePlan } from '../layers/brand/shared/office-layout.ts'
import { sceneLayout } from '../layers/brand/shared/scene-layout.ts'
import { defaultSceneSettings } from '../layers/brand/shared/scene-settings.ts'

export type Point = readonly [number, number]
export type Walk = { stroll: Stroll, turn: Turn }
/** The scene's numbers for the mesh mascot: his walk speed, the speed of a journey, his three-quarter turn, and his heading limit. */
export const meshWalk = { speed: defaultSceneSettings.walkSpeed * 1.5, journey: 1.7, rest: 0.5, limit: 1.3, scale: 1.25 }
export const frame = 1 / 60
/** Both sets as the scene reads them: where he starts, the way out, his loop, and his pauses. */
export const walkSets = {
  lair: { start: sceneLayout.mascot as Point, exit: sceneLayout.exit as Point, route: sceneLayout.meshWalk as readonly Point[], pauses: sceneLayout.walkPauses as readonly number[] },
  office: { start: officePlan.start, exit: officePlan.exit, route: officePlan.stops.map(stop => stop.position), pauses: officePlan.stops.map(stop => stop.pause) },
}
/** The way he faces his work at each stop of the office round, or nothing at a stop with no work. */
export const officeFacings = officePlan.stops.map(stop => stop.facing)
/** `facings` turns him to his work while he pauses at a stop, as the scene does at a station. Without it he holds the three-quarter turn at every stop. */
export type WalkInput = { delta?: number, route: readonly Point[], pauses: readonly number[], attention?: StrollAttention, walkSpeed?: number, cadence: number, facings?: readonly (number | undefined)[] }

export const startWalk = (position: Point, heading = meshWalk.rest): Walk => ({ stroll: startStroll(position, 0), turn: startTurn(heading) })

/** One frame of the scene: the stroll first, with the way he faces, and then his turn. */
export function stepWalk({ stroll, turn }: Walk, { delta = frame, route, pauses, attention = 'free', walkSpeed = meshWalk.speed, cadence, facings }: WalkInput): Walk {
  const walked = advanceStroll(stroll, { delta, route, pauses, walkSpeed, attention, cadence, facing: turn.heading })
  // The scene turns him to his work only while he pauses at a station and nothing has his attention.
  const stand = facings && attention === 'free' && walked.activity._tag === 'Pausing' ? facings[walked.activity.waypoint % facings.length] : undefined
  return { stroll: walked, turn: advanceTurn(turn, walked, { delta, walkSpeed, rest: meshWalk.rest, limit: meshWalk.limit, attention, stand }) }
}

/** The cadence the scene gives a mesh whose stride is `stride` of its own units. */
export const meshCadence = (stride: number) => Math.PI * 2 / (stride * meshWalk.scale)

/** A fixed pseudo-random sequence, so a failure repeats. */
export function sequence(seed: number) {
  return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
}
