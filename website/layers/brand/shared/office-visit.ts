import { advanceStroll, settled } from './mascot-stroll.ts'
import type { Stroll, StrollInput } from './mascot-stroll.ts'

type VisitStage = { _tag: 'Approach' } | { _tag: 'Writing', age: number } | { _tag: 'Return' }
export type WritingVisit = { home: Stroll, walk: Stroll, stage: VisitStage }

/** Hold the round's pause while his feet carry him to the board and back. */
export function advanceOfficeVisit(stroll: Stroll, visit: WritingVisit | undefined, input: StrollInput & { writes: boolean }) {
  if (!input.writes) visit = undefined
  if (!visit && input.writes && stroll.activity._tag === 'Pausing' && stroll.activity.remaining > 0 && stroll.activity.age >= 0.3) {
    visit = { home: stroll, walk: { ...stroll, destination: 0, activity: { _tag: 'Walking' } }, stage: { _tag: 'Approach' } }
  }
  if (!visit) return { stroll: advanceStroll(stroll, input), visit: undefined, writingAge: undefined }
  const home = visit.home
  const board = [home.position[0] + 0.75, home.position[1] - 2.7] as const
  const target = visit.stage._tag === 'Return' ? home.position : board
  const walk = advanceStroll(visit.walk, { ...input, route: [target], pauses: [600] })
  let stage = visit.stage
  if (stage._tag === 'Approach' && walk.activity._tag === 'Pausing' && settled(walk)) stage = { _tag: 'Writing', age: 0 }
  else if (stage._tag === 'Writing' && input.attention === 'free') {
    const age = stage.age + input.delta
    stage = age < 6.2 ? { _tag: 'Writing', age } : { _tag: 'Return' }
    if (stage._tag === 'Return') walk.activity = { _tag: 'Walking' }
  }
  const moved = { ...walk, destination: home.destination, activity: home.activity }
  if (stage._tag === 'Return' && walk.activity._tag === 'Pausing' && settled(walk)) {
    // Finish the original pause at the actual landing position. Never snap back to its route point.
    const activity = home.activity
    return { stroll: { ...moved, activity: activity._tag === 'Pausing' ? { ...activity, remaining: 0, age: activity.duration } : activity }, visit: undefined, writingAge: undefined }
  }
  return { stroll: moved, visit: { home, walk, stage }, writingAge: stage._tag === 'Writing' ? stage.age : undefined }
}
