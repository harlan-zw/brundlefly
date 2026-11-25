import { specimenCount } from './office-experiment.ts'
import type { Experiment } from './office-experiment.ts'

/**
 * The unrest of the test chamber before it goes critical. The room shows that the load is near the target, so nobody is surprised when it gets there.
 * `Calm`: the room is as it always is. `Unstable`, from four fifths of the target: the warning light turns faster and brighter, and now and then the room shakes and the tubes dip.
 * `Warning`, from nine tenths: all of that more often and harder, and the computer warns. A critical run stays at `Warning`.
 * `level` rises from 0 at the start of `Unstable` to 1 at the target.
 */
export type Unrest = { stage: 'Calm' | 'Unstable' | 'Warning', level: number }
export const unrestShares = { unstable: 0.8, warning: 0.9 }
const calm: Unrest = { stage: 'Calm', level: 0 }

const clamp = (value: number) => Math.max(0, Math.min(1, value))

export function unrest(experiment: Experiment | null | undefined): Unrest {
  if (!experiment) return calm
  if (experiment.criticalAt !== null) return { stage: 'Warning', level: 1 }
  const share = specimenCount(experiment) / experiment.target
  if (share < unrestShares.unstable) return calm
  return { stage: share < unrestShares.warning ? 'Unstable' : 'Warning', level: clamp((share - unrestShares.unstable) / (1 - unrestShares.unstable)) }
}

/** Turns of the chamber's warning light in one second. It never turns more than once a second, so its light never pulses faster than that. */
export const beaconTurns = ({ stage, level }: Unrest) => stage === 'Calm' ? 0.25 : stage === 'Unstable' ? 0.45 + 0.2 * level : 0.6 + 0.4 * level
/** How much brighter than usual the warning light burns, and how much red it throws on the room, from 0 to 1. */
export const beaconGlow = ({ stage, level }: Unrest) => stage === 'Calm' ? 0 : stage === 'Unstable' ? 0.3 + 0.3 * level : 0.6 + 0.4 * level

/** `shake` is how hard the room shakes, from 0 to 1. `light` is the share of their light that the tubes keep, from 0 to 1. */
export type Tremor = { shake: number, light: number }
const still: Tremor = { shake: 0, light: 1 }
// Seconds from one tremor to the next, the seconds one lasts, and the seconds its dip of the tubes lasts.
// The shortest gap is over two seconds and a tremor dips the tubes once, so the room flashes far less than three times a second.
const tremorGap = { Unstable: 5, Warning: 2.4 }
const tremorSeconds = 0.8
const dipSeconds = 0.16
const chance = (index: number) => { const value = Math.sin(index * 127.1) * 43758.5453; return value - Math.floor(value) }

/**
 * The tremor of the room at `time` seconds on any steady clock. A tremor comes at an uneven moment in each gap.
 * `motionOff` is reduced motion and Motion off: the room then neither shakes nor dips.
 */
export function tremor(time: number, { stage, level }: Unrest, motionOff: boolean): Tremor {
  if (stage === 'Calm' || motionOff || !(time >= 0)) return still
  const gap = tremorGap[stage]
  const index = Math.floor(time / gap)
  // The tremor starts somewhere in the first part of its gap, and ends inside it.
  const age = time - index * gap - chance(index) * (gap - tremorSeconds - 0.2)
  if (age < 0 || age >= tremorSeconds) return still
  const swell = Math.sin(Math.PI * age / tremorSeconds) ** 2
  return { shake: swell * (0.3 + 0.7 * level), light: age < dipSeconds ? 1 - (0.2 + 0.3 * level) : 1 }
}
