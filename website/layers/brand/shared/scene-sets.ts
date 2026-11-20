import { lairSet } from './lair-set'
import type { SceneSet, SetName } from './scene-set'

/** Every set the scene can show, by name. */
export const sceneSets: Record<SetName, SceneSet> = { lair: lairSet }
