import type { SetName } from '../layers/brand/shared/scene-set.ts'
import { travelTimes } from '../layers/brand/shared/set-travel.ts'

/** The sound of a place: its steady layers, its events, and its room response. */
export type Ambience = 'Cave' | 'Office'

// Each set names its ambience. A new set does not compile until it names one.
const ambiences: Record<SetName, Ambience> = { lair: 'Cave', office: 'Office' }
export const ambienceForSet = (set: SetName) => ambiences[set]

/**
 * A cross-fade from one ambience to another. `start` is audio time in seconds, and `lead` is the progress the fade starts with.
 * A fade whose two ends are the same ambience is at rest.
 */
export type AmbienceFade = { from: Ambience, to: Ambience, start: number, duration: number, lead: number }

// The sound changes over the time the picture takes to return. It starts when the scene has changed the set, in the dark.
export const ambienceFadeSeconds = travelTimes.fadeIn

export const restingFade = (ambience: Ambience): AmbienceFade => ({ from: ambience, to: ambience, start: 0, duration: 0, lead: 1 })

/** How far a fade has gone, from 0 to 1. */
export function fadeProgress(fade: AmbienceFade, time: number) {
  if (fade.from === fade.to || fade.duration <= 0) return 1
  return Math.max(0, Math.min(1, fade.lead + (time - fade.start) / fade.duration))
}

/** The audio time at which a fade is complete. */
export const fadeEnd = (fade: AmbienceFade) => fade.from === fade.to ? fade.start : fade.start + (1 - fade.lead) * fade.duration

/**
 * The share of its full level that each ambience plays at, from 0 to 1.
 * The two shares keep equal power, so two unrelated sounds never sum above the louder one.
 */
export function ambienceShares(fade: AmbienceFade, time: number): Partial<Record<Ambience, number>> {
  const progress = fadeProgress(fade, time)
  if (progress >= 1) return { [fade.to]: 1 }
  return { [fade.from]: Math.cos(progress * Math.PI / 2), [fade.to]: Math.sin(progress * Math.PI / 2) }
}

/**
 * Turns the sound toward an ambience. A fade that turns back starts from where the sound is, so it takes less time and makes no jump.
 * A turn to a third ambience in the middle of a fade drops what is left of the first. The site has two ambiences, so this cannot occur today.
 */
export function turnFade(fade: AmbienceFade, to: Ambience, time: number, duration = ambienceFadeSeconds): AmbienceFade {
  if (to === fade.to) return fade
  const progress = fadeProgress(fade, time)
  return { from: fade.to, to, start: time, duration, lead: to === fade.from ? 1 - progress : 0 }
}

/** The scene's clock, as the audio hears it. `rate` is scene seconds for each audio second: a slow device runs the scene slower. */
export type SceneClock = { scene: number, audio: number, rate: number }

/** Takes a report of scene time. Two reports give the rate. The scene never runs ahead of the audio, so a report that jumps, goes backward, or comes after a long gap starts again at rate 1. */
export function syncSceneClock(clock: SceneClock | undefined, scene: number, audio: number): SceneClock {
  const span = clock ? audio - clock.audio : 0
  const rate = clock && span > 0.05 && span < 3 ? (scene - clock.scene) / span : 1
  return { scene, audio, rate: rate > 0 && rate < 1.2 ? Math.max(0.1, rate) : 1 }
}
export const sceneTimeAt = (clock: SceneClock, audio: number) => clock.scene + (audio - clock.audio) * clock.rate
export const audioTimeAt = (clock: SceneClock, scene: number) => clock.audio + (scene - clock.scene) / clock.rate
// The scene reports its time twice a second while it moves. A clock with no report for this long stands still.
export const sceneClockRuns = (clock: SceneClock | undefined, audio: number): clock is SceneClock => clock !== undefined && audio - clock.audio < 1.6
