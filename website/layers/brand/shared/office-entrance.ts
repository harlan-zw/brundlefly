/**
 * The entrance to the office. A visitor who loads the office finds it dark: only the things with their own light show, and he is a faint shape.
 * He stands for a moment, walks to the switch by the door, and reaches for it. The tubes strike, and he turns to the visitor and greets them.
 * `Lit` is no entrance: the room as it stands at every other time. `age` counts seconds in the current phase.
 * `Hurrying` is the short way to `Lit`: the visitor asked for him in the dark, so the light rises at once from the level `from`.
 */
export type Entrance =
  | { _tag: 'Dark', age: number }
  | { _tag: 'Walking', age: number }
  | { _tag: 'Reaching', age: number }
  | { _tag: 'Striking', age: number }
  | { _tag: 'Greeting', age: number }
  | { _tag: 'Hurrying', age: number, from: number }
  | { _tag: 'Lit' }

export type EntranceStart = {
  /** The set that stands has an entrance: a switch, and a place for him in the dark. */
  offered: boolean
  /** How the visitor came to the set. `Load` is a page load of its address. `Travel` is a journey from another set. */
  arrival: 'Load' | 'Travel'
  /** This browser session has shown the entrance before. */
  seen: boolean
  /** Reduced motion and Motion off. He cannot walk to the switch, so the room starts lit. */
  still: boolean
  /** The mascot on show can walk. One that cannot starts in a lit room. */
  walks: boolean
}

export type EntranceInput = {
  delta: number
  /** He stands at the switch. */
  arrived: boolean
  /** The visitor asked for him, or left for another set. The entrance ends at once and never holds them up. */
  skip: boolean
  /** Reduced motion and Motion off. */
  still: boolean
}

// Seconds. He stands in the dark for `hold`. He walks to the switch for `walk` at the most: a walk that something holds up ends there.
// His hand rises for `reach`, and the tubes strike over `strike`. He turns and greets for `greet`. A skipped entrance takes `hurry` to full light.
export const entranceTimes = { hold: 1, walk: 3.2, reach: 0.55, strike: 0.7, greet: 2.6, hurry: 0.3 }

/** The longest the room stays short of full light, from the first frame, in seconds. */
export const entranceDarkLimit = entranceTimes.hold + entranceTimes.walk + entranceTimes.reach + entranceTimes.strike

/** The room is dark only for the first page load of the office in a browser session, and only for a mascot that can walk to the switch. */
export const startEntrance = ({ offered, arrival, seen, still, walks }: EntranceStart): Entrance =>
  offered && arrival === 'Load' && !seen && !still && walks ? { _tag: 'Dark', age: 0 } : { _tag: 'Lit' }

// The tubes strike as old tubes do: a flash that dies, a brighter one that sags, and then they hold.
// Each row is a time in the strike and the level from then on. Five changes of level in the strike are two flashes, under the three a second that the failing tube keeps to.
export const strikeLevels: readonly (readonly [time: number, level: number])[] = [[0, 0.45], [0.08, 0.06], [0.27, 0.7], [0.37, 0.22], [0.58, 1]]

const smooth = (value: number) => { const share = Math.max(0, Math.min(1, value)); return share * share * (3 - 2 * share) }

/** How bright the room's tubes are, from 0 to 1. */
export function entranceLight(entrance: Entrance): number {
  if (entrance._tag === 'Lit' || entrance._tag === 'Greeting') return 1
  if (entrance._tag === 'Hurrying') return entrance.from + (1 - entrance.from) * smooth(entrance.age / entranceTimes.hurry)
  if (entrance._tag !== 'Striking') return 0
  let level = 0
  for (const [time, value] of strikeLevels) if (entrance.age >= time) level = value
  return level
}

/**
 * Pure entrance state. Each phase has a time limit, so the room is fully lit within `entranceDarkLimit` whatever he does.
 * Time left over from a phase carries into the next, so the limit holds for every frame rate.
 */
export function advanceEntrance(entrance: Entrance, { delta, arrived, skip, still }: EntranceInput): Entrance {
  if (entrance._tag === 'Lit') return entrance
  if (still) return { _tag: 'Lit' }
  if (skip && entrance._tag !== 'Hurrying') {
    const from = entranceLight(entrance)
    return from >= 1 ? { _tag: 'Lit' } : { _tag: 'Hurrying', age: 0, from }
  }
  const age = entrance.age + Math.max(0, delta)
  if (entrance._tag === 'Dark') return age >= entranceTimes.hold ? { _tag: 'Walking', age: age - entranceTimes.hold } : { _tag: 'Dark', age }
  // He reaches from where he stands when the walk has run out of time.
  if (entrance._tag === 'Walking') return arrived ? { _tag: 'Reaching', age: 0 } : age >= entranceTimes.walk ? { _tag: 'Reaching', age: age - entranceTimes.walk } : { _tag: 'Walking', age }
  if (entrance._tag === 'Reaching') return age >= entranceTimes.reach ? { _tag: 'Striking', age: age - entranceTimes.reach } : { _tag: 'Reaching', age }
  if (entrance._tag === 'Striking') return age >= entranceTimes.strike ? { _tag: 'Greeting', age: age - entranceTimes.strike } : { _tag: 'Striking', age }
  if (entrance._tag === 'Greeting') return age >= entranceTimes.greet ? { _tag: 'Lit' } : { _tag: 'Greeting', age }
  return age >= entranceTimes.hurry ? { _tag: 'Lit' } : { ...entrance, age }
}

/** What he does in a phase, for the scene that moves him. */
export type EntranceAct = {
  /** He walks toward the switch, or stands at it. False once he is free to take up his walk. */
  held: boolean
  /** He faces the switch while he stands at it. After the strike he turns to the visitor. */
  facesSwitch: boolean
  /** Seconds since his hand began to rise to the switch. */
  reach: number | undefined
  /** Seconds since he began to greet the visitor. He turns to them first, so the gesture starts after `turn`. */
  greet: number | undefined
  /** He looks at the visitor: in the dark, where his eyes are the first thing they see, and when he greets them. */
  watches: boolean
}

// Seconds of the greeting that his turn to the visitor takes, before the gesture.
const turnToVisitor = 0.9

export function entranceAct(entrance: Entrance): EntranceAct {
  const tag = entrance._tag
  const held = tag === 'Dark' || tag === 'Walking' || tag === 'Reaching' || tag === 'Striking' || tag === 'Greeting'
  const reach = tag === 'Reaching' ? entrance.age : tag === 'Striking' ? entranceTimes.reach + entrance.age
    : tag === 'Greeting' ? entranceTimes.reach + entranceTimes.strike + entrance.age : undefined
  return { held, facesSwitch: tag === 'Walking' || tag === 'Reaching' || tag === 'Striking', reach,
    greet: tag === 'Greeting' ? entrance.age - turnToVisitor : undefined, watches: tag === 'Dark' || tag === 'Greeting' }
}
