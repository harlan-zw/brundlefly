import { criticalSceneSeconds } from './office-experiment.ts'

/**
 * The critical scene of the office experiment, as a timeline. Every device times it from the server's critical time, so the room sees one event.
 * `Surge`: the test chamber wakes and the tubes stutter. `Pull`: the chamber draws every specimen in. `Strike`: the tubes go out.
 * `Flash`: the chamber's light takes the picture. `Dark`: the picture is black, and the scene changes the set behind it.
 */
export const criticalTimes = { surge: 1.4, pull: 3.4, strike: 1.3, flash: 1.4, dark: criticalSceneSeconds - 7.5 }

/** Seconds of the scene that a visitor at the computer stays there. Its screen fails, and then the view returns to the room. */
export const crashSeconds = 1.3

export type CriticalFrame = {
  /** The level of the room's tubes, from 0 to 1. */
  light: number
  /** How bright the test chamber burns behind its window, from 0 to 1. */
  chamber: number
  /** How far the chamber has drawn the specimens in, from 0 to 1. */
  pull: number
  /** How hard the camera shakes, from 0 to 1. */
  shake: number
  /** How much of the picture the chamber's light covers, from 0 to 1. */
  flash: number
  /** How dark the picture is, from 0 to 1. At 1 the scene can change the set unseen. */
  shade: number
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smooth = (value: number) => { const share = clamp(value); return share * share * (3 - 2 * share) }

// The tubes stutter and die as old tubes do. Each row is a time and the level from then on.
// No two changes are closer than 0.17 seconds: a flash is two changes, so the tubes never flash more than three times a second.
const stutter: readonly (readonly [time: number, level: number])[] = [[0, 1], [0.35, 0.55], [0.55, 1], [1.4, 0.8], [2.3, 0.5], [2.5, 0.85], [3.6, 0.6], [4.8, 0.7],
  [5, 0.18], [5.2, 0.6], [5.45, 0.08], [5.7, 0.35], [5.95, 0]]

/**
 * The scene at `age` seconds after the experiment went critical. `still` is reduced motion and Motion off:
 * no stutter, no shake, and no flash. The room goes dark once and the picture follows.
 */
export function criticalFrame(age: number, still: boolean): CriticalFrame {
  const { surge, pull, strike, flash } = criticalTimes
  const pulled = surge + pull
  const struck = pulled + strike
  const flashed = struck + flash
  if (still) return { light: age < pulled ? 1 : 0, chamber: clamp(age / pulled), pull: age < surge ? 0 : 1, shake: 0, flash: 0, shade: smooth((age - pulled) / strike) }
  let light = 1
  for (const [time, level] of stutter) if (age >= time) light = level
  return {
    light,
    chamber: smooth(age / pulled),
    pull: smooth((age - surge) / pull),
    // The shake rises with the chamber and stops when the light takes the picture.
    shake: age >= struck ? 0 : smooth(age / pulled) * (0.35 + 0.65 * smooth((age - pulled) / strike)),
    // The light rises fast, holds, and gives way to the dark.
    flash: age < struck ? 0 : smooth((age - struck) / 0.45) * (1 - smooth((age - struck - 0.8) / (flash - 0.8))),
    shade: smooth((age - struck - 0.5) / (flash - 0.5)),
  }
}

/** Seconds into the scene when the picture is fully dark. The stage asks for the cave from here. */
export const criticalDarkAt = criticalTimes.surge + criticalTimes.pull + criticalTimes.strike + criticalTimes.flash
