import assert from 'node:assert/strict'
import test from 'node:test'
import { AnimationMixer, Texture, Vector2, Vector3 } from 'three'
import { createMascotModel } from '../layers/brand/shared/mascot.ts'

test('walking alternates weighted feet, blends through partial strides, and stopping restores the standing pose', () => {
  const width = 80
  const height = 80
  const texture = new Texture()
  const model = createMascotModel(texture, { width, height, data: new Uint8ClampedArray(width * height * 4).fill(180) })
  const feet = [[0.28, 0.92], [0.7, 0.92]].map(([x, y]) => {
    const vertex = Math.round(y! * (height - 1)) * width + Math.round(x! * (width - 1))
    return { vertex, rest: new Vector3().fromBufferAttribute(model.mesh.geometry.getAttribute('position'), vertex) }
  })
  const pose = (gait: number, walkPhase: number) => {
    model.update({ time: 0, pressure: 0, pointer: new Vector2(), transform: 'squeeze', gait, walkPhase })
    return feet.map(({ vertex, rest }) => model.mesh.applyBoneTransform(vertex, rest.clone()))
  }
  const standing = pose(0, 0)
  const firstStep = pose(1, Math.PI / 2)
  const secondStep = pose(1, Math.PI * 1.5)
  assert.ok(firstStep[0]!.distanceTo(secondStep[0]!) > 0.08, 'The left foot must visibly stride.')
  assert.ok(firstStep[1]!.distanceTo(secondStep[1]!) > 0.08, 'The right foot must visibly stride.')
  const travel = firstStep.map((foot, index) => foot.z - secondStep[index]!.z)
  assert.ok(travel[0]! * travel[1]! < 0, 'Feet must travel in opposite directions.')
  const halfStep = pose(0.5, Math.PI / 2)
  halfStep.forEach((foot, index) => {
    const full = firstStep[index]!.distanceTo(standing[index]!), half = foot.distanceTo(standing[index]!)
    assert.ok(half > full * 0.2 && half < full * 0.8, 'A half gait must land between standing and the full stride.')
  })
  const stopped = pose(0, Math.PI / 2)
  stopped.forEach((foot, index) => assert.ok(foot.distanceTo(standing[index]!) < 0.000001, 'Stopping must clear the walking pose.'))
  model.dispose()
  texture.dispose()
})

test('the exported walk clip moves foot skin and closes its loop', () => {
  const width = 64
  const height = 64
  const texture = new Texture()
  const model = createMascotModel(texture, { width, height, data: new Uint8ClampedArray(width * height * 4).fill(180) })
  const vertex = Math.round(0.92 * (height - 1)) * width + Math.round(0.28 * (width - 1))
  const rest = new Vector3().fromBufferAttribute(model.mesh.geometry.getAttribute('position'), vertex)
  const clip = model.walkAnimation()
  const mixer = new AnimationMixer(model.root)
  mixer.clipAction(clip).play()
  const footAt = (time: number) => {
    mixer.setTime(time)
    model.root.updateMatrixWorld(true)
    model.skeleton.update()
    return model.mesh.applyBoneTransform(vertex, rest.clone())
  }
  const first = footAt(0)
  const middle = footAt(clip.duration / 2)
  assert.ok(first.distanceTo(middle) > 0.04, 'The baked animation must move weighted foot skin.')
  assert.ok(first.distanceTo(footAt(clip.duration)) < 0.000001, 'The animation must loop without a skin jump.')
  mixer.stopAllAction()
  mixer.uncacheRoot(model.root)
  model.dispose()
  texture.dispose()
})
