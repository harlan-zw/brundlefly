import { AnimationMixer, Box3, BufferAttribute, Color, CylinderGeometry, DataTexture, Euler, Group, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, SkinnedMesh, SRGBColorSpace, Texture, Vector3 } from 'three'
import type { AnimationClip, Material } from 'three'
import { fixationDrift, lookToward, pupilDirection, pupilSize, wanderingLook } from './eye-gaze.ts'
import type { EyeFocus, Look } from './eye-gaze.ts'
import { createEyeMaterial } from './eye-material.ts'
import { referenceEyes as reliefEyes, referenceFace } from './face.ts'
import { createReferenceEyes } from './mascot-eyes.ts'
import { cycleReach, cycleToMidStance, footCycle, hipDrop, landingReach, solveLeg, swingLift, swingShare, swingStep, swingTravel } from './mascot-legs.ts'
import type { EyeDressing, LidSkin } from './mascot-eyes.ts'
import { addBodyDepth, bodyJointNames, poseBody } from './mascot-pose.ts'
import type { BodyJointName, MascotPoseInput } from './mascot-pose.ts'

/** Served copy of assets/3d/brundlefly/brundlefly-web.glb. The brand sync script owns that copy. */
export const meshMascotUrl = '/brand/3d/brundlefly-web.glb'
/** Height of the relief rig in its own units. Both mascots fill the same space. */
export const reliefStandingHeight = 2.5

export type MeshMascotSource = { scene: Object3D, animations: readonly AnimationClip[] }
// Every sway component is a whole multiple of one base rate, so the whole pose repeats after one period.
const swayRate = 0.115
const swayPeriod = Math.PI * 2 / swayRate
/** A file with clips plays its idle clip. A file without clips sways as one object. */
export type MeshMascotMotion = { _tag: 'Clip', name: string } | { _tag: 'Sway' }
/** Turns a `head` joint toward a world point. `weight` blends from the clip pose (0) to the full turn (1). `tilt` is a roll in radians. */
export type MeshMascotLook = { target: Vector3, weight: number, tilt: number }
// The head turns less far than the eyes of the relief rig, so the neck never folds.
const maxHeadYaw = 0.6
const maxHeadPitch = 0.35
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))
const restRotation = new Quaternion()
const atRest = (joint: Object3D) => joint.quaternion.angleTo(restRotation) < 1e-3
type BodyJoints = { _tag: 'Ok', joints: Map<BodyJointName, Object3D> } | { _tag: 'Err', reason: string }
/** The pose code needs every body joint by name, each with an identity rest rotation. A file that lacks one keeps its own clip. */
function findBodyJoints(scene: Object3D): BodyJoints {
  const joints = new Map<BodyJointName, Object3D>()
  for (const name of bodyJointNames) {
    const joint = scene.getObjectByName(name)
    if (!joint) return { _tag: 'Err', reason: `The file has no joint named ${name}.` }
    if (!atRest(joint)) return { _tag: 'Err', reason: `The joint ${name} has a rest rotation. The pose code needs an identity rest rotation.` }
    joints.set(name, joint)
  }
  return { _tag: 'Ok', joints }
}
/** Face tentacles, from screen left to right. The relief rig has none, so they have their own motion. */
function findMouthparts(scene: Object3D) {
  const mouthparts: { base: Object3D, tip: Object3D | undefined }[] = []
  for (let index = 0; ; index++) {
    const base = scene.getObjectByName(`mouthpart-${index}`)
    if (!base || !atRest(base)) return mouthparts
    const tip = scene.getObjectByName(`mouthpart-${index}-tip`)
    mouthparts.push({ base, tip: tip && atRest(tip) ? tip : undefined })
  }
}
/** How far a finger closes at a full curl, in radians: at its root and at its tip. The fingers close about their own x axis. */
export const fingerCurl = { root: 0.9, tip: 0.8 }
type Finger = { root: Object3D, tip: Object3D | undefined, rootRest: Euler, tipRest: Euler | undefined }
/** The five fingers of each long hand, when the file has them. A hand without finger joints keeps the shape of the model. */
function findFingers(scene: Object3D) {
  const hand = (side: 'left' | 'right') => Array.from({ length: 5 }, (_, index): Finger | undefined => {
    const root = scene.getObjectByName(`${side}-finger-${index}`)
    if (!root) return undefined
    const tip = scene.getObjectByName(`${side}-finger-${index}-tip`)
    return { root, tip, rootRest: root.rotation.clone(), tipRest: tip?.rotation.clone() }
  })
  return { left: hand('left'), right: hand('right') }
}
/**
 * A marker for one long hand, hidden until a habit has the hand hold it. It lies along the middle finger, with its tip past the knuckle.
 * A hand without a middle finger joint gets none.
 */
/** How far the marker lies from the middle of his hand toward his palm, as a share of its own length. */
export const markerInPalm = 0.22
function createMarker(middle: Finger | undefined) {
  const hand = middle?.root.parent
  if (!middle || !hand) return undefined
  const along = middle.root.position.clone()
  const length = along.length() * 1.6
  const body = new Mesh(new CylinderGeometry(length * 0.06, length * 0.06, length, 8), new MeshStandardMaterial({ color: '#20292b', roughness: 0.55 }))
  const tip = new Mesh(new CylinderGeometry(length * 0.035, length * 0.05, length * 0.16, 8), new MeshStandardMaterial({ color: '#3f9aa3', roughness: 0.5 }))
  tip.position.y = length * 0.58
  const marker = new Group()
  marker.name = 'held-marker'
  marker.add(body, tip)
  // A cylinder stands along y. The marker points the way the middle finger does.
  marker.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), along.clone().normalize())
  // It lies against his palm, not through his hand. His fingers close about their own x axis, so a fingertip that curls moves toward the palm:
  // that way is the finger's x axis crossed with the way the finger points.
  const palm = new Vector3(1, 0, 0).applyQuaternion(middle.root.quaternion).cross(along.clone().normalize()).normalize()
  marker.position.copy(along).multiplyScalar(0.9).addScaledVector(palm, length * markerInPalm)
  marker.visible = false
  hand.add(marker)
  // The model's own release frees the marker with every other mesh under the scene.
  return marker
}
/**
 * A specimen jar for one long hand, hidden until a habit has the hand hold it. He takes it from above: his palm is on its lid, and his long fingers close down round it.
 * The jar hangs from his palm and stays upright however his wrist turns, as a jar held by its lid does. A jar fixed to his hand lay on its side when he reached for it.
 * The office model is one mesh, so no jar leaves the shelf: this is the jar he takes from behind the others.
 */
function createJar(middle: Finger | undefined) {
  const hand = middle?.root.parent
  if (!middle || !hand) return undefined
  const along = middle.root.position.clone()
  const reach = along.length()
  const tall = reach * 1.7
  const wide = reach * 0.5
  const glass = new Mesh(new CylinderGeometry(wide, wide, tall, 12, 1, true), new MeshStandardMaterial({ color: '#cfe6dc', roughness: 0.12, transparent: true, opacity: 0.38, depthWrite: false }))
  const lid = new Mesh(new CylinderGeometry(wide * 1.06, wide * 1.06, tall * 0.12, 12), new MeshStandardMaterial({ color: '#3d4a45', roughness: 0.6 }))
  lid.position.y = tall * 0.5
  const floor = new Mesh(new CylinderGeometry(wide, wide, tall * 0.04, 12), new MeshStandardMaterial({ color: '#9fb5ab', roughness: 0.3 }))
  floor.position.y = -tall * 0.5
  // What floats in it. He does not say what it is.
  const specimen = new Mesh(new CylinderGeometry(wide * 0.5, wide * 0.36, tall * 0.5, 7), new MeshStandardMaterial({ color: '#aa604b', roughness: 0.8 }))
  specimen.position.y = -tall * 0.12
  const jar = new Group()
  jar.name = 'held-jar'
  jar.add(specimen, floor, lid, glass)
  const forward = along.clone().normalize()
  const across = new Vector3(1, 0, 0).applyQuaternion(middle.root.quaternion).normalize()
  const palm = across.clone().cross(forward).normalize()
  // The point of his palm that rests on the lid, in the hand's own frame.
  // The jar is as wide as his palm is long, so its middle is under the middle of his palm. His knuckles are then at its rim, and his fingers go down its outside.
  const grip = along.clone().multiplyScalar(0.5).addScaledVector(palm, reach * 0.22)
  jar.visible = false
  hand.add(jar)
  const turned = new Quaternion(), down = new Vector3()
  /** Hangs the jar from his palm, upright in the world. The scene calls it after his arm has its pose. */
  const hang = () => {
    hand.updateWorldMatrix(true, false)
    hand.getWorldQuaternion(turned).invert()
    // A cylinder stands along y, so this turn stands it up in the world.
    jar.quaternion.copy(turned)
    // The lid hangs a little under his palm, so his bent hand does not sink into it.
    jar.position.copy(grip).addScaledVector(down.set(0, -1, 0).applyQuaternion(turned), tall * 0.5 + reach * 0.3)
  }
  // The model's own release frees the jar with every other mesh under the scene.
  return { jar, hang }
}
type FaceJoint = { joint: Object3D, rest: Vector3, unit: number }
/**
 * The relief rig's face joints, each optional. `unit` is one face unit of the relief rig in the joint's own units,
 * so the relief rig's travel suits a file in any unit.
 */
function findFaceJoints(scene: Object3D) {
  const find = (name: string): FaceJoint | undefined => {
    const joint = scene.getObjectByName(name)
    if (!joint?.parent || !atRest(joint)) return undefined
    return { joint, rest: joint.position.clone(), unit: 1 / joint.parent.getWorldScale(new Vector3()).x }
  }
  return { jaw: find('face-jaw'), cheekLeft: find('face-cheek-left'), cheekRight: find('face-cheek-right'), brows: [find('face-brow-0'), find('face-brow-1')] }
}
type MeshEye = { node: Object3D | undefined, lid: LidSkin | undefined, upperLid: Object3D | undefined, lowerLid: Object3D | undefined }
/**
 * A model names the skin beside an eye by giving that eye node a material named `Brundlefly-lid`: a base colour, and a skin texture if it has one.
 */
function namedLidSkin(node: Object3D | undefined): LidSkin | undefined {
  if (!(node instanceof Mesh) || Array.isArray(node.material)) return undefined
  const material: Material & { color?: unknown, map?: unknown } = node.material
  if (material.name !== lidMaterialName || !(material.color instanceof Color)) return undefined
  // The colour stays the material's own, so a host that shades the model again reaches the lids too.
  return { colour: material.color, map: material.map instanceof Texture ? material.map : undefined }
}
/** Eyeballs and their lids, from screen left to right. Each part is optional, so a file can have eyes that aim and no lids that blink. */
function findEyes(scene: Object3D) {
  const eyes: MeshEye[] = []
  for (let index = 0; ; index++) {
    const node = scene.getObjectByName(`Brundlefly-eye-${index}`)
    const [upperLid, lowerLid] = [`face-upper-lid-${index}`, `face-lower-lid-${index}`].map((name) => {
      const lid = scene.getObjectByName(name)
      return lid && atRest(lid) ? lid : undefined
    })
    if (!node && !upperLid && !lowerLid) return eyes
    eyes.push({ node, lid: namedLidSkin(node), upperLid, lowerLid })
  }
}
// The file's own eyeballs sit behind a narrow lid opening. The iris stays inside it at these turns, in radians.
// The relief rig's eyes have their own, wider range.
const maxEyeYaw = 0.35
const maxEyePitch = 0.22
/** The relief rig's wet-eye shader draws each eyeball, so both mascots have the same eyes. The file's own eye material is released. */
function dressEyes(nodes: readonly Object3D[]) {
  const globes: Mesh[] = []
  for (const node of nodes) node.traverse((object) => { if (object instanceof Mesh) globes.push(object) })
  if (globes.length === 0) return undefined
  // The shader paints the iris and the pupil over a base texture. One blue-black texel is the globe.
  const globe = new DataTexture(new Uint8Array([10, 13, 17, 255]), 1, 1)
  globe.colorSpace = SRGBColorSpace
  globe.needsUpdate = true
  const eye = createEyeMaterial(globe)
  const released = new Set<Mesh['material']>()
  for (const mesh of globes) {
    if (!released.has(mesh.material)) { released.add(mesh.material); releaseMaterials(mesh) }
    mesh.material = eye.material
    // The shader places the iris by the direction of each vertex from the centre of the eyeball.
    const position = mesh.geometry.getAttribute('position')
    const directions = new Float32Array(position.count * 3)
    const direction = new Vector3()
    for (let index = 0; index < position.count; index++) direction.fromBufferAttribute(position, index).normalize().toArray(directions, index * 3)
    mesh.geometry.setAttribute('eyeSphere', new BufferAttribute(directions, 3))
  }
  return eye
}
// One slow cycle of the mouthparts, in radians for each second.
const mouthpartRate = Math.PI * 2 / 4
export type MeshMascot = ReturnType<typeof assemble>
export type MeshMascotResult = { _tag: 'Ok', mascot: MeshMascot } | { _tag: 'Err', reason: string }

const lidMaterialName = 'Brundlefly-lid'
function releaseMaterials(mesh: Mesh) {
  for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[]) {
    // A lid material's texture goes on to the built lids. It is released with the mascot.
    if (material.name !== lidMaterialName) for (const value of Object.values(material)) if (value instanceof Texture) value.dispose()
    material.dispose()
  }
}
/** Releases every GPU resource a loaded model holds. */
export function releaseMeshSource(scene: Object3D) {
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.geometry.dispose()
    if (object instanceof SkinnedMesh) object.skeleton.dispose()
    releaseMaterials(object)
  })
}

function assemble(scene: Object3D, animations: readonly AnimationClip[], bounds: Box3, height: number, shadeSkin: (shading: MeshShading) => void) {
  const size = bounds.getSize(new Vector3())
  const scale = height / size.y
  // The file sets where he stands. Only the height and the floor contact come from the measured bounds.
  const fit = new Group()
  fit.scale.setScalar(scale)
  fit.position.y = -bounds.min.y * scale
  fit.add(scene)
  // The pivot sits between the feet, so a sway never lifts them off the floor.
  const pivot = new Group()
  pivot.add(fit)
  const root = new Group()
  root.name = 'Brundlefly-mesh'
  root.add(pivot)
  const idle = animations.find(clip => clip.name === 'Brundlefly-idle') ?? animations[0]
  const mixer = idle ? new AnimationMixer(scene) : undefined
  if (mixer && idle) mixer.clipAction(idle).play()
  const motion: MeshMascotMotion = idle ? { _tag: 'Clip', name: idle.name } : { _tag: 'Sway' }
  let skinned = false
  scene.traverse((object) => { if (object instanceof SkinnedMesh) skinned = true })
  let face = scene.getObjectByName('anchor-face')
  if (!face) {
    // Without an anchor, the face is high on the front of the body.
    face = new Object3D()
    face.position.set((bounds.min.x + bounds.max.x) / 2, bounds.min.y + size.y * 0.8, bounds.max.z)
    fit.add(face)
  }
  const faceAnchor = face
  const found = findBodyJoints(scene)
  const bodyJoints = found._tag === 'Ok' ? found.joints : undefined
  // A file can turn its top node about the vertical: the three-quarter stance of the artwork.
  // The site mirrors that turn when he faces the other side. Joint axes are in the body's frame, below that node.
  let stanceNode = bodyJoints?.get('pelvis')
  while (stanceNode?.parent && stanceNode.parent !== scene) stanceNode = stanceNode.parent
  const stanceYaw = stanceNode ? new Euler().setFromQuaternion(stanceNode.quaternion, 'YXZ').y : 0
  const vertical = new Vector3(0, 1, 0)
  const sideTurn = new Quaternion()
  // Any rest rotation that is not the vertical turn stays as the file has it.
  const stanceRest = stanceNode ? sideTurn.setFromAxisAngle(vertical, stanceYaw).invert().multiply(stanceNode.quaternion).clone() : undefined
  const mouthparts = bodyJoints ? findMouthparts(scene) : []
  const fingers = bodyJoints ? findFingers(scene) : undefined
  const markers = fingers ? { left: createMarker(fingers.left[2]), right: createMarker(fingers.right[2]) } : undefined
  const jars = fingers ? { left: createJar(fingers.left[2]), right: createJar(fingers.right[2]) } : undefined
  // The fit is in place, so each joint's parent has its final scale inside the mascot.
  root.updateMatrixWorld(true)
  const feet = bodyJoints ? [bodyJoints.get('left-foot')!, bodyJoints.get('right-foot')!] : []
  const footPoint = new Vector3()
  const footHeight = (foot: Object3D) => root.worldToLocal(foot.getWorldPosition(footPoint)).y
  const footRest = feet.map(footHeight)
  /** Turns the body joints for one frame. The figure's place, face, and eyes follow in `pose`. */
  function turnJoints(input: MascotPoseInput) {
    // Some joints only move during a habit. Clearing every joint stops a habit's turn from accumulating across frames.
    for (const joint of bodyJoints!.values()) joint.rotation.set(0, 0, 0)
    const body = poseBody(name => bodyJoints!.get(name)!, input)
    // The mesh is a full body, so it takes the fuller motion that would tear the relief.
    const depth = addBodyDepth(name => bodyJoints!.get(name)!, input)
    return { body, depth }
  }
  // A foot is fully planted on the floor and free of it once its joint is this far above its rest height: about 2 percent of his height.
  const plantedBand = height * 0.02
  const legTurn = new Quaternion()
  /**
   * For a file whose legs are not chains. The pose code turns each leg joint, and the foot that is lower, against its own rest height, rests on the floor.
   * A foot on the floor then lies level, by undoing the tilt of its leg.
   */
  function plantFeet() {
    const drops = feet.map((foot, index) => footRest[index]! - footHeight(foot))
    const rise = Math.max(...drops)
    pivot.position.y = rise
    feet.forEach((foot, index) => {
      legTurn.identity()
      for (let joint = foot.parent; joint && joint !== stanceNode; joint = joint.parent) legTurn.premultiply(joint.quaternion)
      foot.quaternion.slerp(legTurn.invert(), Math.min(1, Math.max(0, 1 - (rise - drops[index]!) / plantedBand)))
    })
  }
  /**
   * A leg as a chain: hip, knee, and the foot joint at the ankle. The site places each foot and solves the leg to it,
   * so a foot on the floor stays where it stands while his body moves over it.
   * Lengths and places are in the mascot's own units. Directions are in the frame of the joint that holds them.
   */
  type Leg = {
    hip: Object3D, knee: Object3D, foot: Object3D
    thigh: Vector3, shin: Vector3, thighLength: number, shinLength: number
    /** Undoes the rest pose of the hip's bend frame. */
    unbend: Quaternion
    /** The way the knee points, in the frame of the node that turns him. */
    pole: Vector3
    /** Where the ankle stands at rest, in the frame of the node that turns him. */
    home: Vector3
    /** The furthest the leg straightens, as a share of its full length. A file may stand on straighter legs than the site would give it. */
    limit: number
    /** The share of that reach over which his hips begin to sink. A leg that stands near its limit at rest has none, so his rest pose stays as the file has it. */
    slack: number
  }
  function findLegs(): Leg[] | undefined {
    if (!bodyJoints || !stanceNode) return undefined
    const turned = stanceNode
    const legs = (['left', 'right'] as const).map((side): Leg | undefined => {
      const [hip, knee, foot] = [bodyJoints.get(`${side}-hip`)!, bodyJoints.get(`${side}-knee`)!, bodyJoints.get(`${side}-foot`)!]
      if (knee.parent !== hip || foot.parent !== knee || !hip.parent) return undefined
      const [thigh, shin] = [knee.position.clone(), foot.position.clone()]
      // The joints are in the file's units. One of those is this long in the mascot's.
      const unit = hip.parent.getWorldScale(new Vector3()).x
      const [thighLength, shinLength] = [thigh.length() * unit, shin.length() * unit]
      if (thighLength < 1e-6 || shinLength < 1e-6) return undefined
      thigh.normalize()
      shin.normalize()
      const [hipPlace, kneePlace, anklePlace] = [hip, knee, foot].map(joint => joint.getWorldPosition(new Vector3())) as [Vector3, Vector3, Vector3]
      // The knee points the way it stands off the line from hip to ankle. A straight leg gives no such way, so its knee points forward.
      const line = anklePlace.clone().sub(hipPlace)
      const off = kneePlace.clone().sub(hipPlace)
      off.addScaledVector(line, -off.dot(line) / line.lengthSq())
      const pole = off.length() > (thighLength + shinLength) * 0.01
        ? off.normalize().applyQuaternion(turned.getWorldQuaternion(new Quaternion()).invert())
        : new Vector3(0, 0, 1)
      // The hinge is the axis the knee bends about. It is square to the thigh in every pose.
      const bent = new Vector3().crossVectors(thigh, shin)
      const hinge = bent.length() > 1e-3 ? bent.normalize() : new Vector3().crossVectors(thigh, new Vector3(0, 0, 1)).normalize()
      const unbend = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(thigh, hinge, new Vector3().crossVectors(thigh, hinge))).invert()
      const stood = hipPlace.distanceTo(anklePlace) / (thighLength + shinLength)
      const limit = Math.min(0.9995, Math.max(0.97, stood))
      return { hip, knee, foot, thigh, shin, thighLength, shinLength, unbend, pole, home: turned.worldToLocal(anklePlace.clone()),
        limit, slack: Math.min(0.06, Math.max(0, 1 - (stood + 0.02) / limit)) }
    })
    return legs[0] && legs[1] ? [legs[0], legs[1]] : undefined
  }
  const legs = findLegs()
  const legLength = legs ? (legs[0]!.thighLength + legs[0]!.shinLength + legs[1]!.thighLength + legs[1]!.shinLength) / 2 : 0
  /**
   * The ground one walk cycle covers, in the mascot's own units. The host walks him at this length. It suits the length of his legs:
   * each foot then lands and leaves well inside its reach. A file whose legs are not chains has none.
   */
  const strideLength = legs ? legLength * 0.75 : undefined
  // Where each foot stands on the floor, in world units, and the way it points. `swing` is how far through its swing the foot was in the last frame.
  // `aim` is where a foot in the air will land. He chooses it in the first half of the foot's travel and then keeps it, as a walker commits to a step.
  const stand = [0, 1].map(() => ({ x: 0, z: 0, yaw: 0, swing: 0, lift: 0, aim: { x: 0, z: 0, yaw: 0 } }))
  let stoodAt: number | undefined
  // His turn and his walk cycle in the last frame that held the feet. Their rates say how he will be turned when a foot in the air lands.
  // `sag` is how far his hips have come down for a foot's reach, in the mascot's own units, and `rise` is how fast they come up again.
  const last = { yaw: 0, phase: 0, sag: 0, rise: 0 }
  // A foot this far from its place under him did not get there by walking: the host moved him. Then both feet take their places again.
  const leash = legLength * 0.9
  const scratch = { scale: new Vector3(), forward: new Vector3(), home: [new Vector3(), new Vector3()], hip: new Vector3(), target: new Vector3(), pole: new Vector3(),
    axis: new Vector3(), thigh: new Vector3(), shin: new Vector3(), hinge: new Vector3(), basis: new Matrix4(), turn: new Quaternion(), level: new Quaternion(), turnedWorld: new Quaternion(), tip: new Quaternion(), slide: new Vector3() }
  const unit = (value: number) => Math.min(1, Math.max(0, value))
  // The furthest his foot reaches from its ankle along the floor: about a quarter of his height, at the tips of his claws.
  const footReach = height * 0.26
  const across = new Vector3(1, 0, 0)
  /**
   * Places both feet and solves each leg to its foot. It runs after the pose code has turned the body.
   * With `stance` in the input, a foot on the floor holds its place in the world, and a foot in the air swings to where his travel will need it.
   * Without it, each foot takes its place in the cycle under him, so the pose depends on the input alone.
   */
  function placeLegs(input: MascotPoseInput, phase: number, gait: number) {
    const { forward, home } = scratch
    const scale = root.getWorldScale(scratch.scale).x
    const turned = stanceNode!
    // His feet take their places under his body as the pose code turned it, before any sway of this frame.
    turned.updateWorldMatrix(true, false)
    forward.set(0, 0, 1).transformDirection(turned.matrixWorld)
    const bodyYaw = Math.atan2(forward.x, forward.z)
    legs!.forEach((leg, index) => turned.localToWorld(home[index]!.copy(leg.home)))
    // A slow walk still lifts each foot clear of the floor. Steps in place fade as a walk takes over.
    const steps = unit(input.stepInPlace ?? 0) * (1 - gait)
    const lifts = Math.max(unit(gait / 0.25), unit(steps / 0.25))
    const liftHeight = height * (0.03 + 0.02 * gait) * scale
    const reach = strideLength! * scale * (2 - swingShare) / 2 * gait
    const [strideX, strideZ] = input.stance ?? [forward.x * reach, forward.z * reach]
    const elapsed = stoodAt === undefined ? Number.NaN : input.time - stoodAt
    // The feet hold their places only from one moment to a later one. A first frame, a jump in time, and a pose with no stance begin again.
    let held = input.stance !== undefined && elapsed >= 0 && elapsed <= 0.25
    for (const [index, foot] of stand.entries()) {
      const away = Math.hypot(foot.x - home[index]!.x, foot.z - home[index]!.z)
      if (!(away <= leash * scale) || !Number.isFinite(foot.yaw)) held = false
    }
    stoodAt = input.stance !== undefined ? input.time : undefined
    // A foot lands turned as his body will be when it is over that foot. So a turn twists each leg half as far, first one way and then the other.
    const tempo = held && elapsed > 0 ? (phase - last.phase) / elapsed : 0
    const turnRate = held && elapsed > 0 ? Math.atan2(Math.sin(bodyYaw - last.yaw), Math.cos(bodyYaw - last.yaw)) / elapsed : 0
    if (!held || elapsed > 0) Object.assign(last, { yaw: bodyYaw, phase })
    root.getWorldPosition(scratch.axis)
    stand.forEach((foot, index) => {
      const cycle = footCycle(phase, index)
      const inAir = cycle._tag === 'Swing' && lifts > 0
      if (!held) {
        const share = cycleReach(cycle)
        Object.assign(foot, { x: home[index]!.x + strideX * share, z: home[index]!.z + strideZ * share, yaw: bodyYaw })
        // A foot that begins again late in its swing aims for where that swing ends: half a stance ahead.
        Object.assign(foot.aim, { x: home[index]!.x + strideX / 2, z: home[index]!.z + strideZ / 2, yaw: bodyYaw })
      }
      else if (inAir && elapsed > 0) {
        const step = swingStep(foot.swing, cycle.progress)
        if (foot.swing === 0 || swingTravel(cycle.progress) < 0.5) {
          const lead = landingReach(cycle.progress)
          const turnLead = tempo > 1e-3 ? Math.min(0.5, Math.max(-0.5, turnRate * cycleToMidStance(cycle.progress) * Math.PI * 2 / tempo)) : 0
          const [fromAxisX, fromAxisZ] = [home[index]!.x - scratch.axis.x, home[index]!.z - scratch.axis.z]
          const [cos, sin] = [Math.cos(turnLead), Math.sin(turnLead)]
          Object.assign(foot.aim, { x: scratch.axis.x + fromAxisX * cos + fromAxisZ * sin + strideX * lead,
            z: scratch.axis.z - fromAxisX * sin + fromAxisZ * cos + strideZ * lead, yaw: bodyYaw + turnLead })
        }
        foot.x += (foot.aim.x - foot.x) * step
        foot.z += (foot.aim.z - foot.z) * step
        foot.yaw += Math.atan2(Math.sin(foot.aim.yaw - foot.yaw), Math.cos(foot.aim.yaw - foot.yaw)) * step
      }
      foot.swing = inAir ? cycle.progress : 0
      foot.lift = inAir ? lifts * liftHeight * swingLift(cycle.progress) : 0
    })
    // His weight goes over the foot that carries him, and his body rises as the legs pass each other.
    // The sway is still at the moment both feet stand, so a walk that begins or ends there does not jolt him sideways.
    const over = Math.cos(phase)
    const sway = -over * Math.abs(over) * 0.16 * Math.max(unit(gait / 0.25) * (0.5 + 0.5 * gait), steps) / scale / 2
    pivot.position.x += (home[1]!.x - home[0]!.x) * sway
    pivot.position.z += (home[1]!.z - home[0]!.z) * sway
    pivot.position.y = height * (0.012 * gait + 0.005 * steps) * Math.cos(phase) ** 2
    // His hips come down as far as a foot on the floor needs. A foot in the air asks for nothing.
    let drop = 0
    legs!.forEach((leg, index) => {
      const foot = stand[index]!
      leg.hip.getWorldPosition(scratch.hip)
      scratch.target.set(foot.x, root.localToWorld(footPoint.set(0, footRest[index]!, 0)).y + foot.lift, foot.z)
      const planted = unit(1 - foot.lift / (plantedBand * scale))
      drop = Math.max(drop, planted * hipDrop(scratch.hip, scratch.target, (leg.thighLength + leg.shinLength) * scale * leg.limit, leg.slack))
    })
    // They come down at once, because a leg cannot stretch. They come up again from a slow start, so a foot that lifts does not jolt him.
    const sag = Math.min(drop, legLength * scale * 0.3) / scale
    last.rise = held && sag < last.sag ? Math.min(height * 0.08, last.rise + height * 0.5 * elapsed) : 0
    last.sag = held ? Math.max(sag, last.sag - last.rise * elapsed) : sag
    pivot.position.y -= last.sag
    legs!.forEach((leg, index) => {
      const foot = stand[index]!
      const { hip, target, pole, thigh, shin, hinge, basis, turn, level } = scratch
      leg.hip.getWorldPosition(hip)
      target.set(foot.x, root.localToWorld(footPoint.set(0, footRest[index]!, 0)).y + foot.lift, foot.z)
      pole.copy(leg.pole).transformDirection(turned.matrixWorld)
      const solved = solveLeg(hip, target, leg.thighLength * scale, leg.shinLength * scale, pole, leg.limit)
      // A foot that its leg cannot reach is dragged. It then stands where the leg left it.
      if (solved.stretched && held && foot.lift === 0) Object.assign(foot, { x: solved.foot.x, z: solved.foot.z })
      // The hip turns the thigh onto its line and the knee's hinge square to the bend. The knee then turns the shin onto its line.
      leg.hip.parent!.getWorldQuaternion(turn).invert()
      thigh.set(solved.knee.x - hip.x, solved.knee.y - hip.y, solved.knee.z - hip.z).normalize().applyQuaternion(turn)
      shin.set(solved.foot.x - solved.knee.x, solved.foot.y - solved.knee.y, solved.foot.z - solved.knee.z).normalize().applyQuaternion(turn)
      hinge.crossVectors(thigh, shin).normalize()
      leg.hip.quaternion.setFromRotationMatrix(basis.makeBasis(thigh, hinge, scratch.slide.crossVectors(thigh, hinge))).multiply(leg.unbend)
      leg.knee.quaternion.setFromUnitVectors(leg.shin, shin.applyQuaternion(turn.copy(leg.hip.quaternion).invert()))
      // A foot on the floor lies level and keeps the way it pointed when it landed.
      // A foot in the air tips its toes down as it leaves and up before it lands. His feet are long and splayed,
      // so the tip is only as much as the lift allows: no claw goes under the floor.
      const tip = Math.asin(Math.min(1, foot.lift / (footReach * scale))) * 0.8 * Math.cos(Math.PI * foot.swing)
      leg.hip.updateMatrixWorld(true)
      leg.knee.getWorldQuaternion(turn).invert()
      level.setFromAxisAngle(vertical, foot.yaw - bodyYaw).multiply(turned.getWorldQuaternion(scratch.turnedWorld)).multiply(scratch.tip.setFromAxisAngle(across, tip))
      leg.foot.quaternion.copy(turn.multiply(level))
    })
  }
  const turns = Math.abs(stanceYaw) > 1e-3
  const faceJoints = bodyJoints ? findFaceJoints(scene) : undefined
  const eyes = findEyes(scene)
  const eyeNodes = eyes.flatMap(eye => eye.node ? [eye.node] : [])
  const wetEye = dressEyes(eyeNodes)
  // A host that has the reference head's artwork replaces the file's eyeballs with the relief rig's eyes.
  let referenceEyes: ReturnType<typeof createReferenceEyes> | undefined
  // Both eyes take one direction, from the point between them, so he never looks cross-eyed.
  const eyeFrame = eyeNodes[0]?.parent
  const betweenEyes = eyeNodes.reduce((sum, node) => sum.add(node.position), new Vector3()).divideScalar(Math.max(1, eyeNodes.length))
  // The shader takes the gaze in the eyeball's own frame. The file can give the eyeball a rest rotation in the head.
  const fromHead = eyeNodes[0]?.quaternion.clone().invert()
  const gaze = { look: { x: 0, y: 0 } as Look, pupil: pupilSize('Ahead', 0), shine: 0 }
  let gazedAt: number | undefined
  const watched = new Vector3()
  /** Eyes snap toward a new target in a saccade and the pupil eases its size, as on the relief rig. Stopped or jumping time sets both at once. */
  function aimEyes(time: number, focus: EyeFocus) {
    const shader = referenceEyes?.eye ?? wetEye
    if (!eyeFrame || !fromHead || !shader) return
    // These steps are the relief rig's: a look in the head's frame, with a drift that never lets the eyes hold still.
    const drift = fixationDrift(time)
    let target: Look = { x: 0, y: 0 }
    if (focus._tag === 'Wander') {
      const wander = wanderingLook(time)
      target = { x: wander.x + drift.x, y: wander.y + drift.y }
    }
    if (focus._tag === 'Watch') {
      eyeFrame.updateWorldMatrix(true, false)
      const toward = lookToward(eyeFrame.worldToLocal(watched.set(focus.target.x, focus.target.y, focus.target.z)).sub(betweenEyes))
      target = { x: toward.x + drift.x * 0.5, y: toward.y + drift.y * 0.5 }
    }
    const delta = gazedAt === undefined ? Infinity : time - gazedAt
    const blend = (rate: number) => delta > 0 && delta < 0.25 ? 1 - Math.exp(-rate * delta) : 1
    gazedAt = time
    gaze.look = { x: gaze.look.x + (target.x - gaze.look.x) * blend(30), y: gaze.look.y + (target.y - gaze.look.y) * blend(30) }
    gaze.pupil += (pupilSize(focus._tag, time) - gaze.pupil) * blend(2.5)
    gaze.shine += ((focus._tag === 'Watch' ? 1 : 0) - gaze.shine) * blend(2.5)
    // The iris slides under the cornea. The eyeball itself does not turn.
    if (referenceEyes) {
      const { x, y, z } = pupilDirection(gaze.look)
      watched.set(x, y, z)
    }
    else {
      const yaw = clamp(gaze.look.x, 1) * maxEyeYaw
      const pitch = clamp(gaze.look.y, 1) * maxEyePitch
      watched.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
    }
    watched.applyQuaternion(fromHead)
    shader.updateGaze(watched, gaze.pupil, gaze.shine)
    if (referenceEyes) referenceEyes.updateTime(time)
    else shader.updateTime(time)
  }
  // The rig contract gives every joint an identity rest rotation, so the head looks along +Z of its parent at rest.
  const head = scene.getObjectByName('head')
  const clipPose = new Quaternion()
  const written = new Quaternion(Number.NaN, Number.NaN, Number.NaN, Number.NaN)
  const lookPose = new Quaternion()
  const habitPose = new Quaternion()
  const toTarget = new Vector3()
  const turn = new Euler()
  /** `habit` is the head turn of a running mannerism. It rides on the look, so he can tilt his head while he watches the visitor. */
  function turnHead(look?: MeshMascotLook, habit?: readonly [number, number, number]) {
    if (!head?.parent) return
    // The mixer writes a joint only when its clip value changes. A pose that differs from the last one written here is a new clip pose.
    if (!head.quaternion.equals(written)) clipPose.copy(head.quaternion)
    const weight = Math.min(1, Math.max(0, look?.weight ?? 0))
    head.quaternion.copy(clipPose)
    if (look && weight > 0) {
      head.parent.updateWorldMatrix(true, false)
      head.parent.worldToLocal(toTarget.copy(look.target)).sub(head.position)
      const yaw = clamp(Math.atan2(toTarget.x, toTarget.z), maxHeadYaw)
      const pitch = clamp(-Math.atan2(toTarget.y, Math.hypot(toTarget.x, toTarget.z)), maxHeadPitch)
      lookPose.setFromEuler(turn.set(pitch, yaw, look.tilt, 'YXZ'))
      if (habit) lookPose.multiply(habitPose.setFromEuler(turn.set(habit[0], habit[1], habit[2], 'XYZ')))
      head.quaternion.slerp(lookPose, weight)
    }
    written.copy(head.quaternion)
  }
  return {
    _tag: 'Mesh' as const,
    root,
    motion,
    /** True when the file has a skeleton to show. */
    skinned,
    /** Seconds in one loop of the idle motion. */
    idleDuration: idle ? idle.duration : swayPeriod,
    /** Horizontal reach and height in root units. The feet are at zero. */
    extent: { left: bounds.min.x * scale, right: bounds.max.x * scale, height },
    /**
     * Where each foot is, in world space, and how firmly it stands: 1 on the floor, 0 once it is clear of it.
     * The host draws a contact shadow under each. A file without the relief rig's joints has no feet to report.
     */
    footContacts(visit: (place: Vector3, planted: number, index: number) => void) {
      feet.forEach((foot, index) => {
        const planted = 1 - Math.min(1, Math.max(0, (footHeight(foot) - footRest[index]!) / plantedBand))
        visit(foot.getWorldPosition(footPoint), planted, index)
      })
    },
    /** World position of his face, for the conversation close-up. */
    facePoint: (target: Vector3) => faceAnchor.getWorldPosition(target),
    /** World position of the point between his eyes, for a shot that frames his head. A file without eye nodes gives the face point. */
    eyeLine(target: Vector3) {
      if (!eyeFrame) return faceAnchor.getWorldPosition(target)
      eyeFrame.updateWorldMatrix(true, false)
      return eyeFrame.localToWorld(target.copy(betweenEyes))
    },
    /** `time` is seconds of visible motion. Zero is the authored rest pose. `look` applies only to a file with a `head` joint. */
    update(time: number, look?: MeshMascotLook) {
      if (referenceEyes) referenceEyes.updateTime(time)
      else wetEye?.updateTime(time)
      if (mixer) mixer.setTime(time)
      else {
        const phase = time * swayRate
        pivot.rotation.set(Math.sin(phase * 3) * 0.01, Math.sin(phase * 2) * 0.06, Math.sin(phase * 5) * 0.014)
        pivot.scale.y = 1 + Math.sin(phase * 12) * 0.006
      }
      turnHead(look)
    },
    /**
     * Poses the skeleton with the relief rig's code: idle, walk, speech, and mannerisms. The file's own clip does not run.
     * It exists only for a file with every body joint at an identity rest rotation.
     */
    pose: bodyJoints ? (input: MascotPoseInput, look?: MeshMascotLook, heading = stanceYaw) => {
      const gait = unit(input.gait ?? 0)
      // One cycle moves his feet, so his walk and his steps in place add up to it. The rest of his body keeps time with his feet.
      const cycle = (input.walkPhase ?? (gait > 0 ? input.time * 3.6 : 0)) + (input.stepPhase ?? 0)
      const { body, depth } = turnJoints(legs ? { ...input, walkPhase: cycle, stepPhase: cycle } : input)
      pivot.rotation.y = body.root.rotationY
      pivot.position.set(depth.rootX, 0, 0)
      pivot.scale.y = body.root.scaleY
      // `heading` is his turn about the vertical: zero faces the viewer and a positive turn faces screen right.
      // Only a file that turns its own top node can be turned. The body turns and the head stays toward the viewer, as far as his neck allows.
      // While he walks, the head keeps half of the turn, so he looks along his path.
      const yaw = turns ? heading : 0
      if (turns && stanceNode && stanceRest) stanceNode.quaternion.setFromAxisAngle(vertical, yaw).multiply(stanceRest)
      bodyJoints.get('head')!.rotation.y -= headCounterTurn(yaw, gait)
      // His voice moves the jaw and the cheeks, and a raised brow lifts the skin over each eye, by the relief rig's numbers.
      if (faceJoints) {
        const { jaw, cheekLeft, cheekRight, brows } = faceJoints
        if (jaw) {
          jaw.joint.position.set(jaw.rest.x, jaw.rest.y - body.speaking * referenceFace.jaw.drop * jaw.unit, jaw.rest.z + body.speaking * referenceFace.jaw.forward * jaw.unit)
          jaw.joint.rotation.x = -body.speaking * referenceFace.jaw.turn
        }
        if (cheekLeft) cheekLeft.joint.position.x = cheekLeft.rest.x + body.speaking * referenceFace.cheeks.left * cheekLeft.unit
        if (cheekRight) cheekRight.joint.position.x = cheekRight.rest.x + body.speaking * referenceFace.cheeks.right * cheekRight.unit
        brows.forEach((brow, index) => { if (brow) brow.joint.position.y = brow.rest.y + (input.brow ?? 0) * referenceFace.brows[index]! * brow.unit })
      }
      // The mouthparts drift on their own and open with his voice. Neighbours open in opposite directions.
      const phase = input.time * mouthpartRate
      mouthparts.forEach(({ base, tip }, index) => {
        // They also swing with each step, the tips more than the roots.
        base.rotation.set(Math.sin(phase * 2 + index * 0.9) * 0.12 * body.calm + body.speaking * 0.3 * (index % 2 === 0 ? 1 : -1) + depth.bounce * 0.04,
          0, Math.sin(phase + index * 1.7) * 0.07 * body.calm)
        tip?.rotation.set(Math.sin(phase * 2 + index * 0.9 + 0.8) * 0.16 * body.calm + body.speaking * 0.2 + depth.bounce * 0.09, 0, 0)
      })
      // A habit closes his fingers: on a marker, round a jar, or one at a time on the keys.
      if (fingers) for (const side of ['left', 'right'] as const) {
        const hand = input.mannerism?.hands[side]
        const marker = markers?.[side]
        if (marker) marker.visible = hand?.holds === 'Marker'
        const held = jars?.[side]
        if (held) {
          held.jar.visible = hand?.holds === 'Jar'
          if (held.jar.visible) held.hang()
        }
        fingers[side].forEach((finger, index) => {
          if (!finger) return
          const close = Math.min(1, Math.max(0, (hand?.curl ?? 0) + (hand?.taps?.[index] ?? 0)))
          finger.root.rotation.copy(finger.rootRest)
          finger.root.rotation.x += close * fingerCurl.root
          if (finger.tip && finger.tipRest) { finger.tip.rotation.copy(finger.tipRest); finger.tip.rotation.x += close * fingerCurl.tip }
        })
      }
      if (legs) placeLegs(input, cycle, gait)
      else plantFeet()
      turnHead(look, input.mannerism?.turns.head)
      aimEyes(input.time, input.eyes ?? { _tag: 'Ahead' })
      // The relief rig's lids blink when the host supplied them. The file's own lid joints then stay at rest.
      if (referenceEyes) { referenceEyes.shut(body.blink, input.squint ?? 0); return }
      // A squint narrows the smaller, screen-right eye more than the larger one, as on the relief rig.
      eyes.forEach(({ upperLid, lowerLid }, index) => {
        // The file's lids are open at rest. Each one shuts over the relief rig's lid travel.
        const closure = Math.min(1, body.blink + (input.squint ?? 0) * (reliefEyes.lid.squint[index] ?? 0))
        upperLid?.rotation.set(closure * reliefEyes.lid.open, 0, 0)
        lowerLid?.rotation.set(-closure * reliefEyes.lid.open, 0, 0)
      })
    } : undefined,
    /**
     * Replaces the file's eyeballs with the relief rig's eyes: the same globes, shell lids, and blink.
     * The file's eye nodes give each eye its place and its width. A file without eye nodes keeps what it has.
     */
    dressEyes(dressing: EyeDressing) {
      if (referenceEyes || eyeNodes.length === 0) return
      referenceEyes = createReferenceEyes(eyes.flatMap(({ node, lid }) => node ? [{ node, lid }] : []), dressing)
    },
    /**
     * Shades him for the place he stands in. Each shading starts from the model's own colours, so a host can shade him again in another place.
     * The lids the site built follow the skin beside each eye.
     */
    shade(shading: MeshShading) {
      shadeSkin(shading)
      referenceEyes?.matchSkin()
    },
    /** The turn about the vertical that the file gives him at rest: the artwork's three-quarter turn. Zero for a file that cannot be turned. */
    restHeading: turns ? stanceYaw : 0,
    /** The ground one walk cycle covers, in the mascot's own units. Undefined for a file whose feet do not move with its legs. */
    strideLength,
    /** Why the file cannot take the pose code. Undefined when it can. */
    poseGap: found._tag === 'Err' ? found.reason : undefined,
    dispose() {
      // The built eyes hold the host's textures. They leave before the model's own materials and textures are released.
      referenceEyes?.dispose()
      for (const eye of eyes) eye.lid?.map?.dispose()
      mixer?.stopAllAction()
      mixer?.uncacheRoot(scene)
      releaseMeshSource(scene)
    },
  }
}

/** The furthest his head turns on his neck to keep facing the viewer, in radians. His walk never turns his body further than this. */
export const neckLimit = 1.3
/**
 * How far his head turns back toward the viewer when his body is turned by `heading`. While he walks, the head keeps half of the turn, so he looks along his path.
 * Up to the neck's limit the head stays on the viewer. A stop at his work turns his body further: his head then goes with his body and looks at his work,
 * with a last small turn back. Without this the neck twists through the whole turn.
 */
export function headCounterTurn(heading: number, gait: number) {
  const turn = Math.abs(heading)
  const past = Math.min(1, Math.max(0, (turn - neckLimit) / 0.8))
  const release = past * past * (3 - 2 * past)
  return Math.sign(heading) * (Math.min(turn, neckLimit) * (1 - release) + 0.2 * release) * (1 - gait * 0.5)
}

/** How a host shades a full-bodied model: a tint on its skin, the strength of its own occlusion map, and the materials that keep their colour. */
export type MeshShading = { tint: readonly [number, number, number], occlusion: number, untinted: readonly string[] }
/**
 * The lair's shading. The model's skin is painted flat, with no shadow in it, so light must give him his shape.
 * The relief rig's artwork has its shadows painted in, and reads darker and redder under the lair's lights.
 * `tint` brings the skin to that level and hue, and his own occlusion map counts for more. His wings keep their pale green, as on the relief rig.
 */
export const meshShading: MeshShading = { tint: [0.62, 0.54, 0.52], occlusion: 1.5, untinted: ['Brundlefly-wing'] }
/** Records the model's own colours, and returns a function that shades them. A second shading replaces the first. */
function shadeBody(scene: Object3D) {
  const own = new Map<MeshStandardMaterial, Color>()
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    for (const material of (Array.isArray(object.material) ? object.material : [object.material]) as Material[]) {
      // The skin beside each eye is one of these materials, so the lids the site builds take the same tint.
      if (material instanceof MeshStandardMaterial && !own.has(material)) own.set(material, material.color.clone())
    }
  })
  return (shading: MeshShading) => {
    const tint = new Color(...shading.tint)
    for (const [material, colour] of own) {
      material.color.copy(colour)
      if (!shading.untinted.includes(material.name)) material.color.multiply(tint)
      if (material.aoMap) material.aoMapIntensity = shading.occlusion
    }
  }
}

/**
 * Places a loaded model where the relief rig stands. The model keeps its own materials. A host can shade them for its own lights.
 * The function owns the source: it releases the model when the file is unusable.
 */
export function createMeshMascot({ scene, animations }: MeshMascotSource, height = reliefStandingHeight, shading?: MeshShading): MeshMascotResult {
  // A figurine base changes the measured height and the floor contact. The site shows him without it.
  const base = scene.getObjectByName('Brundlefly-base')
  if (base) { releaseMeshSource(base); base.removeFromParent() }
  scene.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(scene, true)
  if (bounds.isEmpty() || bounds.max.y <= bounds.min.y) {
    releaseMeshSource(scene)
    return { _tag: 'Err', reason: 'The file contains no geometry with height.' }
  }
  const shadeSkin = shadeBody(scene)
  if (shading) shadeSkin(shading)
  return { _tag: 'Ok', mascot: assemble(scene, animations, bounds, height, shadeSkin) }
}

/**
 * Loads the served model and places it. A missing or unreadable file is an error value, so the caller can show the relief rig.
 * The GLB reader loads on demand, because only the mesh mode needs it.
 */
export const loadMeshMascot = (url = meshMascotUrl, height = reliefStandingHeight, shading?: MeshShading): Promise<MeshMascotResult> =>
  import('three/addons/loaders/GLTFLoader.js')
    .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(url))
    .then(file => createMeshMascot(file, height, shading),
      (cause: unknown): MeshMascotResult => ({ _tag: 'Err', reason: cause instanceof Error ? cause.message : String(cause) }))
