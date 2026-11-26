import { specimenCount } from './office-experiment.ts'
import type { Experiment } from './office-experiment.ts'

/** Total slides in `/projector?show`. */
export const showSlideCount = 5
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
  /** Whether the clicker has already visited the desk computer in this run, so returning to `room` holds on the falling critters. */
  shownComputer?: boolean
  experiment: Experiment | null
  /** Seconds since `criticalAt`, or `undefined` when not critical. */
  criticalAge: number | undefined
}

export type ClickerAction =
  | { _tag: 'None' }
  | { _tag: 'Slide', index: number | null }
  | { _tag: 'Station', station: ShowStation }
  | { _tag: 'Reveal' }

/** Maps standard USB presenter clicker keys (`ArrowRight`, `ArrowDown`, `PageDown`, `Space`, `ArrowLeft`, `ArrowUp`, `PageUp`) to Next or Prev. */
export function readClickerKey(key: string): ClickerKey | undefined {
  if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown' || key === ' ') return 'Next'
  if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp') return 'Prev'
}

/**
 * Pure state transition for one presenter clicker press on `/projector`.
 * In show mode, `Next` advances slides 1..5, fades into the 3D office, opens the beetle QR, moves to the desk computer,
 * zooms back out to the office to watch specimens fall, and triggers `Reveal` once the critical scene reaches its blackout window.
 */
export function clickerAction(key: ClickerKey, context: ShowContext): ClickerAction {
  const { show, slide, station, shownComputer = false, experiment, criticalAge } = context
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
    if (station === 'room') return shownComputer ? { _tag: 'None' } : { _tag: 'Station', station: 'code' }
    if (station === 'code') return { _tag: 'Station', station: 'computer' }
    return { _tag: 'Station', station: 'room' }
  }

  // `Prev` steps back room (after computer) -> computer -> QR -> room -> Slide 5 when idle in show mode.
  if (station === 'room' && shownComputer) return { _tag: 'Station', station: 'computer' }
  if (station === 'computer') return { _tag: 'Station', station: 'code' }
  if (station === 'code') return { _tag: 'Station', station: 'room' }
  if (show && !counting) return { _tag: 'Slide', index: showSlideCount - 1 }
  return { _tag: 'None' }
}
