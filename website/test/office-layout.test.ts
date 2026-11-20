import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkOfficePlan, meshBody, officePlan } from '../layers/brand/shared/office-layout.ts'
import type { OfficePlan, OfficeProp, PlanRules } from '../layers/brand/shared/office-layout.ts'

// The cameras of the scene at its default zoom, and the close shot on both sides.
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
  const problems = checkOfficePlan(withProp(crate('crate', 0, -2.85)), rules)
  const blocked = problems.find(problem => problem._tag === 'RouteBlocked')
  assert.ok(blocked && blocked._tag === 'RouteBlocked')
  assert.equal(blocked.prop, 'crate')
  assert.equal(blocked.leg, 0)
  assert.ok(Math.abs(blocked.clearance - (1.6 - 1.65)) < 1e-9)
})

test('a prop that a diagonal leg crosses is reported, even when it is far from every stop', () => {
  // The loop is a figure of eight. Its diagonals cross near the middle of the room.
  const blocked = checkOfficePlan(withProp(crate('stool', 0.1, -0.2, 0.2)), rules).filter(problem => problem._tag === 'RouteBlocked')
  assert.ok(blocked.some(problem => problem._tag === 'RouteBlocked' && problem.clearance === -meshBody.reach))
})

test('a stop needs more room than a leg, because he turns on his feet there', () => {
  // The bin stands left of the first stop and leaves 0.35: enough to walk past, too little to turn in.
  const problems = checkOfficePlan(withProp(crate('bin', -0.9 - meshBody.reach - 0.35 - 0.3, -0.95)), rules)
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
  const hidden = checkOfficePlan(withProp({ ...crate('stack', -1.6, -2.75, 0.4), position: [-1.6, -0.7, -2.75], size: [1.2, 3, 0.4] }), rules)
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
