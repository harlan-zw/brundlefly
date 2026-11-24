import { criticalSceneSeconds } from './office-experiment.ts'

/**
 * The critical scene of the office experiment, as a timeline. Every device times it from the server's critical time, so the room sees one event.
 * `Surge`: the test chamber wakes and the tubes stutter. `Pull`: the chamber draws every specimen in. `Lull`: the room holds its breath.
 * `Spurt`: the chamber fails and spits snails over the room, whatever went in. `Strike`: the tubes go out.
 * `Flash`: the chamber's light takes the picture. `Dark`: the picture is black, and the scene changes the set behind it.
 */
// The spurt is long: the snails keep coming until they fill the room.
const lit = { surge: 1.3, pull: 3.2, lull: 0.9, spurt: 8, strike: 1.4, flash: 1.6 }
export const criticalTimes = { ...lit, dark: criticalSceneSeconds - (lit.surge + lit.pull + lit.lull + lit.spurt + lit.strike + lit.flash) }
/** Seconds into the scene when the chamber starts to spit snails. */
export const criticalSpurtAt = lit.surge + lit.pull + lit.lull
/** Seconds into the scene when the last tube is out. The chamber's hum stops here. */
export const criticalStruckAt = criticalSpurtAt + lit.spurt + lit.strike
/** Seconds into the scene when the picture is fully dark. The stage asks for the cave from here. */
export const criticalDarkAt = criticalStruckAt + lit.flash
/** Seconds of the scene that a visitor at the computer stays there. Its screen fails, and then the view returns to the room. */
export const crashSeconds = 1.3

export type CriticalFrame = {
  /** The level of the room's tubes, from 0 to 1. */
  light: number
  /** How bright the test chamber burns behind its window, from 0 to 1. */
  chamber: number
  /** How far the chamber has drawn the specimens in, from 0 to 1. */
  pull: number
  /** How many of its snails the chamber has spat out, from 0 to 1. */
  spurt: number
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
// No two changes are closer than 0.2 seconds: a flash is two changes, so the tubes never flash more than three times a second.
const pulled = lit.surge
const spurted = criticalSpurtAt
const struck = criticalSpurtAt + lit.spurt
const stutter: readonly (readonly [time: number, level: number])[] = [[0, 1], [0.35, 0.55], [0.55, 1],
  [pulled + 0.1, 0.8], [pulled + 1, 0.5], [pulled + 1.2, 0.85], [pulled + 2.3, 0.6], [pulled + lit.pull, 0.75],
  // The room jumps as the chamber spits.
  [spurted, 0.95], [spurted + 0.25, 0.45], [spurted + 0.5, 0.8], [spurted + 1.6, 0.55], [spurted + 1.85, 0.8], [spurted + 3, 0.6],
  [spurted + 4.2, 0.75], [spurted + 5.4, 0.5], [spurted + 5.65, 0.8], [spurted + 6.8, 0.55],
  [struck + 0.2, 0.18], [struck + 0.4, 0.6], [struck + 0.65, 0.08], [struck + 0.9, 0.35], [struck + 1.15, 0]]

/**
 * The scene at `age` seconds after the experiment went critical. `still` is reduced motion and Motion off:
 * no stutter, no shake, and no flash. The specimens go and the snails come at once, the room goes dark once, and the picture follows.
 */
export function criticalFrame(age: number, still: boolean): CriticalFrame {
  if (still) return { light: age < struck ? 1 : 0, chamber: clamp(age / struck), pull: age < lit.surge ? 0 : 1, spurt: age < spurted ? 0 : 1, shake: 0, flash: 0, shade: smooth((age - struck) / lit.strike) }
  let light = 1
  for (const [time, level] of stutter) if (age >= time) light = level
  const out = age - criticalStruckAt
  return {
    light,
    chamber: smooth(age / (lit.surge + lit.pull)),
    pull: smooth((age - lit.surge) / lit.pull),
    spurt: clamp((age - spurted) / lit.spurt),
    // The shake rises with the chamber, eases in the lull, jumps with the snails, and stops when the light takes the picture.
    shake: out >= 0 ? 0 : age < spurted ? smooth(age / (lit.surge + lit.pull)) * 0.35 * (1 - 0.6 * smooth((age - lit.surge - lit.pull) / lit.lull))
      : 0.5 + 0.5 * smooth((age - struck) / lit.strike),
    // The light rises fast, holds, and gives way to the dark.
    flash: out < 0 ? 0 : smooth(out / 0.45) * (1 - smooth((out - 0.9) / (lit.flash - 0.9))),
    shade: smooth((out - 0.6) / (lit.flash - 0.6)),
  }
}

/**
 * Green arcs leap from the chamber while the scene runs: something has gone very wrong in there.
 * Each arc is one strike. `index` picks where it lands, the same on every device. `life` runs from 0 to 1 over the arc's short time.
 */
export type CriticalArc = { index: number, life: number }
/** Seconds one arc lasts. */
export const arcSeconds = 0.28
// The strikes come faster as the scene goes on. They are never closer than 0.4 seconds, so the room never flashes more than three times a second.
const arcTimes: readonly number[] = (() => {
  const times: number[] = []
  for (let time = 0.5; time < criticalStruckAt; time += time < spurted ? 0.95 : time < struck ? 0.6 : 0.4) times.push(time)
  return times
})()
/** The number of arcs in the whole scene. */
export const arcCount = arcTimes.length
/** The arc that burns at `age` seconds into the scene, or nothing. Reduced motion has no arcs. */
export function criticalArc(age: number, still: boolean): CriticalArc | undefined {
  if (still) return
  const index = arcTimes.findLastIndex(time => time <= age)
  if (index < 0 || age - arcTimes[index]! >= arcSeconds) return
  return { index, life: (age - arcTimes[index]!) / arcSeconds }
}
/** How bright an arc is through its life, from 0 to 1: it strikes, dips, strikes again, and dies. */
export const arcGlow = (life: number) => life < 0 || life >= 1 ? 0 : life < 0.14 ? 1 : life < 0.3 ? 0.25 : life < 0.6 ? 1 : (1 - life) / 0.4
