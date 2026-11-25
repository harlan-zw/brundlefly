import { specimenCount } from './office-experiment.ts'
import type { Experiment } from './office-experiment.ts'

/** Total MS Paint slides in `/projector?show`. */
export const showSlideCount = 4
/** Minimum seconds into the critical scene before a clicker press triggers reveal, preventing accidental early clicks. */
export const clickerRevealAfterSeconds = 10

export type ClickerKey = 'Next' | 'Prev'
export type ShowStation = 'room' | 'computer' | 'code'
export type ShowContext = {
  /** Whether `/projector?show` slide mode is active. */
  show: boolean
  /** Current 0-based slide index, or `null` when showing the live 3D scene. */
  slide: number | null
  station: ShowStation
  experiment: Experiment | null
  /** Seconds since `criticalAt`, or `undefined` when not critical. */
  criticalAge: number | undefined
}

export type ClickerAction =
  | { _tag: 'None' }
  | { _tag: 'Slide', index: number | null }
  | { _tag: 'Station', station: ShowStation }
  | { _tag: 'Reveal' }

/** Maps standard USB presenter clicker keys (`ArrowRight`, `PageDown`, `Space`, `ArrowLeft`, `PageUp`) to Next or Prev. */
export function readClickerKey(key: string): ClickerKey | undefined {
  if (key === 'ArrowRight' || key === 'PageDown' || key === ' ') return 'Next'
  if (key === 'ArrowLeft' || key === 'PageUp') return 'Prev'
}

/**
 * Pure state transition for one presenter clicker press on `/projector`.
 * In show mode, `Next` advances slides 1..4, cuts to the 3D office, opens the beetle QR, ignores presses during active counting,
 * and triggers `Reveal` once the critical scene reaches its blackout window.
 */
export function clickerAction(key: ClickerKey, context: ShowContext): ClickerAction {
  const { show, slide, station, experiment, criticalAge } = context
  const critical = experiment !== null && experiment.criticalAt !== null
  if (critical) {
    if (key === 'Next' && experiment.revealAt === null && criticalAge !== undefined && criticalAge >= clickerRevealAfterSeconds) {
      return { _tag: 'Reveal' }
    }
    return { _tag: 'None' }
  }

  if (slide !== null) {
    if (key === 'Next') return { _tag: 'Slide', index: slide + 1 < showSlideCount ? slide + 1 : null }
    return slide > 0 ? { _tag: 'Slide', index: slide - 1 } : { _tag: 'None' }
  }

  const counting = experiment !== null && specimenCount(experiment) > 0
  if (key === 'Next') {
    return station === 'room' ? { _tag: 'Station', station: 'code' } : { _tag: 'None' }
  }

  // `Prev` returns from the QR/computer to the room, or steps back to the final slide when idle in show mode.
  if (station !== 'room') return { _tag: 'Station', station: 'room' }
  if (show && !counting) return { _tag: 'Slide', index: showSlideCount - 1 }
  return { _tag: 'None' }
}
