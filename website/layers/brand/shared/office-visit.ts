import { advanceStroll, settled } from './mascot-stroll.ts'
import type { Stroll, StrollInput } from './mascot-stroll.ts'
import type { OfficePlan } from './office-layout.ts'

type VisitStage = { _tag: 'Approach', waypoint: number } | { _tag: 'Writing', age: number } | { _tag: 'Return', waypoint: number }
export type WritingVisit = { home: Stroll, walk: Stroll, stage: VisitStage }

/** Hold the round's pause while his feet follow the planned aisle to the board and back. */
export function advanceOfficeVisit(stroll: Stroll, visit: WritingVisit | undefined, input: StrollInput & { writes: boolean, writing: OfficePlan['writing'] }) {
  if (!input.writes) visit = undefined
  if (!visit && input.writes && stroll.activity._tag === 'Pausing' && stroll.activity.remaining > 0 && stroll.activity.age >= 0.3) {
    visit = { home: stroll, walk: { ...stroll, destination: 0, activity: { _tag: 'Walking' } }, stage: { _tag: 'Approach', waypoint: 0 } }
  }
  if (!visit) return { stroll: advanceStroll(stroll, input), visit: undefined, writingAge: undefined }
  const home = visit.home
  const route = visit.stage._tag === 'Return' ? [...input.writing.via].reverse().concat([home.position]) : [...input.writing.via, input.writing.stance]
  const walk = advanceStroll(visit.walk, { ...input, route, pauses: route.map(() => 600) })
  let stage = visit.stage
  const arrived = walk.activity._tag === 'Pausing' && settled(walk)
  if (stage._tag !== 'Writing' && arrived && stage.waypoint < route.length - 1) {
    stage = { ...stage, waypoint: stage.waypoint + 1 }
    walk.destination = stage.waypoint
    walk.activity = { _tag: 'Walking' }
  }
  else if (stage._tag === 'Approach' && arrived) stage = { _tag: 'Writing', age: 0 }
  else if (stage._tag === 'Writing' && input.attention === 'free') {
    const age = stage.age + input.delta
    stage = age < 6.2 ? { _tag: 'Writing', age } : { _tag: 'Return', waypoint: 0 }
    if (stage._tag === 'Return') { walk.destination = 0; walk.activity = { _tag: 'Walking' } }
  }
  const moved = { ...walk, destination: home.destination, activity: home.activity }
  if (stage._tag === 'Return' && arrived && walk.activity._tag === 'Pausing') {
    // Finish the pause at the landing position. Never snap back to the route point.
    const activity = home.activity
    return { stroll: { ...moved, activity: activity._tag === 'Pausing' ? { ...activity, remaining: 0, age: activity.duration } : activity }, visit: undefined, writingAge: undefined }
  }
  return { stroll: moved, visit: { home, walk, stage }, writingAge: stage._tag === 'Writing' ? stage.age : undefined }
}
