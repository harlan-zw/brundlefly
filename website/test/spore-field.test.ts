import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fullSporeCount, sporeCount, sporeField, sporeVolume } from '../layers/brand/shared/spore-field.ts'
import { resolveSceneQuality } from '../layers/brand/shared/scene-quality.ts'

test('the spore count follows the quality share and never leaves 0 to the full count', () => {
  assert.equal(sporeCount(1), fullSporeCount)
  assert.equal(sporeCount(0), 0)
  assert.equal(sporeCount(0.5), fullSporeCount / 2)
  assert.equal(sporeCount(7), fullSporeCount)
  assert.equal(sporeCount(-1), 0)
  assert.equal(sporeCount(Number.NaN), 0)
  const hints = { coarsePointer: false, cores: 8, memory: 8, shortSide: 900 }
  const low = sporeCount(resolveSceneQuality({ ...hints, requested: 'low' }).spores)
  const medium = sporeCount(resolveSceneQuality({ ...hints, requested: 'medium' }).spores)
  const high = sporeCount(resolveSceneQuality({ ...hints, requested: 'high' }).spores)
  assert.ok(low > 0 && low < medium && medium < high)
})

test('every spore starts inside the air of the clearing', () => {
  const { homes, traits } = sporeField(fullSporeCount)
  for (let index = 0; index < fullSporeCount; index++) {
    for (let axis = 0; axis < 3; axis++) {
      const value = homes[index * 3 + axis]!
      assert.ok(value >= sporeVolume.min[axis]! && value <= sporeVolume.max[axis]!)
    }
    // No spore crosses the room's height in less than a minute.
    assert.ok(Math.abs(traits[index * 4 + 1]!) * 60 < sporeVolume.max[1] - sporeVolume.min[1])
  }
})

test('the spores fill the room, they do not gather in one part', () => {
  const { homes } = sporeField(fullSporeCount)
  const octants = new Array<number>(8).fill(0)
  for (let index = 0; index < fullSporeCount; index++) {
    const half = [0, 1, 2].map(axis => homes[index * 3 + axis]! > (sporeVolume.min[axis]! + sporeVolume.max[axis]!) / 2 ? 1 : 0)
    octants[half[0]! + half[1]! * 2 + half[2]! * 4]!++
  }
  for (const share of octants) assert.ok(share > fullSporeCount / 8 * 0.5, `an eighth of the room holds only ${share} spores`)
})

test('a lower tier draws the first spores of the full field, so the air thins without moving', () => {
  const full = sporeField(fullSporeCount), thin = sporeField(sporeCount(0.3))
  assert.deepEqual(Array.from(thin.homes), Array.from(full.homes.subarray(0, thin.homes.length)))
  assert.deepEqual(Array.from(thin.traits), Array.from(full.traits.subarray(0, thin.traits.length)))
  assert.deepEqual(Array.from(sporeField(40).tints), Array.from(sporeField(40).tints))
})
