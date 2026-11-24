import { creatureKinds, specimenCount } from './office-experiment.ts'
import type { Creature, Experiment } from './office-experiment.ts'
import { criticalAddressAt, criticalRushAt, criticalSpurtAt } from './office-critical.ts'

/**
 * The office experiment as a scene for him: what he says over his head, and what his body does as he says it. COPY.md owns the lines.
 * He counts, he knows the hum of the machine, and he woke in the cave once himself. The lines say no more than that.
 * Each line has a `beat`: one of his approved gestures, by its name in the dialogue. The scene performs it as the line appears, so he never speaks with still hands.
 * A line with no beat falls in a moment where the scene already moves him: he runs, he types, or he dances.
 */
export type Spoken = { text: string, beat: string }
export type TimedLine = Spoken & { at: number }

// The share of the target at which he speaks, what he says, and what he does. `{count}` is the specimen count at that moment.
const milestones: readonly (readonly [share: number, text: string, beat: string])[] = [
  // He turns to the chamber: it is the thing that warms.
  [0.25, '{count}. The chamber is warming up.', 'He looks toward the light.'],
  [0.5, 'Halfway. My small hands are rubbing. Ignore them.', 'His small hands rub together.'],
  // The hum is the one thing he remembers of the machine. He stops to hear it.
  [0.75, 'I know that hum. I went in alone.', 'He goes very still.'],
  // Which parts are still his: he looks at his own hand.
  [0.9, 'Nearly. Decide which parts you want to keep.', 'He checks an empty palm.'],
]
// The first state of a run can hold more than one specimen, so he says the count he has. He looks up: they fall from the ceiling.
const first = { text: '{count}. I count things now. Keep going.', beat: 'He listens to the ceiling.' }

/** His line when the count moves from `before` to `after`, or nothing. He speaks once at the first specimen and once at each milestone. */
export function countingLine(before: number, after: number, target: number): Spoken | undefined {
  if (after <= before || after >= target) return
  const crossed = milestones.findLast(([share]) => before < share * target && after >= share * target)
  // He says "One" for the first specimen, and the number for any other count.
  const count = after === 1 ? 'One' : after.toLocaleString('en')
  if (crossed) return { text: crossed[1].replace('{count}', count), beat: crossed[2] }
  if (before === 0) return { text: first.text.replace('{count}', count), beat: first.beat }
}

/**
 * His lines in the critical scene, in seconds after the experiment went critical. `criticalAct` in the timeline moves him between them:
 * he runs to the chamber and leans in, flinches as it spits snails, runs to the computer and hammers its keys, and at the end turns to the visitor.
 */
export const criticalLines: readonly TimedLine[] = [
  { at: 0.2, text: 'That is the number. Hold still.', beat: '' },
  { at: criticalSpurtAt + 0.8, text: 'Uh oh. That is not right.', beat: 'His wings buzz once.' },
  // He is at the keys by now, and they do nothing.
  { at: criticalRushAt + 2.6, text: 'It is not stopping.', beat: '' },
  // He gives up the keys and says the last thing to the visitor's face.
  { at: criticalAddressAt + 0.2, text: 'You will remember the hum. Little else.', beat: 'He leans closer.' },
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
  // He dances through the first line. For the second he leans to the visitor: it is their turn.
  return [{ at: 1, text: 'There you are. You woke up. Good.', beat: '' }, { at: 6, text: `${report}Snails came out. Your turn.`, beat: 'He leans closer.' }]
}

/** Seconds a line stays over his head. A longer line stays longer. */
export const lineSeconds = (text: string) => Math.max(3.2, Math.min(7, text.length * 0.075))
