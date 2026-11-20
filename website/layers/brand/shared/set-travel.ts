/**
 * A journey between two sets. He leaves, the picture goes dark, the scene changes the set in the dark, and he arrives.
 * `Home` is no journey. `age` counts seconds in the current phase.
 */
export type Travel = { _tag: 'Home' } | { _tag: 'Leaving', age: number } | { _tag: 'Dark', age: number } | { _tag: 'Arriving', age: number }
export type TravelInput = {
  delta: number
  /** Reduced motion and Motion off. The journey is then a plain cut with a short dark hold: no walk and no fade. */
  still: boolean
  /** The scene has finished its work in the dark: the new set stands, or the old one stays. */
  swapped: boolean
  /** He has reached his start point in the new set. */
  settled: boolean
}

// Seconds. He walks toward the way out for `leave`, and the picture darkens over the last `fadeOut` of it.
// The dark holds for at least `hold`, or `stillHold` without motion. The picture returns over `fadeIn`.
// A journey ends when he reaches his start point, or after `arrive` at the latest.
export const travelTimes = { leave: 2.4, fadeOut: 0.9, hold: 0.3, stillHold: 0.4, fadeIn: 0.9, arrive: 5 }

export const startTravel = (travel: Travel): Travel => travel._tag === 'Home' ? { _tag: 'Leaving', age: 0 } : travel

/** Pure journey state. The dark never ends before the scene has changed the set. */
export function advanceTravel(travel: Travel, { delta, still, swapped, settled }: TravelInput): Travel {
  if (travel._tag === 'Home') return travel
  const age = travel.age + delta
  if (travel._tag === 'Leaving') return still || age >= travelTimes.leave ? { _tag: 'Dark', age: 0 } : { _tag: 'Leaving', age }
  if (travel._tag === 'Dark') return swapped && age >= (still ? travelTimes.stillHold : travelTimes.hold) ? { _tag: 'Arriving', age: 0 } : { _tag: 'Dark', age }
  return still || (settled && age >= travelTimes.fadeIn) || age >= travelTimes.arrive ? { _tag: 'Home' } : { _tag: 'Arriving', age }
}

const smooth = (value: number) => { const share = Math.max(0, Math.min(1, value)); return share * share * (3 - 2 * share) }
/** How dark the picture is, from 0 to 1. */
export const travelShade = (travel: Travel, still: boolean) =>
  travel._tag === 'Home' ? 0
    : travel._tag === 'Dark' ? 1
      : travel._tag === 'Leaving' ? (still ? 1 : smooth((travel.age - (travelTimes.leave - travelTimes.fadeOut)) / travelTimes.fadeOut))
        : still ? 0 : 1 - smooth(travel.age / travelTimes.fadeIn)
