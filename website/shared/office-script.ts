import { creatureKinds, specimenCount } from './office-experiment.ts'
import type { Creature, Experiment } from './office-experiment.ts'
import { criticalSpurtAt, criticalStruckAt } from './office-critical.ts'

/**
 * What Brundlefly says over his head during the office experiment. COPY.md owns these lines.
 * He counts, he knows the hum of the machine, and he woke in the cave once himself. The lines say no more than that.
 */
export type TimedLine = { at: number, text: string }

// The share of the target at which he speaks, and what he says. `{count}` is the specimen count at that moment.
const milestones: readonly (readonly [share: number, text: string])[] = [
  [0.25, '{count}. The chamber is warming up.'],
  [0.5, 'Halfway. My small hands are rubbing. Ignore them.'],
  [0.75, 'I know that hum. I went in alone.'],
  [0.9, 'Nearly. Decide which parts you want to keep.'],
]
// The first state of a run can hold more than one specimen, so he says the count he has.
const first = '{count}. I count things now. Keep going.'

/** His line when the count moves from `before` to `after`, or nothing. He speaks once at the first specimen and once at each milestone. */
export function countingLine(before: number, after: number, target: number): string | undefined {
  if (after <= before || after >= target) return
  const crossed = milestones.findLast(([share]) => before < share * target && after >= share * target)
  // He says "One" for the first specimen, and the number for any other count.
  const count = after === 1 ? 'One' : after.toLocaleString('en')
  if (crossed) return crossed[1].replace('{count}', count)
  if (before === 0) return first.replace('{count}', count)
}

/** His lines in the critical scene, in seconds after the experiment went critical. The second comes as the chamber spits snails. */
export const criticalLines: readonly TimedLine[] = [
  { at: 0.2, text: 'That is the number. Hold still.' },
  { at: criticalSpurtAt + 0.8, text: 'Uh oh. That is not right.' },
  { at: criticalSpurtAt + 4.6, text: 'It is not stopping.' },
  { at: criticalStruckAt - 1.6, text: 'You will remember the hum. Little else.' },
]

const plurals: Record<Creature, string> = { snail: 'snails', beetle: 'beetles', fly: 'flies', cricket: 'crickets' }
/** The creature with the most specimens. A tie goes to the first in the order of the counter's keys. */
export const leadingCreature = (experiment: Experiment): Creature =>
  creatureKinds.reduce((lead, kind) => experiment.tally[kind] > experiment.tally[lead] ? kind : lead)
/** The creature with the most specimens, as the word for many of it. */
export const leadingPlural = (experiment: Experiment) => plurals[leadingCreature(experiment)]

/** His lines in the cave after the experiment, in seconds after the visitor sees the cave. Whatever went in, snails came out. */
export function caveLines(experiment: Experiment): readonly TimedLine[] {
  const count = specimenCount(experiment)
  // The presenter can send an empty run critical. He then has no count to report.
  const report = count === 0 ? '' : count === 1 ? 'One specimen went in. ' : `${count.toLocaleString('en')} specimens went in. `
  return [{ at: 1, text: 'There you are. You woke up. Good.' }, { at: 6, text: `${report}Snails came out. Your turn.` }]
}

/** Seconds a line stays over his head. A longer line stays longer. */
export const lineSeconds = (text: string) => Math.max(3.2, Math.min(7, text.length * 0.075))
