import { AnimationMixer, Box3, BufferAttribute, Color, DataTexture, Euler, Group, Mesh, Object3D, Quaternion, SkinnedMesh, SRGBColorSpace, Texture, Vector2, Vector3 } from 'three'
import type { AnimationClip, Material } from 'three'
import { fixationDrift, lookToward, pupilDirection, pupilSize, wanderingLook } from './eye-gaze.ts'
import type { EyeFocus, Look } from './eye-gaze.ts'
import { createEyeMaterial } from './eye-material.ts'
import { referenceEyes as reliefEyes, referenceFace } from './face.ts'
import { createReferenceEyes } from './mascot-eyes.ts'
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
  return { colour: material.color.clone(), map: material.map instanceof Texture ? material.map : undefined }
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

function assemble(scene: Object3D, animations: readonly AnimationClip[], bounds: Box3, height: number) {
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
  // The fit is in place, so each joint's parent has its final scale inside the mascot.
  root.updateMatrixWorld(true)
  // A leg that swings on a full body also moves its foot up or down, which a flat relief never shows.
  // So the figure is grounded each frame: the foot that is lower, measured against its own rest height, rests on the floor.
  const feet = bodyJoints ? [bodyJoints.get('left-foot')!, bodyJoints.get('right-foot')!] : []
  const footPoint = new Vector3()
  const footHeight = (foot: Object3D) => root.worldToLocal(foot.getWorldPosition(footPoint)).y
  const footRest = feet.map(footHeight)
  const legTurn = new Quaternion()
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
  /**
   * Stands him on the floor: the foot that is lower, against its own rest height, rests on it.
   * A foot on the floor then lies level, by undoing the tilt of its leg, so its sole is flat and no toe goes under.
   * A foot that has left the floor keeps its own turn.
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
   * The ground one walk cycle covers, in the mascot's own units: how far each foot travels back under him while it carries him.
   * The host walks him at this length, so a planted foot does not slide.
   */
  function measureStride() {
    if (!bodyJoints) return undefined
    const place = (foot: Object3D, walkPhase: number) => {
      turnJoints({ time: 0, pressure: 0, pointer: new Vector2(), transform: 'squeeze', gait: 1, walkPhase })
      return root.worldToLocal(foot.getWorldPosition(new Vector3()))
    }
    const travel = (foot: Object3D, from: number, to: number) => {
      const [start, end] = [place(foot, from), place(foot, to)]
      return Math.hypot(start.x - end.x, start.z - end.z)
    }
    // The left foot carries him through the second and third quarters of the cycle, and the right foot through the others.
    const length = travel(feet[0]!, Math.PI / 2, Math.PI * 1.5) + travel(feet[1]!, Math.PI * 1.5, Math.PI * 2.5)
    for (const joint of bodyJoints.values()) joint.rotation.set(0, 0, 0)
    return length > 1e-6 ? length : undefined
  }
  const strideLength = measureStride()
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
      const { body, depth } = turnJoints(input)
      pivot.rotation.y = body.root.rotationY
      pivot.position.set(depth.rootX, 0, 0)
      pivot.scale.y = body.root.scaleY
      // `heading` is his turn about the vertical: zero faces the viewer and a positive turn faces screen right.
      // Only a file that turns its own top node can be turned. The body turns and the head stays toward the viewer.
      // While he walks, the head keeps half of the turn, so he looks along his path.
      const yaw = turns ? heading : 0
      if (turns && stanceNode && stanceRest) stanceNode.quaternion.setFromAxisAngle(vertical, yaw).multiply(stanceRest)
      bodyJoints.get('head')!.rotation.y -= yaw * (1 - Math.min(1, Math.max(0, input.gait ?? 0)) * 0.5)
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
      // The legs set his height: his body rises as they straighten and settles as each foot lands.
      plantFeet()
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

/**
 * Places a loaded model where the relief rig stands. The model keeps its own materials.
 * The function owns the source: it releases the model when the file is unusable.
 */
export function createMeshMascot({ scene, animations }: MeshMascotSource, height = reliefStandingHeight): MeshMascotResult {
  // A figurine base changes the measured height and the floor contact. The site shows him without it.
  const base = scene.getObjectByName('Brundlefly-base')
  if (base) { releaseMeshSource(base); base.removeFromParent() }
  scene.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(scene, true)
  if (bounds.isEmpty() || bounds.max.y <= bounds.min.y) {
    releaseMeshSource(scene)
    return { _tag: 'Err', reason: 'The file contains no geometry with height.' }
  }
  return { _tag: 'Ok', mascot: assemble(scene, animations, bounds, height) }
}

/**
 * Loads the served model and places it. A missing or unreadable file is an error value, so the caller can show the relief rig.
 * The GLB reader loads on demand, because only the mesh mode needs it.
 */
export const loadMeshMascot = (url = meshMascotUrl, height = reliefStandingHeight): Promise<MeshMascotResult> =>
  import('three/addons/loaders/GLTFLoader.js')
    .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(url))
    .then(file => createMeshMascot(file, height),
      (cause: unknown): MeshMascotResult => ({ _tag: 'Err', reason: cause instanceof Error ? cause.message : String(cause) }))
