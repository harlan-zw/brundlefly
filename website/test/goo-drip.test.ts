import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BufferAttribute, Mesh, MeshPhysicalMaterial, Vector3 } from 'three'
import { createGooDrips, dripPose, strandRadius } from '../layers/brand/shared/goo-drip.ts'
import type { DripSpec } from '../layers/brand/shared/goo-drip.ts'

const spec: DripSpec = { reach: 1, drop: 0.07, thread: 0.012, bead: 0.06, period: 10, phase: 0 }
const fallHeight = 3
const steps = Array.from({ length: 2000 }, (_, index) => index / 2000)
const poses = steps.map(cycle => ({ cycle, pose: dripPose(spec, cycle, fallHeight) }))
const firstFree = poses.findIndex(({ pose }) => pose.free._tag !== 'None')

test('a hanging drop grows while its thread creeps longer, then necks just above the drop', () => {
  const hanging = poses.slice(0, firstFree).map(({ pose }) => pose.strand)
  for (let index = 1; index < hanging.length; index++) {
    assert.ok(hanging[index]!.length >= hanging[index - 1]!.length, 'The thread must never shorten while the drop fills.')
    assert.ok(hanging[index]!.drop >= hanging[index - 1]!.drop, 'The drop must never shrink while it fills.')
  }
  const last = hanging.at(-1)!
  const neck = strandRadius(last, spec.bead, last.length - last.drop * 3.2)
  const thread = strandRadius(last, spec.bead, last.length * 0.35)
  assert.ok(neck < thread * 0.6, `The neck (${neck}) must pinch below the thread (${thread}) before release.`)
  assert.equal(strandRadius(last, spec.bead, last.length), 0)
})

test('the released drop starts where it hung and only ever falls', () => {
  const hanging = poses[firstFree - 1]!.pose.strand
  const released = poses[firstFree]!.pose.free
  assert.equal(released._tag, 'Falling')
  assert.ok(Math.abs(released.distance - (hanging.length - hanging.drop * 1.1)) < 0.02, 'The drop must not jump at release.')
  let previous = released.distance
  for (const { pose } of poses.slice(firstFree)) {
    if (pose.free._tag === 'None') break
    assert.ok(pose.free.distance >= previous, 'A free drop must never rise.')
    previous = pose.free.distance
  }
})

test('a drop spreads on the surface it reaches and is gone before the next drop forms', () => {
  const landed = poses.find(({ pose }) => pose.free._tag === 'Spreading')?.pose.free
  assert.ok(landed && landed._tag === 'Spreading')
  assert.equal(landed.distance, fallHeight)
  const closing = poses.at(-1)!.pose
  assert.equal(closing.free._tag, 'None')
  // The recoiled stub must match the start of the next cycle, so the loop has no visible seam.
  const opening = poses[0]!.pose.strand
  assert.ok(Math.abs(closing.strand.length - opening.length) < 0.01)
  assert.ok(Math.abs(closing.strand.drop - opening.drop) < 0.002)
})

test('a frozen clock or zero flow holds every drip, and flow moves them', () => {
  const material = new MeshPhysicalMaterial()
  const drips = createGooDrips(material, [spec])
  const attachments = [{ exit: new Vector3(0, 2, 0), landing: -1 }]
  const snapshot = () => {
    const pose: number[] = []
    drips.root.traverse(object => {
      if (!(object instanceof Mesh)) return
      pose.push(...(object.geometry.getAttribute('position') as BufferAttribute).array, ...object.position.toArray(), Number(object.visible))
    })
    return pose
  }
  drips.update({ time: 0, flow: 1, attachments })
  const initial = snapshot()
  for (let step = 1; step <= 40; step++) drips.update({ time: step * 0.1, flow: 1, attachments })
  const moving = snapshot()
  assert.notDeepEqual(moving, initial)
  drips.update({ time: 4, flow: 1, attachments })
  assert.deepEqual(snapshot(), moving)
  drips.update({ time: 8, flow: 0, attachments })
  assert.deepEqual(snapshot(), moving)
  drips.dispose(); material.dispose()
})
