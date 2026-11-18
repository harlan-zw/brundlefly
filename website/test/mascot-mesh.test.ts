import assert from 'node:assert/strict'
import test from 'node:test'
import { AnimationClip, Bone, Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Object3D, Quaternion, QuaternionKeyframeTrack, Vector2, Vector3, VectorKeyframeTrack } from 'three'
import { poseMannerisms } from '../layers/brand/shared/mannerism.ts'
import { createMeshMascot, loadMeshMascot } from '../layers/brand/shared/mascot-mesh.ts'
import { bodyJointNames } from '../layers/brand/shared/mascot-pose.ts'

/** A model in millimetres under a scaled root, like a Blender export. Its feet are off the origin. */
function millimetreModel() {
  const scene = new Group()
  const node = new Group()
  node.scale.setScalar(0.001)
  const body = new Mesh(new BoxGeometry(60, 80, 40), new MeshStandardMaterial())
  body.name = 'body'
  body.position.set(5, 52, 0)
  node.add(body)
  scene.add(node)
  return { scene, node, body }
}
function ok(result: ReturnType<typeof createMeshMascot>) {
  assert.equal(result._tag, 'Ok')
  return (result as Extract<typeof result, { _tag: 'Ok' }>).mascot
}
const close = (actual: number, expected: number, message?: string) => assert.ok(Math.abs(actual - expected) < 1e-6, message ?? `${actual} is not ${expected}`)

test('a model in any unit stands on the floor at the requested height and keeps its own origin', () => {
  const { scene } = millimetreModel()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  mascot.root.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(mascot.root, true)
  close(bounds.min.y, 0)
  close(bounds.max.y, 2.5)
  // The body sits 5 mm right of the file origin. The fit keeps that offset at the new scale.
  close((bounds.min.x + bounds.max.x) / 2, 5 * 2.5 / 80)
  close(mascot.extent.left, bounds.min.x)
  close(mascot.extent.right, bounds.max.x)
})

test('a figurine base leaves the scene and does not change the fit', () => {
  const { scene, node } = millimetreModel()
  const base = new Mesh(new BoxGeometry(120, 6, 120), new MeshStandardMaterial())
  base.name = 'Brundlefly-base'
  base.position.y = 9
  node.add(base)
  let released = false
  base.geometry.addEventListener('dispose', () => { released = true })
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  mascot.root.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(mascot.root, true)
  close(bounds.min.y, 0)
  close(bounds.max.y, 2.5)
  assert.equal(mascot.root.getObjectByName('Brundlefly-base'), undefined)
  assert.ok(released, 'The removed base must release its geometry.')
})

test('a file without clips sways about its feet and rests at time zero', () => {
  const { scene, node, body } = millimetreModel()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  assert.deepEqual(mascot.motion, { _tag: 'Sway' })
  const head = () => { mascot.root.updateMatrixWorld(true); return body.localToWorld(new Vector3(0, 40, 0)) }
  // The floor point under the file origin: the body's lowest face is 12 mm above that origin.
  const feet = () => { mascot.root.updateMatrixWorld(true); return node.localToWorld(new Vector3(0, 12, 0)) }
  mascot.update(0)
  const rest = head()
  mascot.update(3)
  assert.ok(head().distanceTo(rest) > 0.005, 'The head must move during the sway.')
  assert.ok(feet().length() < 1e-9, 'The floor point under his origin must not move.')
  mascot.update(0)
  assert.ok(head().distanceTo(rest) < 1e-9, 'Time zero must restore the authored pose.')
  // One idle loop returns the whole pose to its start, so a looping inspector does not snap.
  mascot.update(mascot.idleDuration)
  assert.ok(head().distanceTo(rest) < 1e-9, 'One idle loop must end on the authored pose.')
  assert.equal(mascot.skinned, false)
})

test('a file with clips plays its idle clip instead of the sway', () => {
  const { scene, body } = millimetreModel()
  const track = (to: number) => new VectorKeyframeTrack('body.position', [0, 2], [5, 52, 0, 5, 52, to])
  const animations = [new AnimationClip('Brundlefly-walk', 2, [track(90)]), new AnimationClip('Brundlefly-idle', 2, [track(30)])]
  const mascot = ok(createMeshMascot({ scene, animations }, 2.5))
  assert.deepEqual(mascot.motion, { _tag: 'Clip', name: 'Brundlefly-idle' })
  assert.equal(mascot.idleDuration, 2)
  mascot.update(1)
  close(body.position.z, 15)
  assert.equal(mascot.root.children[0]!.rotation.y, 0, 'An animated model must not also sway.')
})

test('the face point follows an authored anchor and falls back to the upper front of the body', () => {
  const authored = millimetreModel()
  const anchor = new Object3D()
  anchor.name = 'anchor-face'
  anchor.position.set(5, 80, 20)
  authored.node.add(anchor)
  const withAnchor = ok(createMeshMascot({ scene: authored.scene, animations: [] }, 2.5))
  const scale = 2.5 / 80
  const point = withAnchor.facePoint(new Vector3())
  close(point.x, 5 * scale)
  close(point.y, (80 - 12) * scale)
  close(point.z, 20 * scale)
  const estimated = ok(createMeshMascot({ scene: millimetreModel().scene, animations: [] }, 2.5)).facePoint(new Vector3())
  close(estimated.x, 5 * scale)
  close(estimated.y, 2.5 * 0.8)
  close(estimated.z, 20 * scale)
})

test('a file without geometry is an error value, and disposal releases the model', () => {
  const empty = createMeshMascot({ scene: new Group(), animations: [] })
  assert.equal(empty._tag, 'Err')
  const { scene, body } = millimetreModel()
  const released: string[] = []
  body.geometry.addEventListener('dispose', () => released.push('geometry'))
  ;(body.material as MeshStandardMaterial).addEventListener('dispose', () => released.push('material'))
  ok(createMeshMascot({ scene, animations: [] })).dispose()
  assert.deepEqual(released.sort(), ['geometry', 'material'])
})

test('a model file that cannot load is an error value with its cause', async () => {
  const result = await loadMeshMascot('http://127.0.0.1:9/absent.glb')
  assert.equal(result._tag, 'Err')
  assert.ok(result._tag === 'Err' && result.reason.length > 0)
})

/** A model with a `head` joint that looks along +Z at rest, as the rig contract requires. */
function headedModel() {
  const model = millimetreModel()
  const head = new Bone()
  head.name = 'head'
  head.position.set(5, 80, 0)
  model.node.add(head)
  const facing = () => { model.scene.parent?.parent?.parent?.updateMatrixWorld(true); return new Vector3(0, 0, 1).transformDirection(head.matrixWorld) }
  return { ...model, head, facing }
}

test('the head joint turns toward a watched point within its limits and returns to the clip pose', () => {
  const { scene, head, facing } = headedModel()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  mascot.update(0)
  close(facing().z, 1)
  // The watched point is up and far to screen right, beyond both limits.
  const target = mascot.facePoint(new Vector3()).add(new Vector3(40, 40, 10))
  mascot.update(0, { target, weight: 1, tilt: 0 })
  const turned = facing()
  assert.ok(turned.x > 0.4 && turned.y > 0.2, 'The head must turn toward screen right and up.')
  close(Math.atan2(turned.x, turned.z), 0.6)
  close(Math.asin(turned.y), 0.35)
  // The same look on later frames holds the pose. It must not add to itself.
  for (let frame = 0; frame < 5; frame++) mascot.update(0, { target, weight: 1, tilt: 0 })
  assert.ok(facing().distanceTo(turned) < 1e-9, 'A held look must not accumulate.')
  mascot.update(0, { target, weight: 0.5, tilt: 0 })
  const half = facing()
  assert.ok(half.x > 0.05 && half.x < turned.x, 'Half weight must turn the head part of the way.')
  mascot.update(0)
  close(facing().z, 1)
  assert.ok(head.quaternion.angleTo(new Quaternion()) < 1e-9)
})

test('a head turn layers over a clip that holds the head still, and a model without a head ignores the look', () => {
  const { scene, head, facing } = headedModel()
  const nod = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.2)
  const clip = new AnimationClip('Brundlefly-idle', 2, [new QuaternionKeyframeTrack('head.quaternion', [0, 2], [...nod.toArray(), ...nod.toArray()])])
  const mascot = ok(createMeshMascot({ scene, animations: [clip] }, 2.5))
  const target = mascot.facePoint(new Vector3()).add(new Vector3(0, 0, 10))
  // The clip value never changes, so the mixer writes it once. Every later frame must still start from that clip pose.
  for (const time of [0.5, 0.6, 0.7]) mascot.update(time, { target, weight: 1, tilt: 0 })
  assert.ok(Math.abs(facing().y) < 0.05, 'The head must face the point ahead, not keep the nod.')
  for (const time of [0.8, 0.9]) mascot.update(time)
  assert.ok(head.quaternion.angleTo(nod) < 1e-6, 'Without a look the head must return to the clip pose.')
  const plain = ok(createMeshMascot({ scene: millimetreModel().scene, animations: [] }, 2.5))
  assert.doesNotThrow(() => plain.update(1, { target, weight: 1, tilt: 0.07 }))
})

/** A model with every body joint of the relief rig, at identity rest rotations, plus two mouthparts. */
function jointedModel() {
  const model = millimetreModel()
  const joints = new Map<string, Bone>()
  for (const name of [...bodyJointNames, 'mouthpart-0', 'mouthpart-0-tip', 'mouthpart-1', 'mouthpart-1-tip']) {
    const joint = new Bone()
    joint.name = name
    joint.position.set(5, 60, 0)
    model.node.add(joint)
    joints.set(name, joint)
  }
  return { ...model, joints, joint: (name: string) => joints.get(name)! }
}
const standing = { time: 0, pressure: 0, pointer: new Vector2(), transform: 'squeeze' as const }

test('a mesh with the relief rig joints walks, speaks, and performs a mannerism through the shared pose code', () => {
  const { scene, joint } = jointedModel()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  assert.ok(mascot.pose, 'A file with every body joint must accept the pose code.')
  // A full stride at its widest: the hips swing in opposite directions and the figure sits low between steps.
  mascot.pose({ ...standing, gait: 1, walkPhase: Math.PI / 2 })
  close(joint('left-hip').rotation.x, 0.22)
  close(joint('right-hip').rotation.x, -0.22)
  // Standing again clears the stride. A turn must not carry over from the frame before.
  mascot.pose(standing)
  close(joint('left-hip').rotation.x, 0)
  // His voice opens neighbouring mouthparts in opposite directions.
  mascot.pose({ ...standing, speaking: 1 })
  const [first, second] = [joint('mouthpart-0').rotation.x, joint('mouthpart-1').rotation.x]
  mascot.pose(standing)
  assert.ok(first - joint('mouthpart-0').rotation.x > 0.25 && second - joint('mouthpart-1').rotation.x < -0.25)
  // A mannerism adds its turns to the joints it names.
  mascot.pose({ ...standing, mannerism: poseMannerisms([{ mannerism: { _tag: 'HeadTilt' }, age: 0.9 }]) })
  assert.ok(joint('head').rotation.z > 0.25, 'The head tilt must reach the head joint.')
})

test('the head turn layers over the shared pose code and does not accumulate', () => {
  const { scene, joint } = jointedModel()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  const target = mascot.facePoint(new Vector3()).add(new Vector3(40, 0, 10))
  for (let frame = 0; frame < 4; frame++) mascot.pose!(standing, { target, weight: 1, tilt: 0 })
  const forward = new Vector3(0, 0, 1).applyQuaternion(joint('head').quaternion)
  close(Math.atan2(forward.x, forward.z), 0.6)
  mascot.pose!(standing)
  assert.ok(joint('head').quaternion.angleTo(new Quaternion()) < 1e-6, 'Without a look the head must return to the posed rotation.')
})

test('a mesh that lacks a body joint, or has one turned at rest, keeps its own motion', () => {
  const missing = jointedModel()
  missing.joint('left-foot').removeFromParent()
  const footless = ok(createMeshMascot({ scene: missing.scene, animations: [] }, 2.5))
  assert.equal(footless.pose, undefined)
  assert.match(footless.poseGap ?? '', /left-foot/)
  const turned = jointedModel()
  turned.joint('chest').rotation.x = 0.3
  const hunched = ok(createMeshMascot({ scene: turned.scene, animations: [] }, 2.5))
  assert.equal(hunched.pose, undefined)
  assert.match(hunched.poseGap ?? '', /chest/)
  assert.equal(ok(createMeshMascot({ scene: jointedModel().scene, animations: [] }, 2.5)).poseGap, undefined)
})

test('a habit keeps its head motion while the head watches the visitor', () => {
  const { scene, joint } = jointedModel()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  // The watched point is straight ahead, so every tilt of the head comes from the habit.
  const look = { target: mascot.facePoint(new Vector3()).add(new Vector3(0, 0, 10)), weight: 1, tilt: 0 }
  const tilt = poseMannerisms([{ mannerism: { _tag: 'HeadTilt' }, age: 0.9 }])
  for (let frame = 0; frame < 3; frame++) mascot.pose!({ ...standing, mannerism: tilt }, look)
  const up = new Vector3(0, 1, 0).applyQuaternion(joint('head').quaternion)
  assert.ok(Math.abs(Math.atan2(up.x, up.y)) > 0.25, 'The head tilt must show while he watches the visitor.')
  mascot.pose!(standing, look)
  const settled = new Vector3(0, 1, 0).applyQuaternion(joint('head').quaternion)
  assert.ok(Math.abs(Math.atan2(settled.x, settled.y)) < 0.01, 'The tilt must end with the habit.')
})
