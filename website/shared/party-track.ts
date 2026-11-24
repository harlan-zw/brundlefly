/**
 * The celebration track: a song the presenter chooses on his own device. Its chorus hits when the cave appears.
 * This module is pure. It holds the settings, the plan of one playback, and the level of the music over time.
 * The file itself never leaves the presenter's browser. See `app/composables/usePartyTrack.ts`.
 */

/**
 * The settings of the chosen song, in seconds.
 * `chorusAt` is where the chorus starts in the file. `leadIn` is how long before the chorus the music fades in.
 * `playFor` is how long it plays at full level after the chorus hits. `fadeOut` is the fade at the end.
 */
export type PartyTrack = { name: string, chorusAt: number, bpm: number, leadIn: number, playFor: number, fadeOut: number }
type Setting = Exclude<keyof PartyTrack, 'name'>

/** The settings of a new track. The fade of 14 seconds starts when the chamber starts to spit snails. */
export const partyDefaults: Omit<PartyTrack, 'name'> = { chorusAt: 0, bpm: 110, leadIn: 14, playFor: 45, fadeOut: 8 }
/** The least and the most of each setting. Stored or typed values outside them are clamped. */
export const partyLimits: Record<Setting, { least: number, most: number }> = {
  chorusAt: { least: 0, most: 3600 },
  bpm: { least: 40, most: 240 },
  leadIn: { least: 0.5, most: 60 },
  playFor: { least: 1, most: 600 },
  fadeOut: { least: 0.5, most: 60 },
}
/** The largest file the presenter can store, in bytes. */
export const partyFileBytes = 100 * 1024 * 1024
/** The fade of a page that joins late, in seconds. */
export const lateFade = 0.5
const nameLength = 200
const settings = Object.keys(partyLimits) as Setting[]

const clampSetting = (setting: Setting, value: number) => Math.max(partyLimits[setting].least, Math.min(partyLimits[setting].most, value))

/**
 * Reads a track from stored or untrusted data. It gives `undefined` when the data has no name.
 * A missing or unreadable setting takes its default. A setting outside its limits is clamped.
 */
export function readPartyTrack(value: unknown): PartyTrack | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name.trim().slice(0, nameLength) : ''
  if (!name) return undefined
  const track: PartyTrack = { name, ...partyDefaults }
  for (const setting of settings) {
    const given = record[setting]
    if (typeof given === 'number' && !Number.isNaN(given)) track[setting] = clampSetting(setting, given)
  }
  return track
}

/**
 * One playback, as plain data. All values are in seconds.
 * Wait `startIn`, then play the file from `startAt`. The level rises over `fadeIn`, stays full for `hold`, and falls over `fadeOut`.
 */
export type PartyPlan = { startIn: number, startAt: number, fadeIn: number, hold: number, fadeOut: number }

/**
 * The plan of a playback whose chorus hits `secondsUntilHit` seconds from now.
 * The file position is `chorusAt` at the hit in every plan. When the hit is at least `lateFade` away, the fade in ends exactly at the hit.
 * The fade is shorter than `leadIn` when the hit is nearer than that, or when the chorus is nearer the start of the file.
 * When the hit is nearer than `lateFade`, or already past, the music joins at once with a fade of `lateFade`, and the end stays where it was.
 * It gives `undefined` when the full part would be over before that fade ends: then the page stays silent.
 */
export function partyPlan(track: PartyTrack, secondsUntilHit: number): PartyPlan | undefined {
  if (!Number.isFinite(secondsUntilHit)) return undefined
  const lead = Math.min(track.leadIn, track.chorusAt)
  if (secondsUntilHit >= lead) return { startIn: secondsUntilHit - lead, startAt: track.chorusAt - lead, fadeIn: lead, hold: track.playFor, fadeOut: track.fadeOut }
  if (secondsUntilHit >= lateFade) return { startIn: 0, startAt: track.chorusAt - secondsUntilHit, fadeIn: secondsUntilHit, hold: track.playFor, fadeOut: track.fadeOut }
  // The full part ends `playFor` after the hit. The join fade must end before that.
  const hold = track.playFor + secondsUntilHit - lateFade
  if (hold < 0) return undefined
  return { startIn: 0, startAt: track.chorusAt - secondsUntilHit, fadeIn: lateFade, hold, fadeOut: track.fadeOut }
}

/** Seconds from the start of playback to the end of the fade out. */
export const partyLength = (plan: PartyPlan) => plan.fadeIn + plan.hold + plan.fadeOut

// The fade out is a squared curve. Loudness follows about the 0.6th power of the level, so the loudness falls almost evenly over the whole fade.
const rise = (share: number) => share * share
// The fade in is a cubed curve. The music is a murmur under the scene for the first half of the fade, at an eighth of its level at the middle,
// and most of the rise comes in the last third, into the hit. A squared curve was heard too early. The level keeps rising until the fade ends.
const creep = (share: number) => share * share * share

/**
 * The level of the music, from 0 to 1, `sinceStart` seconds after playback started.
 * The fade in is a cubed curve and the fade out a squared one. The level is 0 before the start and after the end.
 */
export function partyLevel(plan: PartyPlan, sinceStart: number): number {
  if (!(sinceStart >= 0) || sinceStart >= partyLength(plan)) return 0
  if (sinceStart < plan.fadeIn) return creep(sinceStart / plan.fadeIn)
  const fading = sinceStart - plan.fadeIn - plan.hold
  if (fading < 0) return 1
  return rise(Math.max(0, 1 - fading / plan.fadeOut))
}

/** The level `sinceStop` seconds after a stop that fades from `level` to silence over `seconds`. It uses the same curve as the fade out. */
export function stopLevel(level: number, seconds: number, sinceStop: number): number {
  if (!(sinceStop > 0)) return level
  if (sinceStop >= seconds) return 0
  return level * rise(1 - sinceStop / seconds)
}

const plainSeconds = /^\d+(?:\.\d+)?$/
const minutesAndSeconds = /^(\d+):([0-5]\d(?:\.\d+)?)$/
/** Reads `83`, `1:23`, or `1:23.5` as seconds, rounded to the millisecond. It gives `undefined` for anything else. */
export function parseClock(text: string): number | undefined {
  const value = text.trim()
  const clock = minutesAndSeconds.exec(value)
  const [minutes, seconds] = clock ? [Number(clock[1]), Number(clock[2])] : plainSeconds.test(value) ? [0, Number(value)] : [Number.NaN, Number.NaN]
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return undefined
  return (minutes * 60_000 + Math.round(seconds * 1000)) / 1000
}

/** Writes seconds as `m:ss`, with up to three decimals when the value has them. A negative value writes as `0:00`. */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 1000)) : 0
  const minutes = Math.floor(total / 60_000)
  const rest = total - minutes * 60_000
  const whole = Math.floor(rest / 1000)
  const thousandths = rest - whole * 1000
  const fraction = thousandths ? `.${String(thousandths).padStart(3, '0').replace(/0+$/, '')}` : ''
  return `${minutes}:${String(whole).padStart(2, '0')}${fraction}`
}

/** A gap longer than this between two taps starts a new count. */
export const tapRestartMs = 2000
const leastTaps = 4

/**
 * The tempo of a run of taps, in beats per minute, rounded to a whole beat. `tapsMs` are the tap times in milliseconds, oldest first.
 * Only the taps after the last gap of more than `tapRestartMs` count. It needs at least four of them.
 * The median interval sets the tempo, so one late tap does not move it. The result is clamped to the tempo limits.
 */
export function tapTempo(tapsMs: readonly number[]): number | undefined {
  let first = 0
  for (let index = 1; index < tapsMs.length; index++) {
    const gap = tapsMs[index]! - tapsMs[index - 1]!
    if (!(gap > 0 && gap <= tapRestartMs)) first = index
  }
  const taps = tapsMs.slice(first)
  if (taps.length < leastTaps) return undefined
  const gaps = taps.slice(1).map((time, index) => time - taps[index]!).sort((a, b) => a - b)
  const middle = gaps.length / 2
  const median = gaps.length % 2 ? gaps[Math.floor(middle)]! : (gaps[middle - 1]! + gaps[middle]!) / 2
  return Math.round(clampSetting('bpm', 60_000 / median))
}

/** Beats since the chorus hit, at `bpm`. It is negative before the hit. */
export const beatAt = (bpm: number, secondsSinceHit: number) => secondsSinceHit * bpm / 60
