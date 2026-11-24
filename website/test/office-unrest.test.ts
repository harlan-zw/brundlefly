import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyExperiment } from '../shared/office-experiment.ts'
import type { Experiment } from '../shared/office-experiment.ts'
import { beaconGlow, beaconTurns, tremor, unrest } from '../shared/office-unrest.ts'
import type { Unrest } from '../shared/office-unrest.ts'

const at = (count: number, target = 3000, criticalAt: number | null = null): Experiment => ({ ...emptyExperiment(1, target), tally: { snail: count, beetle: 0, fly: 0, cricket: 0 }, criticalAt })
const stages = (target: number) => Array.from({ length: target + 1 }, (_, count) => unrest(at(count, target)))

test('the chamber is calm under four fifths of the target, unstable from there, and in warning from nine tenths', () => {
  assert.deepEqual(unrest(at(0)), { stage: 'Calm', level: 0 })
  assert.equal(unrest(at(2399)).stage, 'Calm')
  assert.equal(unrest(at(2400)).stage, 'Unstable')
  assert.equal(unrest(at(2699)).stage, 'Unstable')
  assert.equal(unrest(at(2700)).stage, 'Warning')
  assert.equal(unrest(at(2999)).stage, 'Warning')
  // A small target, for a test alone, still passes through both stages.
  assert.deepEqual([...new Set(stages(10).map(({ stage }) => stage))], ['Calm', 'Unstable', 'Warning'])
  assert.equal(unrest(null).stage, 'Calm')
})

test('the unrest only rises as the count rises, and a critical run is at full warning whatever its count', () => {
  const order = ['Calm', 'Unstable', 'Warning']
  for (const target of [10, 50, 3000]) {
    const seen = stages(target)
    for (let count = 1; count <= target; count++) {
      assert.ok(seen[count]!.level >= seen[count - 1]!.level)
      assert.ok(order.indexOf(seen[count]!.stage) >= order.indexOf(seen[count - 1]!.stage))
      assert.ok(seen[count]!.level >= 0 && seen[count]!.level <= 1)
    }
  }
  // The presenter can send a run critical at any count. The chamber does not go calm for the scene.
  assert.deepEqual(unrest(at(3, 3000, 1000)), { stage: 'Warning', level: 1 })
})

test('the warning light turns faster and burns brighter at each stage, and never more than once a second', () => {
  const seen = stages(3000)
  for (let count = 1; count <= 3000; count++) {
    assert.ok(beaconTurns(seen[count]!) >= beaconTurns(seen[count - 1]!))
    assert.ok(beaconGlow(seen[count]!) >= beaconGlow(seen[count - 1]!))
    assert.ok(beaconTurns(seen[count]!) <= 1 && beaconGlow(seen[count]!) <= 1)
  }
  // Each stage is a step that a room can see, not a slow drift.
  assert.ok(beaconTurns(unrest(at(2400))) > beaconTurns(unrest(at(2399))) * 1.5)
  assert.ok(beaconTurns(unrest(at(2700))) > beaconTurns(unrest(at(2699))) * 1.1)
  assert.ok(beaconGlow(unrest(at(2700))) > beaconGlow(unrest(at(2699))) * 1.2)
  assert.equal(beaconGlow(unrest(at(100))), 0)
})

const step = 0.01
const run = (state: Unrest, seconds: number, motionOff = false) => Array.from({ length: Math.round(seconds / step) }, (_, index) => tremor(index * step, state, motionOff))
/** The number of tremors in the samples: the times the shake starts. */
const bursts = (samples: readonly { shake: number }[]) => samples.filter(({ shake }, index) => shake > 0 && (index === 0 || samples[index - 1]!.shake === 0)).length

test('a calm room is still, an unstable room shakes now and then, and a room in warning shakes more often and harder', () => {
  const calm = run({ stage: 'Calm', level: 0 }, 60)
  assert.ok(calm.every(({ shake, light }) => shake === 0 && light === 1))
  const unstable = run(unrest(at(2500)), 60)
  const warning = run(unrest(at(2900)), 60)
  assert.ok(bursts(unstable) >= 8)
  assert.ok(bursts(warning) > bursts(unstable) * 1.5)
  const most = (samples: readonly { shake: number }[]) => Math.max(...samples.map(({ shake }) => shake))
  assert.ok(most(warning) > most(unstable))
  assert.ok(most(warning) <= 1)
  // Between tremors the room is as it was.
  assert.ok(unstable.filter(({ shake }) => shake === 0).length > unstable.length / 2)
})

test('each tremor dips the tubes once, and the tubes never change level more than twice in any second', () => {
  for (const state of [unrest(at(2400)), unrest(at(2650)), unrest(at(2700)), unrest(at(2999)), unrest(at(5, 3000, 1))]) {
    const samples = run(state, 120)
    const changes = samples.map(({ light }, index) => index > 0 && light !== samples[index - 1]!.light ? index : -1).filter(index => index >= 0)
    // A dip is a run of samples under the full light. A run can start with one.
    const dips = samples.filter(({ light }, index) => light < 1 && (index === 0 || samples[index - 1]!.light === 1)).length
    assert.ok(dips >= 2, 'The tubes do dip.')
    assert.equal(dips, bursts(samples))
    for (const [index, change] of changes.entries()) assert.ok(changes.slice(index).filter(other => other - change <= 1 / step).length <= 2)
    for (const { light, shake } of samples) {
      assert.ok(light > 0.4 && light <= 1)
      if (light < 1) assert.ok(shake >= 0)
    }
  }
})

test('with motion off the room neither shakes nor dips', () => {
  assert.ok(run(unrest(at(2950)), 60, true).every(({ shake, light }) => shake === 0 && light === 1))
})
