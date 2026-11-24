import { criticalSceneSeconds } from './office-experiment.ts'

/**
 * The critical scene of the office experiment, as a timeline. Every device times it from the server's critical time, so the room sees one event.
 * `Surge`: the test chamber wakes, and the tubes dip at each green arc from here on. `Pull`: the chamber draws every specimen in. `Lull`: the room holds its breath.
 * `Spurt`: the chamber fails and spits snails over the room, whatever went in. `Strike`: the tubes go out.
 * `Flash`: the chamber's light takes the picture. `Dark`: the picture is black, and the scene changes the set behind it.
 */
// The spurt is long: the snails keep coming until they fill the room.
const lit = { surge: 1.3, pull: 3.2, lull: 0.9, spurt: 8, strike: 1.4, flash: 1.6 }
export const criticalTimes = { ...lit, dark: criticalSceneSeconds - (lit.surge + lit.pull + lit.lull + lit.spurt + lit.strike + lit.flash) }
/** Seconds into the scene when the chamber starts to spit snails. */
export const criticalSpurtAt = lit.surge + lit.pull + lit.lull
/** Seconds into the scene when the strike is over. The last arc has put the tubes out by then, and the chamber's hum stops here. */
export const criticalStruckAt = criticalSpurtAt + lit.spurt + lit.strike
/** Seconds into the scene when the picture is fully dark. The stage asks for the cave from here. */
export const criticalDarkAt = criticalStruckAt + lit.flash
/** Seconds into the scene when he leaves the chamber and runs to the computer: the snails have come for a while, and he must stop them. */
export const criticalRushAt = criticalSpurtAt + 1.8
/** Seconds into the scene when he gives up the keys and turns to the visitor. */
export const criticalAddressAt = criticalStruckAt - 1.7
/** How many times his usual pace he moves at in the scene. He runs. */
export const criticalPace = 2.3
/** He works the keys once he faces them within this many radians. */
export const keysFacingSlack = 0.35
/**
 * What he does in the scene, so he is never idle while it runs. `place` is where he stands or runs to. `work` is what his body does there:
 * `Peer`, he leans in to the chamber as it draws the specimens in. `Flinch`, it spits snails at him and his wings buzz.
 * `Type`, he hammers the keys of the computer to stop it. `Address`, he turns from the keys to the visitor.
 */
export type CriticalAct = { place: 'Chamber' | 'Computer', work: 'Peer' | 'Flinch' | 'Type' | 'Address' }
export const criticalAct = (age: number): CriticalAct =>
  age < criticalSpurtAt ? { place: 'Chamber', work: 'Peer' } : age < criticalRushAt ? { place: 'Chamber', work: 'Flinch' }
    : age < criticalAddressAt ? { place: 'Computer', work: 'Type' } : { place: 'Computer', work: 'Address' }

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

const pulled = lit.surge
const spurted = criticalSpurtAt
const struck = criticalSpurtAt + lit.spurt

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
/**
 * How much green light an arc throws on the room through its life, from 0 to 1: one pulse that holds and dies.
 * The room's light must not flash more than three times a second, and this light fills the room while the tubes are down. So it never rises twice in one arc.
 */
export const arcLight = (life: number) => life < 0 || life >= 1 ? 0 : life < 0.5 ? 1 : (1 - life) / 0.5
/** How bright the thin bolt of an arc is through its life, from 0 to 1: it strikes, dips, strikes again, and dies. The bolt is a small part of the picture. */
export const arcGlow = (life: number) => life < 0 || life >= 1 ? 0 : life < 0.14 ? 1 : life < 0.3 ? 0.25 : life < 0.6 ? 1 : (1 - life) / 0.4

// The tubes flicker with the arcs. Each arc takes them down for as long as it burns, by a share that differs from arc to arc, as old tubes do.
// Between arcs they burn lower as the chamber takes the power of the room. Each row is a time and the level from then on.
const dimming: readonly (readonly [time: number, level: number])[] = [[0, 1], [pulled, 0.85], [spurted, 0.75], [spurted + 4, 0.65]]
const dips = [0.3, 0.5, 0.2, 0.45]
// The arcs of the last phase kill the tubes: each one leaves them lower, and the last puts them out.
const firstKill = arcTimes.findIndex(time => time >= struck - 1e-9)
/** The level of the tubes. An arc is two changes of level, and arcs are never closer than 0.4 seconds, so the tubes never flash more than three times a second. */
function tubeLevel(age: number) {
  const latest = arcTimes.findLastIndex(time => time <= age)
  const left = latest < firstKill ? 1 : 1 - (latest - firstKill + 1) / (arcTimes.length - firstKill)
  const burning = latest >= 0 && age - arcTimes[latest]! < arcSeconds
  return dimming.findLast(([time]) => age >= time)![1] * left * (burning ? dips[latest % dips.length]! : 1)
}

/**
 * The scene at `age` seconds after the experiment went critical. `still` is reduced motion and Motion off:
 * no stutter, no shake, and no flash. The specimens go and the snails come at once, the room goes dark once, and the picture follows.
 */
export function criticalFrame(age: number, still: boolean): CriticalFrame {
  if (still) return { light: age < struck ? 1 : 0, chamber: clamp(age / struck), pull: age < lit.surge ? 0 : 1, spurt: age < spurted ? 0 : 1, shake: 0, flash: 0, shade: smooth((age - struck) / lit.strike) }
  const out = age - criticalStruckAt
  return {
    light: age < 0 ? 1 : tubeLevel(age),
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
