import { AnimationMixer, Box3, Euler, Group, Mesh, Object3D, Quaternion, SkinnedMesh, Texture, Vector3 } from 'three'
import type { AnimationClip } from 'three'
import { bodyJointNames, poseBody } from './mascot-pose.ts'
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
/** The pose code needs every body joint by name, each with an identity rest rotation. A file that lacks one keeps its own clip. */
function findBodyJoints(scene: Object3D) {
  const joints = new Map<BodyJointName, Object3D>()
  for (const name of bodyJointNames) {
    const joint = scene.getObjectByName(name)
    if (!joint || !atRest(joint)) return undefined
    joints.set(name, joint)
  }
  return joints
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
// One slow cycle of the mouthparts, in radians for each second.
const mouthpartRate = Math.PI * 2 / 4
export type MeshMascot = ReturnType<typeof assemble>
export type MeshMascotResult = { _tag: 'Ok', mascot: MeshMascot } | { _tag: 'Err', reason: string }

/** Releases every GPU resource a loaded model holds. */
export function releaseMeshSource(scene: Object3D) {
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.geometry.dispose()
    if (object instanceof SkinnedMesh) object.skeleton.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material)) if (value instanceof Texture) value.dispose()
      material.dispose()
    }
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
  const bodyJoints = findBodyJoints(scene)
  const mouthparts = bodyJoints ? findMouthparts(scene) : []
  // The rig contract gives every joint an identity rest rotation, so the head looks along +Z of its parent at rest.
  const head = scene.getObjectByName('head')
  const clipPose = new Quaternion()
  const written = new Quaternion(Number.NaN, Number.NaN, Number.NaN, Number.NaN)
  const lookPose = new Quaternion()
  const toTarget = new Vector3()
  const turn = new Euler()
  function turnHead(look?: MeshMascotLook) {
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
      head.quaternion.slerp(lookPose.setFromEuler(turn.set(pitch, yaw, look.tilt, 'YXZ')), weight)
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
    /** `time` is seconds of visible motion. Zero is the authored rest pose. `look` applies only to a file with a `head` joint. */
    update(time: number, look?: MeshMascotLook) {
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
    pose: bodyJoints ? (input: MascotPoseInput, look?: MeshMascotLook) => {
      // Some joints only move during a habit. Clearing every joint stops a habit's turn from accumulating across frames.
      for (const joint of bodyJoints.values()) joint.rotation.set(0, 0, 0)
      const body = poseBody(name => bodyJoints.get(name)!, input)
      pivot.rotation.y = body.root.rotationY
      pivot.position.y = body.root.positionY
      pivot.scale.y = body.root.scaleY
      // The mouthparts drift on their own and open with his voice. Neighbours open in opposite directions.
      const phase = input.time * mouthpartRate
      mouthparts.forEach(({ base, tip }, index) => {
        base.rotation.set(Math.sin(phase * 2 + index * 0.9) * 0.12 * body.calm + body.speaking * 0.3 * (index % 2 === 0 ? 1 : -1),
          0, Math.sin(phase + index * 1.7) * 0.07 * body.calm)
        tip?.rotation.set(Math.sin(phase * 2 + index * 0.9 + 0.8) * 0.16 * body.calm + body.speaking * 0.2, 0, 0)
      })
      turnHead(look)
    } : undefined,
    dispose() {
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
