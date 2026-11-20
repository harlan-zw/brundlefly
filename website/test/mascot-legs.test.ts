import assert from 'node:assert/strict'
import test from 'node:test'
import { cycleReach, cycleToMidStance, footCycle, hipDrop, landingReach, solveLeg, swingLift, swingShare, swingStep, swingTravel } from '../layers/brand/shared/mascot-legs.ts'
import type { Point3 } from '../layers/brand/shared/mascot-legs.ts'

const distance = (a: Point3, b: Point3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
/** A fixed pseudo-random sequence, so a failure repeats. */
function sequence(seed: number) {
  return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
}

test('the feet swing in turn, both stand between the swings, and they are never both in the air', () => {
  for (const phase of [Math.PI / 2, Math.PI * 1.5, Math.PI * 2.5, -Math.PI / 2]) {
    assert.equal(footCycle(phase, 0)._tag, 'Stance', `The left foot must stand at ${phase}.`)
    assert.equal(footCycle(phase, 1)._tag, 'Stance', `The right foot must stand at ${phase}.`)
  }
  assert.deepEqual(footCycle(0, 0), { _tag: 'Swing', progress: 0.5 })
  assert.deepEqual(footCycle(Math.PI, 1), { _tag: 'Swing', progress: 0.5 })
  let inAir = [0, 0]
  const samples = 2000
  for (let step = 0; step < samples; step++) {
    const cycles = [0, 1].map(foot => footCycle(step / samples * Math.PI * 2, foot))
    assert.ok(cycles.some(cycle => cycle._tag === 'Stance'), 'One foot must carry him at every phase.')
    inAir = inAir.map((count, foot) => count + Number(cycles[foot]!._tag === 'Swing'))
  }
  for (const count of inAir) assert.ok(Math.abs(count / samples - swingShare / 2) < 0.002, 'Each foot is in the air for its share of the cycle.')
})

test('through one cycle a foot falls behind while it carries him, swings ahead, and never jumps', () => {
  const samples = 4000
  let before = cycleReach(footCycle(0, 0)), largest = 0, furthest = -Infinity, nearest = Infinity
  for (let step = 1; step <= samples; step++) {
    const reach = cycleReach(footCycle(step / samples * Math.PI * 2, 0))
    largest = Math.max(largest, Math.abs(reach - before))
    furthest = Math.max(furthest, reach)
    nearest = Math.min(nearest, reach)
    before = reach
  }
  assert.ok(largest < 0.005, `The foot jumped ${largest} of a stance between two phases.`)
  assert.ok(Math.abs(furthest - 0.5) < 1e-3 && Math.abs(nearest + 0.5) < 1e-3, 'It must land half a stance ahead and leave half a stance behind.')
  // A foot rises before it travels and lands before the swing ends, so it does not move along the floor.
  assert.equal(swingTravel(0.1), 0)
  assert.equal(swingTravel(0.9), 1)
  assert.ok(swingLift(0.13) > 0.1 && swingLift(0) === 0 && swingLift(0.5) === 1)
})

test('a foot in the air reaches its target as its travel ends, though the target moves, and then comes down where it is', () => {
  const random = sequence(11)
  for (const frames of [7, 24, 60]) {
    let place = -3, target = 2, progress = 0, landed: number | undefined, aimed = target
    for (let frame = 1; frame <= frames; frame++) {
      // The target wanders, as his body does when he turns or slows in the middle of a step.
      target += (random() - 0.5) * 0.4
      const next = frame / frames
      place += (target - place) * swingStep(progress, next)
      // The frame that ends the travel puts the foot on the target as it is then.
      if (landed === undefined && swingTravel(next) === 1) { landed = place; aimed = target }
      progress = next
    }
    assert.ok(landed !== undefined && Math.abs(landed - aimed) < 1e-9, `After ${frames} frames the foot is ${Math.abs((landed ?? place) - aimed)} from its target.`)
    assert.equal(place, landed, 'A foot that has ended its travel must not move while it comes down.')
  }
  // It does not travel while it is still on the floor, and a cycle that runs backward moves nothing.
  assert.equal(swingStep(0, 0.1), 0)
  assert.equal(swingStep(0.6, 0.4), 0)
  assert.equal(swingStep(0.9, 0.95), 0)
  // From the start of a swing to the middle of the next stance is the whole swing and half the stance, as a share of the cycle.
  assert.ok(Math.abs(cycleToMidStance(0) - (swingShare + (2 - swingShare) / 2) / 2) < 1e-12)
  assert.ok(Math.abs(cycleToMidStance(1) - (2 - swingShare) / 4) < 1e-12)
  // The aim leads by the ground still to cover: half a stance once the foot lands.
  assert.equal(landingReach(1), 0.5)
  assert.ok(Math.abs(landingReach(0) - (0.5 + swingShare / (2 - swingShare))) < 1e-12)
})

test('the leg solve keeps both bone lengths, bends the knee toward the pole, and never straightens the leg', () => {
  const random = sequence(5)
  const [thigh, shin] = [0.4, 0.55]
  const hip = { x: 0.3, y: 1, z: -0.2 }
  const pole = { x: 0.2, y: 0.1, z: 1 }
  let stretched = 0
  for (let sample = 0; sample < 500; sample++) {
    const target = { x: hip.x + (random() - 0.5) * 1.6, y: hip.y - random() * 1.2, z: hip.z + (random() - 0.5) * 1.6 }
    const solved = solveLeg(hip, target, thigh, shin, pole)
    assert.ok(Math.abs(distance(hip, solved.knee) - thigh) < 1e-9 && Math.abs(distance(solved.knee, solved.foot) - shin) < 1e-9, 'A bone changed its length.')
    const reach = distance(hip, solved.foot)
    assert.ok(reach <= (thigh + shin) * 0.97 + 1e-9, 'The leg straightened past its limit.')
    // The knee stands off the line from hip to foot on the side of the pole.
    const line = { x: solved.foot.x - hip.x, y: solved.foot.y - hip.y, z: solved.foot.z - hip.z }
    const share = ((solved.knee.x - hip.x) * line.x + (solved.knee.y - hip.y) * line.y + (solved.knee.z - hip.z) * line.z) / (reach * reach)
    const off = { x: solved.knee.x - hip.x - line.x * share, y: solved.knee.y - hip.y - line.y * share, z: solved.knee.z - hip.z - line.z * share }
    assert.ok(off.x * pole.x + off.y * pole.y + off.z * pole.z > 0, 'The knee bent away from the pole.')
    assert.ok(Math.hypot(off.x, off.y, off.z) > 0.05, 'The knee must stay bent.')
    if (solved.stretched) stretched++
    else assert.ok(distance(solved.foot, target) < 1e-9, 'A foot within reach must stand on its target.')
  }
  assert.ok(stretched > 20 && stretched < 480, 'The samples must include targets within reach and beyond it.')
  // A target beyond reach leaves the foot on the line to it, at the limit.
  const far = solveLeg(hip, { x: hip.x, y: hip.y - 5, z: hip.z }, thigh, shin, pole)
  assert.ok(far.stretched && Math.abs(far.foot.y - (hip.y - 0.95 * 0.97)) < 1e-9 && Math.abs(far.foot.x - hip.x) < 1e-12)
  // A target on the hip, and a pole along the leg, still give a whole leg.
  for (const solved of [solveLeg(hip, hip, thigh, shin, pole), solveLeg(hip, { x: hip.x, y: hip.y - 0.7, z: hip.z }, thigh, shin, { x: 0, y: -1, z: 0 })]) {
    for (const value of [...Object.values(solved.knee), ...Object.values(solved.foot)]) assert.ok(Number.isFinite(value))
    assert.ok(Math.abs(distance(hip, solved.knee) - thigh) < 1e-9)
  }
})

test('the hips come down just far enough for a foot on the floor to be within reach', () => {
  const hip = { x: 0, y: 1, z: 0 }
  assert.equal(hipDrop(hip, { x: 0.2, y: 0, z: 0.1 }, 1.2), 0)
  const foot = { x: 0.6, y: 0, z: 0.3 }
  const drop = hipDrop(hip, foot, 0.9)
  assert.ok(drop > 0.2 && drop < 1)
  assert.ok(Math.abs(distance({ ...hip, y: hip.y - drop }, foot) - 0.9) < 1e-9, 'After the drop the foot must be exactly within reach.')
  // With an ease the hips begin to sink before the limit, never sink less than the limit needs, and never jump.
  let before = 0, steepest = 0, began: number | undefined
  for (let step = 0; step <= 400; step++) {
    const far = { x: step / 400 * 0.95, y: 0, z: 0 }
    const [eased, needed] = [hipDrop(hip, far, 1.1, 0.06), hipDrop(hip, far, 1.1)]
    assert.ok(eased >= needed - 1e-12, 'The eased drop must hold the foot within reach.')
    if (eased > 0 && began === undefined) began = hipDrop(hip, far, 1.1 * 0.94)
    steepest = Math.max(steepest, Math.abs(eased - before))
    before = eased
  }
  assert.ok(began !== undefined && began < 1e-3 && hipDrop(hip, { x: 0.43, y: 0, z: 0 }, 1.1, 0.06) > 0 && hipDrop(hip, { x: 0.43, y: 0, z: 0 }, 1.1) === 0, 'The eased drop must begin before the limit.')
  assert.ok(steepest < 0.02, `The eased drop jumped ${steepest} between two near places.`)
  // Far within reach, and far beyond the ease, it is the needed drop.
  assert.equal(hipDrop(hip, { x: 0.1, y: 0, z: 0 }, 1.1, 0.06), 0)
  assert.ok(Math.abs(hipDrop(hip, { x: 0.9, y: 0, z: 0 }, 1.1, 0.06) - hipDrop(hip, { x: 0.9, y: 0, z: 0 }, 1.1)) < 1e-12)
})
