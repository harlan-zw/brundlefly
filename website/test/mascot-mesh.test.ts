import assert from 'node:assert/strict'
import test from 'node:test'
import { AnimationClip, Bone, Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Object3D, Quaternion, QuaternionKeyframeTrack, ShaderLib, SphereGeometry, Texture, UniformsUtils, Vector2, Vector3, VectorKeyframeTrack } from 'three'
import type { WebGLRenderer } from 'three'
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
  // A full stride at its widest: the hips swing in opposite directions, further than the relief rig's 0.22 rad.
  mascot.pose({ ...standing, gait: 1, walkPhase: Math.PI / 2 })
  close(joint('left-hip').rotation.x, 0.32)
  close(joint('right-hip').rotation.x, -0.32)
  // The chest twists against the pelvis, so his shoulders counter his hips.
  assert.ok(joint('pelvis').rotation.y > 0.08 && joint('chest').rotation.y < -0.1)
  // As a foot leaves the floor its knee folds further than on the relief rig, and the other knee does not.
  mascot.pose({ ...standing, gait: 1, walkPhase: 0 })
  close(joint('left-knee').rotation.x, -0.4)
  close(joint('right-knee').rotation.x, 0)
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

test('a model with a turned root takes a heading, and its head stays toward the viewer at rest', () => {
  const { scene, node, joint } = jointedModel()
  // The file turns its root to the three-quarter stance of the artwork.
  node.rotation.y = 0.5
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  const yaw = (object: Object3D) => { mascot.root.updateMatrixWorld(true); const forward = new Vector3(0, 0, 1).transformDirection(object.matrixWorld); return Math.atan2(forward.x, forward.z) }
  assert.equal(mascot.restHeading, 0.5)
  // With no heading he keeps the file's own turn.
  mascot.pose!(standing)
  close(yaw(joint('pelvis')), 0.5)
  close(yaw(joint('head')), 0)
  mascot.pose!(standing, undefined, -0.5)
  close(yaw(joint('pelvis')), -0.5)
  close(yaw(joint('head')), 0)
  // Mid-turn he faces the viewer squarely.
  mascot.pose!(standing, undefined, 0)
  close(yaw(joint('pelvis')), 0)
  // At a full stride he faces his travel, and the head keeps half of the body's turn, so he looks along his path.
  mascot.pose!({ ...standing, gait: 1, walkPhase: 0 }, undefined, -1.2)
  close(yaw(joint('pelvis')), -1.2)
  assert.ok(Math.abs(yaw(joint('head')) + 0.6) < 0.05, 'The head must keep part of the turn while he walks.')
  // A file with no root turn does not turn.
  const plain = jointedModel()
  const unturned = ok(createMeshMascot({ scene: plain.scene, animations: [] }, 2.5))
  assert.equal(unturned.restHeading, 0)
  unturned.pose!(standing, undefined, -1)
  unturned.root.updateMatrixWorld(true)
  assert.ok(plain.node.quaternion.angleTo(new Quaternion()) < 1e-9)
})

/** A jointed model with two eyeball meshes and four lid joints under the head, as the figurine file has them. */
function eyedModel() {
  const model = jointedModel()
  const head = model.joint('head')
  const place = <T extends Object3D>(node: T, name: string, x: number) => {
    node.name = name
    node.position.set(x, 1, 15)
    head.add(node)
    return node
  }
  const authored = new MeshStandardMaterial()
  const eyes = [-4, 4].map((x, index) => place(new Mesh(new SphereGeometry(1, 8, 6), authored), `Brundlefly-eye-${index}`, x))
  // The file gives each eye the head's roll as its rest rotation, and its own size.
  eyes.forEach((eye, index) => { eye.rotation.z = -0.2; eye.scale.setScalar(index ? 2.6 : 3) })
  const lids = {
    upper: [place(new Bone(), 'face-upper-lid-0', -4), place(new Bone(), 'face-upper-lid-1', 4)],
    lower: [place(new Bone(), 'face-lower-lid-0', -4), place(new Bone(), 'face-lower-lid-1', 4)],
  }
  return { ...model, eyes, lids, authored }
}
test('the eye line sits between his eyes and follows his head, and a file without eyes gives the face point', () => {
  const { scene, joint } = eyedModel()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  const head = joint('head')
  const between = () => { head.updateWorldMatrix(true, false); return head.localToWorld(new Vector3(0, 1, 15)) }
  assert.ok(mascot.eyeLine(new Vector3()).distanceTo(between()) < 1e-9)
  const rest = mascot.eyeLine(new Vector3())
  head.rotation.y = 0.4
  assert.ok(mascot.eyeLine(new Vector3()).distanceTo(between()) < 1e-9)
  assert.ok(mascot.eyeLine(new Vector3()).distanceTo(rest) > 1e-3, 'A turned head must move the eye line.')
  const plain = ok(createMeshMascot({ scene: millimetreModel().scene, animations: [] }, 2.5))
  assert.deepEqual(plain.eyeLine(new Vector3()).toArray(), plain.facePoint(new Vector3()).toArray())
})

/** What the wet-eye shader receives for an eyeball: the gaze as yaw and pitch in the head's frame, and the pupil radius. */
function eyeUniforms(eye: Mesh) {
  const material = eye.material as MeshStandardMaterial
  const shader = { vertexShader: ShaderLib.physical.vertexShader, fragmentShader: ShaderLib.physical.fragmentShader,
    uniforms: UniformsUtils.clone(ShaderLib.physical.uniforms) }
  material.onBeforeCompile(shader, {} as WebGLRenderer)
  const forward = (shader.uniforms.uGaze!.value as Vector3).clone().applyQuaternion(eye.quaternion)
  return { yaw: Math.atan2(forward.x, forward.z), pitch: Math.asin(forward.y), pupil: shader.uniforms.uPupil!.value as number, shader }
}

test('both eyeballs take the wet-eye shader, look ahead at rest, and watch a point within the lid opening', () => {
  const { scene, eyes, authored } = eyedModel()
  let authoredReleased = false
  authored.addEventListener('dispose', () => { authoredReleased = true })
  const rest = eyes[0]!.quaternion.clone()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  assert.ok(authoredReleased, 'The file\'s eye material must be released when the shader replaces it.')
  assert.equal(eyes[0]!.material, eyes[1]!.material)
  assert.match(eyeUniforms(eyes[0]!).shader.fragmentShader, /uGaze/)
  mascot.pose!({ ...standing, eyes: { _tag: 'Ahead' } })
  const ahead = eyeUniforms(eyes[0]!)
  assert.ok(Math.abs(ahead.yaw) < 1e-6 && Math.abs(ahead.pitch) < 1e-6)
  // A point far up and to screen right is beyond both limits. `time` advances, so each call is a new frame.
  const target = mascot.facePoint(new Vector3()).add(new Vector3(40, 40, 10))
  for (let frame = 0; frame < 120; frame++) mascot.pose!({ ...standing, time: frame / 60, eyes: { _tag: 'Watch', target } })
  const watching = eyeUniforms(eyes[1]!)
  assert.ok(Math.abs(watching.yaw - 0.35) < 0.02 && Math.abs(watching.pitch - 0.22) < 0.02, `The gaze must stop at its limits, not at ${watching.yaw.toFixed(2)}, ${watching.pitch.toFixed(2)}.`)
  assert.ok(watching.pupil > ahead.pupil + 0.04, 'A watched visitor must dilate the pupil.')
  // The gaze slides the iris under the cornea. The eyeball itself keeps its rest rotation.
  assert.ok(eyes[0]!.quaternion.angleTo(rest) < 1e-6)
})

test('wandering eyes move on their own and stay inside the lid opening', () => {
  const { scene, eyes } = eyedModel()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  let widest = 0
  for (let frame = 0; frame < 1500; frame++) {
    mascot.pose!({ ...standing, time: frame / 60, eyes: { _tag: 'Wander' } })
    if (frame % 10) continue
    const { yaw, pitch } = eyeUniforms(eyes[0]!)
    assert.ok(Math.abs(yaw) <= 0.36 && Math.abs(pitch) <= 0.23, 'The iris must stay inside the opening.')
    widest = Math.max(widest, Math.abs(yaw))
  }
  assert.ok(widest > 0.2, 'The eyes must travel while they wander.')
})

test('a blink closes the upper lid down and the lower lid up, and an open eye leaves both at rest', () => {
  const { scene, lids } = eyedModel()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  mascot.pose!({ ...standing, blink: 1 })
  // Without the relief rig's eyes, the file's own lids shut over the relief rig's lid travel.
  for (const lid of lids.upper) close(lid.rotation.x, 0.96)
  for (const lid of lids.lower) close(lid.rotation.x, -0.96)
  mascot.pose!({ ...standing, blink: 0.5 })
  close(lids.upper[0]!.rotation.x, 0.48)
  mascot.pose!({ ...standing, blink: 0 })
  for (const lid of [...lids.upper, ...lids.lower]) close(lid.rotation.x, 0)
  // A squint narrows the smaller, screen-right eye more than the larger one, as on the relief rig.
  mascot.pose!({ ...standing, blink: 0, squint: 0.5 })
  assert.ok(lids.upper[1]!.rotation.x > lids.upper[0]!.rotation.x && lids.upper[0]!.rotation.x > 0)
  // A file without eyes or lids poses as before.
  assert.doesNotThrow(() => ok(createMeshMascot({ scene: jointedModel().scene, animations: [] }, 2.5)).pose!({ ...standing, blink: 1, eyes: { _tag: 'Wander' } }))
})

/** The reference head's artwork, as a host supplies it: an opaque square, so every eye point lies inside it. */
function eyeDressing() {
  const [width, height] = [40, 44]
  return { projection: { texture: new Texture(), raster: { width, height, data: new Uint8ClampedArray(width * height * 4).fill(200) } }, skin: new Texture() }
}

test('dressed eyes take the relief rig\'s proportions, artwork shader, and shell lids at each eye node', () => {
  const { scene, eyes, lids, joint } = eyedModel()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  mascot.dressEyes(eyeDressing())
  const head = joint('head')
  const built = [0, 1].map(index => head.getObjectByName(`reference-eye-${index}`)!)
  // Each built eye stands where its node stands, with the node's roll, and the node itself is hidden.
  built.forEach((root, index) => {
    assert.ok(root.position.distanceTo(eyes[index]!.position) < 1e-9 && root.quaternion.angleTo(eyes[index]!.quaternion) < 1e-6)
    assert.equal(eyes[index]!.visible, false)
  })
  // The node sets the width. The height and depth keep the relief rig's proportions for that eye.
  const globeGeometry = (built[0]!.children[0] as Mesh).geometry
  globeGeometry.computeBoundingBox()
  const size = globeGeometry.boundingBox!.getSize(new Vector3())
  close(size.x / 2, 3)
  assert.ok(Math.abs(size.y / size.x - 0.074 / 0.078) < 0.02, 'The larger eye must keep the reference height.')
  // A model's socket is up to 1.09 times its globe across. Each lid shell is wider than that, so no hollow shows past its rim.
  const lidGeometry = (head.getObjectByName('reference-lower-lid-0')!.children[0] as Mesh).geometry
  lidGeometry.computeBoundingBox()
  assert.ok(lidGeometry.boundingBox!.getSize(new Vector3()).x / size.x > 1.1, 'The lid must reach past the socket.')
  // Open lids stand 0.96 rad back from shut, and a blink brings both shells together, as on the relief rig.
  const hinge = (name: string) => head.getObjectByName(name)!
  mascot.pose!({ ...standing, blink: 0 })
  close(hinge('reference-upper-lid-0').rotation.x, -0.96)
  close(hinge('reference-lower-lid-0').rotation.x, 0.96)
  mascot.pose!({ ...standing, blink: 1 })
  close(hinge('reference-upper-lid-1').rotation.x, 0)
  close(hinge('reference-lower-lid-1').rotation.x, 0)
  // The file's own lid joints stay at rest once the reference lids blink.
  for (const lid of [...lids.upper, ...lids.lower]) close(lid.rotation.x, 0)
  // A squint shuts the smaller, screen-right eye further.
  mascot.pose!({ ...standing, blink: 0, squint: 0.5 })
  assert.ok(hinge('reference-upper-lid-1').rotation.x > hinge('reference-upper-lid-0').rotation.x)
  // The gaze reaches the built globes through the same shader uniforms, with the relief rig's wider range.
  const target = mascot.facePoint(new Vector3()).add(new Vector3(40, 0, 10))
  for (let frame = 0; frame < 60; frame++) mascot.pose!({ ...standing, time: frame / 60, eyes: { _tag: 'Watch', target } })
  const globe = built[1]!.children[0] as Mesh
  globe.quaternion.copy(built[1]!.quaternion)
  assert.ok(Math.abs(eyeUniforms(globe).yaw - 0.55) < 0.02)
})

test('disposal removes the dressed eyes and leaves the host\'s textures', () => {
  const { scene, joint } = eyedModel()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  const dressing = eyeDressing()
  let hostReleased = false
  for (const texture of [dressing.projection.texture, dressing.skin]) texture.addEventListener('dispose', () => { hostReleased = true })
  mascot.dressEyes(dressing)
  const shell = (joint('head').getObjectByName('reference-upper-lid-0')!.children[0] as Mesh).geometry
  let shellReleased = false
  shell.addEventListener('dispose', () => { shellReleased = true })
  mascot.dispose()
  assert.ok(shellReleased, 'The lid shells must be released.')
  assert.equal(joint('head').getObjectByName('reference-eye-0'), undefined)
  assert.equal(hostReleased, false, 'The host owns the artwork and the skin texture.')
})

test('his voice drops the jaw and a raised brow lifts the brow, by the relief rig\'s travel in the mascot\'s own units', () => {
  const { scene, joint } = jointedModel()
  const head = joint('head')
  const add = (name: string, x: number, y: number) => {
    const bone = new Bone()
    bone.name = name
    bone.position.set(x, y, 12)
    head.add(bone)
    return bone
  }
  const [jaw, cheekLeft, cheekRight, browLeft, browRight] = [add('face-jaw', 0, -2), add('face-cheek-left', -6, 0), add('face-cheek-right', 5, 0), add('face-brow-0', -4, 4), add('face-brow-1', 4, 3)]
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  // Travel is read in the head's frame and in the mascot's units, so the check holds for a file in any unit.
  // His voice also turns the head a little, so a world position would mix the two.
  mascot.root.updateMatrixWorld(true)
  const unit = head.getWorldScale(new Vector3()).x
  const place = (bone: Object3D) => bone.position.clone().multiplyScalar(unit)
  mascot.pose!(standing)
  const rest = [jaw, cheekLeft, cheekRight, browLeft, browRight].map(place)
  mascot.pose!({ ...standing, speaking: 1, brow: 1 })
  const moved = [jaw, cheekLeft, cheekRight, browLeft, browRight].map(place)
  close(moved[0]!.y - rest[0]!.y, -0.055)
  close(moved[0]!.z - rest[0]!.z, 0.018)
  close(jaw.rotation.x, -0.16)
  close(moved[1]!.x - rest[1]!.x, -0.004)
  close(moved[2]!.x - rest[2]!.x, 0.006)
  close(moved[3]!.y - rest[3]!.y, 0.018)
  close(moved[4]!.y - rest[4]!.y, 0.027)
  // A silent, level face returns every joint to rest.
  mascot.pose!(standing)
  ;[jaw, cheekLeft, cheekRight, browLeft, browRight].forEach((bone, index) => assert.ok(place(bone).distanceTo(rest[index]!) < 1e-9))
})

test('a lid takes the skin the model names for its eye, and the relief rig\'s lid skin without one', () => {
  const dressed = (name: string, map?: Texture) => {
    const { scene, eyes, joint } = eyedModel()
    const skin = new MeshStandardMaterial({ color: '#C8642D', name, map: map ?? null })
    eyes[0]!.material = skin
    const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
    const dressing = eyeDressing()
    mascot.dressEyes(dressing)
    const lid = (index: number) => (joint('head').getObjectByName(`reference-upper-lid-${index}`)!.children[0] as Mesh).material as MeshStandardMaterial
    return { lid, dressing, mascot }
  }
  const named = dressed('Brundlefly-lid')
  // The named eye's lids are that colour, with no artwork over it. The other eye keeps the relief rig's lid skin.
  assert.equal(named.lid(0).color.getHexString(), 'c8642d')
  assert.equal(named.lid(0).map, null)
  assert.equal(named.lid(1).map, named.dressing.skin)
  // A named skin texture goes on the lids. It outlives the eye node's material and leaves with the mascot.
  const modelSkin = new Texture()
  let released = false
  modelSkin.addEventListener('dispose', () => { released = true })
  const textured = dressed('Brundlefly-lid', modelSkin)
  assert.equal(textured.lid(0).map, modelSkin)
  assert.equal(released, false, 'The lid texture must stay while the lids use it.')
  textured.mascot.dispose()
  assert.ok(released, 'The lid texture must be released with the mascot.')
  // Any other material name is the file's own eye material, and gives no lid colour.
  const plain = dressed('Brundlefly-eye')
  assert.equal(plain.lid(0).map, plain.dressing.skin)
})

test('standing, his weight shifts from leg to leg while both legs stay upright', () => {
  const { scene, joint } = jointedModel()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  // A quarter of the way through the slow shift, his weight is fully on one side.
  mascot.pose!({ ...standing, time: Math.PI / 2 / 0.42 })
  const roll = joint('pelvis').rotation.z
  assert.ok(roll > 0.03, 'The pelvis must roll.')
  close(joint('left-hip').rotation.z, -roll)
  close(joint('right-hip').rotation.z, -roll)
  assert.ok(mascot.root.children[0]!.position.x > 0.01, 'His body must move over the loaded leg.')
  // A full stride leaves no weight shift.
  mascot.pose!({ ...standing, time: Math.PI / 2 / 0.42, gait: 1, walkPhase: 0 })
  close(mascot.root.children[0]!.position.x, 0)
})

test('through the walk one foot always rests at its floor height and neither foot goes below it', () => {
  const { scene, joint } = jointedModel()
  // Legs as chains, with the feet staggered in depth as in the artwork's stance: the left foot forward, the right foot back.
  for (const [side, depth] of [['left', 6], ['right', -6]] as const) {
    joint(`${side}-hip`).position.set(side === 'left' ? -8 : 8, 46, 0)
    joint(`${side}-hip`).add(joint(`${side}-knee`))
    joint(`${side}-knee`).position.set(0, -16, depth)
    joint(`${side}-knee`).add(joint(`${side}-foot`))
    joint(`${side}-foot`).position.set(0, -14, depth / 2)
  }
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  const heights = () => (['left-foot', 'right-foot'] as const).map(name => mascot.root.worldToLocal(joint(name).getWorldPosition(new Vector3())).y)
  mascot.pose!(standing)
  const rest = heights()
  let lifted = 0
  for (let step = 0; step < 16; step++) {
    mascot.pose!({ ...standing, gait: 1, walkPhase: step * Math.PI / 8 })
    const above = heights().map((height, index) => height - rest[index]!)
    assert.ok(Math.min(...above) > -1e-6, `A foot is below the floor at step ${step}.`)
    assert.ok(Math.min(...above) < 1e-6, `Both feet are off the floor at step ${step}.`)
    lifted = Math.max(lifted, ...above)
  }
  assert.ok(lifted > 0.02, 'The free foot must lift clear of the floor during a step.')
  // The foot he stands on lies level at every step, whatever its leg does. So its sole is flat on the floor.
  const level = new Quaternion()
  let freeTurn = 0
  for (let step = 0; step < 16; step++) {
    mascot.pose!({ ...standing, gait: 1, walkPhase: step * Math.PI / 8 })
    heights().forEach((height, index) => {
      const tilt = joint(index === 0 ? 'left-foot' : 'right-foot').getWorldQuaternion(new Quaternion()).angleTo(level)
      if (height - rest[index]! < 1e-6) assert.ok(tilt < 1e-6, `The foot he stands on is tilted at step ${step}.`)
      else if (height - rest[index]! > 0.05) freeTurn = Math.max(freeTurn, tilt)
    })
  }
  assert.ok(freeTurn > 0.05, `A foot clear of the floor keeps its own turn, not ${freeTurn} with a lift of ${lifted}.`)
  // One walk cycle covers the ground both feet travel under him. With these legs that is well under his height.
  assert.ok(mascot.strideLength! > 0.2 && mascot.strideLength! < 2, `The stride must be a plausible length, not ${mascot.strideLength}.`)
})

/** Legs as chains at the figurine's own joint places, in millimetres. His feet stand 18 and 12 millimetres from the axis he turns about. */
function leggedModel() {
  const model = jointedModel()
  model.node.rotation.y = 0.5
  const place = (side: 'left' | 'right', hip: [number, number, number], knee: [number, number, number], foot: [number, number, number]) => {
    model.joint(`${side}-hip`).position.set(...hip)
    model.joint(`${side}-hip`).add(model.joint(`${side}-knee`))
    model.joint(`${side}-knee`).position.set(knee[0] - hip[0], knee[1] - hip[1], knee[2] - hip[2])
    model.joint(`${side}-knee`).add(model.joint(`${side}-foot`))
    model.joint(`${side}-foot`).position.set(foot[0] - knee[0], foot[1] - knee[1], foot[2] - knee[2])
  }
  place('left', [-7, 31.5, -2.9], [-9.3, 25, 6.6], [-18, 10, 1.6])
  place('right', [1.2, 31.4, -7.4], [8.5, 22.8, -1.5], [6, 9.7, -10.4])
  return model
}

test('he turns in place on lifted feet, and the foot he stands on stays where it is', () => {
  const { scene, joint } = leggedModel()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  const names = ['left-foot', 'right-foot'] as const
  const places = () => names.map(name => mascot.root.worldToLocal(joint(name).getWorldPosition(new Vector3())))
  mascot.pose!(standing, undefined, 0.5)
  const rest = places()
  // A figure on a turntable drags each foot along an arc: its distance from the axis, times the turn.
  const turntable = rest.reduce((sum, foot) => sum + Math.hypot(foot.x, foot.z), 0) * 1
  // He turns one radian, to the other side, at the pace of his steps in place: 1.2 radians and 12 radians of step cycle a second.
  let before = rest
  let slid = 0
  const lifted = [0, 0]
  const frames = 50
  for (let step = 1; step <= frames; step++) {
    const time = step / 60
    mascot.pose!({ ...standing, time, stepInPlace: 1, stepPhase: time * 12 }, undefined, 0.5 - step / frames)
    const now = places()
    const heights = now.map((foot, index) => foot.y - rest[index]!.y)
    heights.forEach((height, index) => { lifted[index] = Math.max(lifted[index]!, height) })
    // The foot that carries him is the lower one, in this frame and in the frame before.
    const support = heights[1]! < heights[0]! ? 1 : 0
    const carried = before[support]!.y - rest[support]!.y < 1e-6 && heights[support]! < 1e-6
    if (carried) slid += Math.hypot(now[support]!.x - before[support]!.x, now[support]!.z - before[support]!.z)
    before = now
  }
  assert.ok(lifted[0]! > 0.02 && lifted[1]! > 0.02, `Each foot must leave the floor in turn, not ${lifted}.`)
  assert.ok(slid < turntable * 0.2, `The foot he stands on slid ${slid.toFixed(3)} of a turntable's ${turntable.toFixed(3)}.`)
  // The turn moved his place a little. A walk brings him back onto his route.
  for (let step = 1; step <= 120; step++) mascot.pose!({ ...standing, time: frames / 60 + step / 60, gait: 1, walkPhase: step * 0.1 }, undefined, -0.5)
  mascot.pose!({ ...standing, time: 4 }, undefined, -0.5)
  const fresh = leggedModel()
  const reference = ok(createMeshMascot({ scene: fresh.scene, animations: [] }, 2.5))
  reference.pose!({ ...standing, time: 4 }, undefined, -0.5)
  const [walked, expected] = [mascot, reference].map((value, index) => value.root.worldToLocal((index ? fresh.joint : joint)('pelvis').getWorldPosition(new Vector3())))
  assert.ok(Math.hypot(walked!.x - expected!.x, walked!.z - expected!.z) < 0.01, 'After a walk he must stand on his route again.')
})

test('a pose without steps in place is the pose it was', () => {
  const [plain, stepping] = [leggedModel(), leggedModel()]
  ok(createMeshMascot({ scene: plain.scene, animations: [] }, 2.5)).pose!({ ...standing, time: 1.3 })
  ok(createMeshMascot({ scene: stepping.scene, animations: [] }, 2.5)).pose!({ ...standing, time: 1.3, stepInPlace: 0, stepPhase: 2 })
  for (const name of bodyJointNames) assert.deepEqual(stepping.joint(name).quaternion.toArray(), plain.joint(name).quaternion.toArray(), name)
})
