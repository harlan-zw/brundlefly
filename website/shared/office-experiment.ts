/**
 * The office experiment. Every visitor in the office shares one specimen counter.
 * A tap on a creature adds one specimen. At the target the experiment goes critical, once, for everyone.
 * The server owns the state and sends all of it in every message, so a late or reconnecting visitor needs nothing else.
 */
export const creatures = { snail: '🐌', beetle: '🪲', fly: '🪰', cricket: '🦗' } as const
export type Creature = keyof typeof creatures
export const creatureKinds = Object.keys(creatures) as Creature[]
export type Tally = Record<Creature, number>

export type Experiment = {
  /** Counts up on every reset. A visitor who sees a new run clears the specimens of the old one. */
  run: number
  /** Accepted taps for each creature. One tap is one specimen. */
  tally: Tally
  /** The specimen count at which the experiment goes critical. */
  target: number
  /** Server time when the count reached the target. Every device times the critical scene from it. */
  criticalAt: number | null
}

export const targetLimits = { least: 50, most: 20000, initial: 3000 }
/** The most taps one visitor can add in one second. Faster input is dropped, never queued. */
export const tapsPerSecond = 20
/** Seconds from critical to the cave. A visitor who joins later goes straight to the cave. */
export const criticalSceneSeconds = 9.5

const emptyTally = (): Tally => ({ snail: 0, beetle: 0, fly: 0, cricket: 0 })
export const emptyExperiment = (run = 0, target = targetLimits.initial): Experiment => ({ run, tally: emptyTally(), target, criticalAt: null })
export const specimenCount = (experiment: Experiment) => creatureKinds.reduce((sum, kind) => sum + experiment.tally[kind], 0)
/** The share of the target that is loaded, as a whole percent. It reads 100 only at the target. */
export const loadedPercent = (experiment: Experiment) => Math.min(100, Math.floor(100 * specimenCount(experiment) / experiment.target))
const clampTarget = (value: number) => Math.max(targetLimits.least, Math.min(targetLimits.most, Math.round(value)))

/** `Quiet` has no specimens. `Counting` takes taps. `Critical` plays the scene. `Over` waits for a reset. */
export type Phase = 'Quiet' | 'Counting' | 'Critical' | 'Over'
export function phase(experiment: Experiment, now: number): Phase {
  if (experiment.criticalAt !== null) return now - experiment.criticalAt < criticalSceneSeconds * 1000 ? 'Critical' : 'Over'
  return specimenCount(experiment) > 0 ? 'Counting' : 'Quiet'
}

/** Add `taps` specimens of one creature. The count stops at the target, and the tap that reaches it sets the critical time. */
export function addTaps(experiment: Experiment, kind: Creature, taps: number, now: number): Experiment {
  if (experiment.criticalAt !== null) return experiment
  const accepted = Math.min(Math.max(0, Math.floor(taps)), experiment.target - specimenCount(experiment))
  if (accepted <= 0) return experiment
  const next = { ...experiment, tally: { ...experiment.tally, [kind]: experiment.tally[kind] + accepted } }
  return specimenCount(next) >= next.target ? { ...next, criticalAt: now } : next
}

/** A new run with no specimens. The target stays. */
export const resetExperiment = (experiment: Experiment): Experiment => emptyExperiment(experiment.run + 1, experiment.target)

/** Change the target of a run that still counts. A target at or under the count sends the run critical at once. */
export function setTarget(experiment: Experiment, value: number, now: number): Experiment {
  if (experiment.criticalAt !== null) return experiment
  const target = clampTarget(value)
  return { ...experiment, target, criticalAt: specimenCount(experiment) >= target ? now : null }
}

/** The presenter's override: the run goes critical now, at the count it has. The target stays, so the next run keeps it. */
export const goCritical = (experiment: Experiment, now: number): Experiment =>
  experiment.criticalAt !== null ? experiment : { ...experiment, criticalAt: now }

export type Command =
  | { op: 'tap', kind: Creature, taps: number }
  | { op: 'reset' }
  | { op: 'target', value: number }
  | { op: 'critical' }
/** `connected` counts the visitors in the office. `now` is server time, for the offset of the visitor's clock. */
export type RoomMessage = { op: 'state', experiment: Experiment, connected: number, now: number }

/** Parse one message from a visitor. Anything else gives nothing. */
export function readCommand(message: string): Command | undefined {
  if (message.length > 200) return
  let data: unknown
  try { data = JSON.parse(message) }
  catch { return } // Wire input that is not JSON is no command.
  if (!data || typeof data !== 'object' || !('op' in data)) return
  if (data.op === 'reset' || data.op === 'critical') return { op: data.op }
  if (data.op === 'target' && 'value' in data && typeof data.value === 'number' && Number.isFinite(data.value)) return { op: 'target', value: clampTarget(data.value) }
  if (data.op === 'tap' && 'kind' in data && typeof data.kind === 'string' && Object.hasOwn(creatures, data.kind)
    && 'taps' in data && Number.isInteger(data.taps) && (data.taps as number) >= 1 && (data.taps as number) <= tapsPerSecond)
    return { op: 'tap', kind: data.kind as Creature, taps: data.taps as number }
}

const count = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0
/** Parse an experiment from the wire or from storage. Anything else gives nothing. */
export function readExperiment(value: unknown): Experiment | undefined {
  if (!value || typeof value !== 'object') return
  const { run, tally, target, criticalAt } = value as Partial<Experiment>
  if (!count(run) || !count(target) || (criticalAt !== null && typeof criticalAt !== 'number')) return
  if (!tally || typeof tally !== 'object' || !creatureKinds.every(kind => count(tally[kind]))) return
  return { run, target, criticalAt, tally: { snail: tally.snail, beetle: tally.beetle, fly: tally.fly, cricket: tally.cricket } }
}

/** Parse one message from the server. Anything else gives nothing. */
export function readRoomMessage(message: string): RoomMessage | undefined {
  let data: unknown
  try { data = JSON.parse(message) }
  catch { return } // Wire input that is not JSON is no message.
  if (!data || typeof data !== 'object' || !('op' in data) || data.op !== 'state') return
  const { experiment, connected, now } = data as { experiment?: unknown, connected?: unknown, now?: unknown }
  const read = readExperiment(experiment)
  if (!read || !count(connected) || typeof now !== 'number') return
  return { op: 'state', connected, now, experiment: read }
}
