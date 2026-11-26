import { creatureKinds, specimenCount } from './office-experiment.ts'
import type { Creature, Experiment } from './office-experiment.ts'
import { criticalAddressAt, criticalRushAt, criticalSpurtAt } from './office-critical.ts'

/**
 * The office experiment as a scene for him: what he says over his head, and what his body does as he says it. COPY.md owns the lines.
 * He counts, he knows the hum of the machine, and he woke in the cave once himself. The lines say no more than that.
 * Each line has a `beat`: one of his approved gestures, by its name in the dialogue. The scene performs it as the line appears, so he never speaks with still hands.
 * A line with no beat falls in a moment where the scene already moves him. The critical scene gives him an act for every moment, so its lines have no beat: two gestures at once add up to one that is too large.
 */
export type Spoken = { text: string, beat: string }
export type TimedLine = Spoken & { at: number }

const plurals: Record<Creature, string> = { snail: 'snails', beetle: 'beetles', fly: 'flies', cricket: 'crickets' }
const capitalizedPlurals: Record<Creature, string> = { snail: 'Snails', beetle: 'Beetles', fly: 'Flies', cricket: 'Crickets' }

// The share of the target at which he speaks, what he says for the leading creature, and what he does.
const milestones: readonly { share: number, text: (count: string, lead: Creature) => string, beat: string }[] = [
  { share: 0.15, text: count => `${count}. He said it was safe last time too. Keep going.`, beat: 'He tilts his head.' },
  // He turns to the chamber: it is the thing that warms.
  {
    share: 0.25,
    text: (count, lead) => ({
      snail: `${count}. Mostly snails. He is going to be furious.`,
      fly: `${count}. Mostly flies. You people have no imagination.`,
      beetle: `${count}. Mostly beetles. He will never fit through doors.`,
      cricket: `${count}. Mostly crickets. Good luck sleeping tonight.`,
    }[lead]),
    beat: 'He looks toward the light.',
  },
  {
    share: 0.5,
    text: (_, lead) => ({
      snail: 'Halfway. All these snails. Do not shake the jar.',
      fly: 'Halfway. That many flies and he will look like me.',
      beetle: 'Halfway. Enough beetles to crush the lab bench.',
      cricket: 'Halfway. So many crickets. My small hands are rubbing.',
    }[lead]),
    beat: 'His small hands rub together.',
  },
  // The hum is the one thing he remembers of the machine. He stops to hear it.
  { share: 0.75, text: (_, lead) => `I know that hum. Too many ${plurals[lead]}. I went in alone. He is next.`, beat: 'He goes very still.' },
  // Which parts are still his: he looks at his own hand.
  {
    share: 0.9,
    text: (_, lead) => lead === 'snail'
      ? 'Nearly. Almost all snails. Decide which parts you want to keep.'
      : `Nearly. ${capitalizedPlurals[lead]} in the lead. Decide which parts you want to keep.`,
    beat: 'He checks an empty palm.',
  },
]
const firstLines: Record<Creature, { one: string, many: string }> = {
  snail: { one: 'One snail. He told you not to pick that.', many: '{count}. Snails already. He told you not to pick that.' },
  fly: { one: 'One fly. Look how well that worked out for me.', many: '{count}. Flies. Look how well that worked out for me.' },
  beetle: { one: 'One beetle. Hard shell. Terrible for lab coats.', many: '{count}. Beetles. Hard shell. Terrible for lab coats.' },
  cricket: { one: 'One cricket. Loud legs. Already a mistake.', many: '{count}. Crickets. Loud legs. Already a mistake.' },
}
const firstBeat = 'He listens to the ceiling.'
const leadShiftPool: Record<Creature, readonly string[]> = {
  snail: [
    'Snails just took the lead. He is not going to like this.',
    'Snails in front again. You were specifically warned.',
    'More snails. I hope he likes mucus.',
  ],
  fly: [
    'Flies took the lead. One of me was plenty.',
    'Back to flies. At least the wings are handy.',
    'Flies pulling ahead. Welcome to the club, doctor.',
  ],
  beetle: [
    'Beetles took the lead. Good luck with the shell.',
    'Beetles ahead again. Very shiny. Terrible posture.',
    'More beetles. He will rattle when he walks.',
  ],
  cricket: [
    'Crickets took the lead. Hope you like jumping.',
    'Crickets back in front. The ceilings in here are low.',
    'More crickets. Nobody is sleeping tonight.',
  ],
}
const tugOfWarLines: readonly ((prev: Creature, next: Creature) => string)[] = [
  (prev, next) => `${capitalizedPlurals[prev]} and ${plurals[next]} fighting for the wheel. He will come out lopsided.`,
  (_, next) => `Back to ${plurals[next]}. Make up your minds before the glass breaks.`,
  (prev, next) => `Half ${prev}, half ${next}. That is not even legal.`,
]

/** His line when the count moves from `before` to `after`, or nothing. He speaks once at the first specimen and once at each milestone, reacting to what leads. */
export function countingLine(before: number, after: number, target: number, picked: Creature = 'fly'): Spoken | undefined {
  if (after <= before || after >= target) return
  const crossed = milestones.findLast(({ share }) => before < share * target && after >= share * target)
  // He says "One" for the first specimen, and the number for any other count.
  const count = after === 1 ? 'One' : after.toLocaleString('en')
  if (crossed) return { text: crossed.text(count, picked), beat: crossed.beat }
  if (before === 0) {
    const line = after === 1 ? firstLines[picked].one : firstLines[picked].many.replace('{count}', count)
    return { text: line, beat: firstBeat }
  }
}

/**
 * His aside when a different creature overtakes the lead mid-run (between 10% and 88% of target).
 * `occurrence` is how many times `afterLead` has already taken the lead this run; `pingPong` is true when two species are trading the lead back and forth.
 */
export function leadShiftLine(beforeLead: Creature, afterLead: Creature, share: number, occurrence = 0, pingPong = false): Spoken | undefined {
  if (beforeLead === afterLead || share < 0.1 || share >= 0.88) return
  if (pingPong) {
    const line = tugOfWarLines[occurrence % tugOfWarLines.length]!
    return { text: line(beforeLead, afterLead), beat: 'He tilts his head.' }
  }
  const variants = leadShiftPool[afterLead]
  return { text: variants[occurrence % variants.length]!, beat: 'He leans closer.' }
}

/** Overhead greeting after turning the office lights on at the start of `/projector?show` (the entrance plays his Greet gesture, so `beat` stays empty). */
export const showGreetingLine: Spoken = { text: 'Oh. Hello. Welcome to the Virtual Lab. Do not touch the chamber.', beat: '' }

/**
 * His lines in the critical scene, in seconds after the experiment went critical. `criticalAct` in the timeline moves him between them:
 * he runs to the chamber and leans in, flinches as it spits snails, runs to the computer and hammers its keys, and at the end turns to the visitor.
 */
export const criticalLines: readonly TimedLine[] = [
  { at: 0.2, text: 'That is the number. Hold still, doctor.', beat: '' },
  { at: criticalSpurtAt + 0.8, text: 'Uh oh. Those are all snails. That is not right.', beat: '' },
  // He is at the keys by now, and they do nothing.
  { at: criticalRushAt + 2.6, text: 'It is not stopping. Too many snails.', beat: '' },
  // He gives up the keys and says the last thing to the visitor's face.
  { at: criticalAddressAt + 0.2, text: 'You will remember the hum. Welcome to the 18th Dimension.', beat: '' },
]

/** The creature with the most specimens. A tie goes to the first in the order of the counter's keys. */
export const leadingCreature = (experiment: Experiment): Creature =>
  creatureKinds.reduce((lead, kind) => experiment.tally[kind] > experiment.tally[lead] ? kind : lead)
/** The creature with the most specimens, as the word for many of it. */
export const leadingPlural = (experiment: Experiment) => plurals[leadingCreature(experiment)]

/** His lines in the cave after the experiment, in seconds after the visitor sees the cave. Whatever went in, snails came out, and he acknowledges the bait-and-switch when another species won. */
export function caveLines(experiment: Experiment): readonly TimedLine[] {
  const count = specimenCount(experiment)
  // The presenter can send an empty run critical. He then has no count to report.
  const report = count === 0 ? '' : count === 1 ? 'One specimen went in. ' : `${count.toLocaleString('en')} specimens went in. `
  const lead = leadingCreature(experiment)
  const outcome = count > 0 && lead !== 'snail'
    ? `You voted ${plurals[lead]}. Snails came out anyway. Dance.`
    : 'Snails came out. Peak Earthling talent. Dance.'
  // He dances through the first line. For the second he leans to the visitor: it is their turn.
  return [{ at: 1, text: 'Show me what you got, doctor.', beat: '' }, { at: 6, text: `${report}${outcome}`, beat: 'He leans closer.' }]
}

/** Seconds a line stays over his head. A longer line stays longer. */
export const lineSeconds = (text: string) => Math.max(3.2, Math.min(7, text.length * 0.075))
