/** How much the lair draws. A weak phone gets less than a desktop. */
export type QualityTier = 'low' | 'medium' | 'high'

export type SceneQuality = {
  tier: QualityTier
  /** The most device pixels drawn for each CSS pixel. */
  pixelRatio: number
  /** The finishing pass: bloom, colour grade, and grain. */
  finish: boolean
  /** Blur behind him during a conversation. It needs the finishing pass. */
  depthBlur: boolean
  /** Drifting spores, as a share of the full count. */
  spores: number
  /** Floor mist and the light shaft. */
  haze: boolean
  /** The wet floor shows him and the eggs. */
  reflection: boolean
}

/** What the page knows about the device. `requested` is the `quality` query value, which wins when it names a tier. */
export type QualityHints = {
  requested: unknown
  coarsePointer: boolean
  cores: number | undefined
  memory: number | undefined
  shortSide: number
}

const tiers: Record<QualityTier, SceneQuality> = {
  // The picture as it was before the finishing pass, with the effects that cost almost nothing.
  low: { tier: 'low', pixelRatio: 1.5, finish: false, depthBlur: false, spores: 0.3, haze: false, reflection: false },
  medium: { tier: 'medium', pixelRatio: 1.5, finish: true, depthBlur: false, spores: 0.6, haze: true, reflection: false },
  high: { tier: 'high', pixelRatio: 1.5, finish: true, depthBlur: true, spores: 1, haze: true, reflection: true },
}

const isTier = (value: unknown): value is QualityTier => value === 'low' || value === 'medium' || value === 'high'

/** The full picture, for callers that have no device to ask. */
export const fullSceneQuality: SceneQuality = tiers.high

/**
 * Picks the tier. A touch device is a phone or a tablet: it gets `medium`, or `low` when it reports few cores, little memory, or a small screen.
 * A device with a fine pointer gets `high`, or `medium` when it reports two cores or fewer.
 * A browser that reports no cores or no memory is judged on what it does report.
 */
export function resolveSceneQuality({ requested, coarsePointer, cores, memory, shortSide }: QualityHints): SceneQuality {
  if (isTier(requested)) return tiers[requested]
  if (coarsePointer) {
    const weak = (cores !== undefined && cores <= 4) || (memory !== undefined && memory <= 4) || shortSide < 380
    return weak ? tiers.low : tiers.medium
  }
  return cores !== undefined && cores <= 2 ? tiers.medium : tiers.high
}
