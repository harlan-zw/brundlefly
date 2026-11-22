export const creatures = { snail: '🐌', beetle: '🪲', fly: '🪰', cricket: '🦗' } as const
export type Creature = keyof typeof creatures
export const warning = 200
export const critical = 800
export const voteIntervalMs = 2000
export const calibrationMs = 3000
export const blackoutMs = 6000
export type Drop = { id: string, kind: Creature, at: number, first: number, size: number }
export type Run = { id: string, drops: Drop[] }
export type Station = 'board' | 'computer' | 'desk'
export const emptyRun = (id: string): Run => ({ id, drops: [] })
export const specimenCount = (run: Run | null) => {
  const last = run?.drops.at(-1)
  return last ? last.first + last.size - 1 : 0
}
export function phase(run: Run | null, now: number) {
  if (!run) return 'idle'
  const first = run.drops[0]
  if (!first) return 'lobby'
  if (now < first.at + calibrationMs) return 'calibration'
  if (specimenCount(run) < critical) return 'running'
  return now < run.drops.at(-1)!.at + blackoutMs ? 'critical' : 'awake'
}
export function release(run: Run, kind: Creature, id: string, host: boolean, at: number): Run {
  const stage = phase(run, at)
  if (stage !== 'running' && !(stage === 'lobby' && host && kind === 'snail')) return run
  if (run.drops.some(drop => drop.id === id)) return run
  const count = specimenCount(run)
  const size = Math.min(count >= warning ? 6 : 1, critical - count)
  return { ...run, drops: [...run.drops, { id, kind, at, first: count + 1, size }] }
}

export function voteTotals(run: Run | null): Record<Creature, number> {
  const totals = { snail: 0, beetle: 0, fly: 0, cricket: 0 }
  for (const drop of run?.drops.slice(1) ?? []) totals[drop.kind]++
  return totals
}

export type Command = { op: 'host', key: string } | { op: 'open' } | { op: 'close', run: string }
  | { op: 'tap', run: string, id: string, kind: Creature }
export type RoomMessage = { op: 'snapshot', run: Run | null, connected: number, now: number }
  | { op: 'presence', connected: number } | { op: 'drop', run: string, drop: Drop }
  | { op: 'host' } | { op: 'error', message: string }
const token = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,80}$/.test(value)
export function readCommand(message: string): Command | undefined {
  if (message.length > 512) return
  let data: unknown
  try { data = JSON.parse(message) } catch { return } // Invalid wire input.
  if (!data || typeof data !== 'object' || !('op' in data)) return
  if (data.op === 'open') return { op: 'open' }
  if (data.op === 'host' && 'key' in data && typeof data.key === 'string' && data.key.length > 0) return { op: 'host', key: data.key }
  if (!('run' in data) || !token(data.run)) return
  if (data.op === 'close') return { op: 'close', run: data.run }
  if (data.op === 'tap' && 'kind' in data && typeof data.kind === 'string' && Object.hasOwn(creatures, data.kind)
    && 'id' in data && token(data.id)) return { op: 'tap', kind: data.kind as Creature, run: data.run, id: data.id }
}
