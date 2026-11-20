import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkOfficePlan, checkWalkedPath, meshBody, officePlan } from '../layers/brand/shared/office-layout.ts'
import type { OfficePlan, OfficeProp, PlanRules } from '../layers/brand/shared/office-layout.ts'
import { frame, meshCadence, meshWalk, startWalk, stepWalk, walkSets } from './walk-sim.ts'
import type { Point, Walk } from './walk-sim.ts'

// The cameras of the scene at its default zoom, and the close shot on both sides.
// The first stop of his loop. The back leg of the loop runs from it, along the furniture.
const [stopX, stopZ] = officePlan.stops[0]!.position
const rules: PlanRules = { body: meshBody, legClearance: 0.3, stopClearance: 0.4, readable: ['monitor', 'whiteboard'], viewpoints: [
  { _tag: 'Fixed', name: 'desktop', position: [0, 0.75, 8.67] }, { _tag: 'Fixed', name: 'phone', position: [0, 0.75, 6.93] },
  { _tag: 'CloseShot', name: 'close-right', side: 1 }, { _tag: 'CloseShot', name: 'close-left', side: -1 },
] }
const crate = (id: string, x: number, z: number, size = 0.6): OfficeProp =>
  ({ _tag: 'FilingCabinet', id, position: [x, -2.2 + size / 2, z], size: [size, size, size], facing: '+z', rests: 'floor' })
const withProp = (prop: OfficeProp): OfficePlan => ({ ...officePlan, props: [...officePlan.props, prop] })
const tags = (plan: OfficePlan) => checkOfficePlan(plan, rules).map(problem => `${problem._tag}:${problem.prop}`)

test('the office plan keeps his walk, his sightlines, and the readable props clear', () => {
  assert.deepEqual(checkOfficePlan(officePlan, rules), [])
})

test('the office plan gives every stop a pause long enough for its habit, and one empty jar', () => {
  assert.equal(officePlan.stops.length, 4)
  for (const stop of officePlan.stops) assert.ok(stop.pause >= 2.6, `a pause of ${stop.pause} seconds cuts the habit short`)
  assert.equal(officePlan.props.filter(prop => prop._tag === 'Jar' && prop.contents === 'empty').length, 1)
  assert.equal(officePlan.props.filter(prop => prop._tag === 'CeilingTube' && prop.lamp === 'flickering').length, 1)
})

test('a prop beside his walk is reported with the clearance it leaves', () => {
  // The crate stands 1.6 units behind the back leg of the loop. His turned body reaches 1.65.
  const problems = checkOfficePlan(withProp(crate('crate', 0, stopZ - 1.9)), rules)
  const blocked = problems.find(problem => problem._tag === 'RouteBlocked')
  assert.ok(blocked && blocked._tag === 'RouteBlocked')
  assert.equal(blocked.prop, 'crate')
  assert.equal(blocked.leg, 0)
  assert.ok(Math.abs(blocked.clearance - (1.6 - 1.65)) < 1e-9)
})

test('a prop that a diagonal leg crosses is reported, even when it is far from every stop', () => {
  const [from, to] = [officePlan.stops[1]!.position, officePlan.stops[2]!.position]
  const blocked = checkOfficePlan(withProp(crate('stool', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 0.2)), rules).filter(problem => problem._tag === 'RouteBlocked')
  assert.ok(blocked.some(problem => problem._tag === 'RouteBlocked' && problem.clearance === -meshBody.reach))
})

test('a stop needs more room than a leg, because he turns on his feet there', () => {
  // The bin stands left of the first stop and leaves 0.35: enough to walk past, too little to turn in.
  const problems = checkOfficePlan(withProp(crate('bin', stopX - meshBody.reach - 0.35 - 0.3, stopZ)), rules)
  assert.deepEqual(problems.map(problem => problem._tag), ['StopCrowded'])
  const crowded = problems[0]!
  assert.ok(crowded._tag === 'StopCrowded' && crowded.prop === 'bin' && crowded.stop === 0 && Math.abs(crowded.clearance - 0.35) < 1e-9)
})

test('a prop between a camera and him is reported for that camera', () => {
  // A tall box three units in front of him hides him from both cameras. It stands clear of his walk.
  const problems = checkOfficePlan(withProp({ ...crate('pillar', 0.7, 4.4, 0.8), position: [0.7, -0.6, 4.4], size: [0.8, 3.2, 0.8] }), rules)
  const blocked = problems.filter(problem => problem._tag === 'SightlineBlocked')
  assert.ok(blocked.some(problem => problem._tag === 'SightlineBlocked' && problem.viewpoint === 'desktop' && problem.prop === 'pillar'))
  assert.ok(blocked.some(problem => problem._tag === 'SightlineBlocked' && problem.viewpoint === 'phone'))
  assert.ok(!problems.some(problem => problem._tag === 'RouteBlocked' || problem._tag === 'StopCrowded'))
})

test('a prop in front of the close shot is reported for the close shot', () => {
  // The close shot of the last stop stands near x 1.5, z 3.8, at head height. A hanging sign there hides his face.
  const sign: OfficeProp = { _tag: 'Whiteboard', id: 'sign', position: [1.1, 0.3, 2.6], size: [1.2, 0.8, 0.1], facing: '+z', rests: 'ceiling' }
  assert.ok(checkOfficePlan(withProp(sign), rules).some(problem => problem._tag === 'SightlineBlocked' && problem.viewpoint === 'close-right' && problem.stop === 3))
})

test('the monitor and the whiteboard must face the cameras with nothing in front', () => {
  const turned: OfficePlan = { ...officePlan, props: officePlan.props.map(prop => prop.id === 'monitor' ? { ...prop, facing: '-z' as const } : prop) }
  assert.ok(checkOfficePlan(turned, rules).some(problem => problem._tag === 'Unreadable' && problem.prop === 'monitor' && problem.reason === 'faces-away'))
  // A cabinet in front of the desk hides the monitor's screen.
  const monitor = officePlan.props.find(prop => prop._tag === 'Monitor')!
  const hidden = checkOfficePlan(withProp({ ...crate('stack', monitor.position[0], -2.75, 0.4), position: [monitor.position[0], -0.7, -2.75], size: [1.2, 3, 0.4] }), rules)
  assert.ok(hidden.some(problem => problem._tag === 'Unreadable' && problem.prop === 'monitor' && typeof problem.reason === 'object' && problem.reason.hiddenBy === 'stack'))
  const gone: OfficePlan = { ...officePlan, props: officePlan.props.filter(prop => prop.id !== 'whiteboard') }
  assert.ok(checkOfficePlan(gone, rules).some(problem => problem._tag === 'Unreadable' && problem.prop === 'whiteboard' && problem.reason === 'missing'))
})

test('props that share space or leave the room are reported', () => {
  assert.ok(tags(withProp(crate('twin', -5.02, -1.37))).includes('Overlap:filing-cabinet-1'))
  assert.ok(tags(withProp(crate('lost', 6.2, 0))).includes('OutsideRoom:lost'))
  // A jar on its shelf and a monitor on its desk touch what holds them. That is no overlap.
  assert.ok(!tags(officePlan).some(tag => tag.startsWith('Overlap')))
})

test('his way to the door must be clear from the start point and from every stop', () => {
  // A plant stands on the straight walk from the last stop to the door.
  const problems = checkOfficePlan(withProp(crate('plant', 2.2, -0.3, 0.3)), rules).filter(problem => problem._tag === 'ExitBlocked')
  assert.ok(problems.some(problem => problem._tag === 'ExitBlocked' && problem.prop === 'plant' && problem.from === 3))
  assert.ok(problems.some(problem => problem._tag === 'ExitBlocked' && problem.from === 'start'))
  // The door's own point keeps clear of the door and the vending machine. He works at the jars, so only his trunk must clear them.
  const tight = checkOfficePlan({ ...officePlan, exit: [3.6, -1.6] }, rules).filter(problem => problem._tag === 'ExitBlocked').map(problem => problem.prop)
  assert.ok(tight.includes('door') && !tight.includes('jar-shelf'))
})

/**
 * Every place he walks in the office: two laps of his loop, his way in from the door, and his way out to the door from every half second of a lap.
 * A journey can begin at any moment, and he turns to the door in a curve, so the straight walks from the stops do not bound it.
 */
function walkedPath() {
  const { start, exit, route, pauses } = walkSets.office
  const cadence = meshCadence(0.71)
  const path: Point[] = []
  const journey = { route: [exit], pauses: [600], walkSpeed: meshWalk.speed * meshWalk.journey, cadence }
  const leave = (from: Walk) => {
    let walk: Walk = { ...from, stroll: { ...from.stroll, destination: 0, activity: { _tag: 'Walking' } } }
    for (let elapsed = 0; elapsed < 12 && walk.stroll.activity._tag === 'Walking'; elapsed += frame) {
      walk = stepWalk(walk, journey)
      path.push(walk.stroll.position)
    }
    assert.equal(walk.stroll.activity._tag, 'Pausing', 'Every journey must reach the door.')
  }
  let walk = startWalk(start)
  let laps = 0, sinceJourney = 0, wasPausing = false
  while (laps < 2) {
    walk = stepWalk(walk, { route, pauses, cadence })
    path.push(walk.stroll.position)
    sinceJourney += frame
    if (sinceJourney >= 0.5) { sinceJourney = 0; leave(walk) }
    const pausing = walk.stroll.activity._tag === 'Pausing'
    if (pausing && !wasPausing && walk.stroll.activity._tag === 'Pausing' && walk.stroll.activity.waypoint === route.length - 1) laps++
    wasPausing = pausing
  }
  // He comes in from the door at the speed of a journey.
  let arriving = startWalk(exit)
  for (let elapsed = 0; elapsed < 12 && arriving.stroll.activity._tag === 'Walking'; elapsed += frame) {
    arriving = stepWalk(arriving, { route: [start], pauses: [600], walkSpeed: meshWalk.speed * meshWalk.journey, cadence })
    path.push(arriving.stroll.position)
  }
  return path
}

test('the path he really walks, with its curves and every journey to the door, keeps clear of every prop', () => {
  const path = walkedPath()
  assert.ok(path.length > 5000, 'The path must hold his laps and his journeys.')
  assert.deepEqual(checkWalkedPath(officePlan, rules, path), [])
  // His curves stay close to the straight legs: he never swings wide of the room he was given.
  for (const [x, z] of path) assert.ok(x > -1.3 && x < 3.2 && z > stopZ - 0.3 && z < 1, `He walked to ${x.toFixed(2)}, ${z.toFixed(2)}.`)
})

test('a prop beside a curve of his path is reported with the point that comes nearest it', () => {
  // A crate behind the first stop, clear of the straight legs by the leg clearance and a hair.
  const crowded = withProp(crate('crate', stopX, stopZ - meshBody.reach - 0.3 - 0.3 - 0.005))
  assert.ok(!checkOfficePlan(crowded, rules).some(problem => problem._tag === 'RouteBlocked'))
  const path: Point[] = [[stopX, stopZ], [stopX + 0.4, stopZ - 0.02], [stopX + 0.9, stopZ]]
  const problems = checkWalkedPath(crowded, rules, path)
  assert.equal(problems.length, 1)
  const blocked = problems[0]!
  assert.ok(blocked._tag === 'PathBlocked' && blocked.prop === 'crate' && blocked.at[0] === stopX + 0.4 && blocked.clearance < 0.3 && blocked.clearance > 0.25)
  // A path of the straight legs only is clear of it.
  assert.deepEqual(checkWalkedPath(crowded, rules, [[stopX, stopZ], [stopX + 1.8, stopZ]]), [])
})

test('he stands within reach of furniture he works at, and keeps his whole reach clear of every other prop', () => {
  const desk = officePlan.props.find(prop => prop.id === 'desk')!
  const front = desk.position[2] + desk.size[2] / 2
  // At the desk station his long arms reach the desk's front edge, and his trunk keeps the stop clearance from it.
  assert.ok(stopZ - front < meshBody.reach && stopZ - front >= meshBody.torso + rules.stopClearance)
  assert.deepEqual(checkOfficePlan(officePlan, rules).filter(problem => problem._tag === 'StopCrowded' || problem._tag === 'RouteBlocked'), [])
  // The same stop beside a prop he does not work at is crowded.
  const unworked = { ...officePlan, stops: officePlan.stops.map(stop => ({ ...stop, works: undefined })) }
  const crowded = checkOfficePlan(unworked, rules).filter(problem => problem._tag === 'StopCrowded').map(problem => problem.prop)
  assert.ok(crowded.includes('desk') && crowded.includes('jar-shelf'))
})
