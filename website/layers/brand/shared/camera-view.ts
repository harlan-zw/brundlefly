import { Euler, Matrix4, Quaternion, Vector3 } from 'three'

export type CameraView = { yaw: number; pitch: number; x: number; z: number }
export type CameraKey = 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD'
export const defaultCameraView: CameraView = { yaw: 0, pitch: 0, x: 0, z: 0 }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export const rotateCameraView = (view: CameraView, dx: number, dy: number): CameraView => {
  const angle = view.yaw + dx * 0.0028
  return { ...view, yaw: Math.atan2(Math.sin(angle), Math.cos(angle)), pitch: clamp(view.pitch + dy * 0.0025, -1.15, 1.15) }
}

export const moveCameraView = (view: CameraView, keys: ReadonlySet<CameraKey>, delta: number): CameraView => {
  const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'))
  const right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'))
  const magnitude = Math.hypot(forward, right)
  if (!magnitude) return view
  const distance = 0.75 * clamp(delta, 0, 0.05) / magnitude
  return {
    ...view,
    x: clamp(view.x + (right * Math.cos(view.yaw) + forward * Math.sin(view.yaw)) * distance, -1.4, 1.4),
    z: clamp(view.z + (-forward * Math.cos(view.yaw) + right * Math.sin(view.yaw)) * distance, -1.4, 1.4),
  }
}

export const resolveCameraView = (view: CameraView, framing: readonly [number, number, number], target: readonly [number, number, number], zoom: number) => {
  const position = [framing[0] + view.x, clamp(framing[1], 0.15, 3.2), framing[2] / zoom + view.z] as const
  const distance = framing[2] / zoom - target[2]
  const elevation = Math.atan2(target[1] - framing[1], distance) - view.pitch
  const radius = Math.hypot(distance, target[1] - framing[1])
  return {
    position,
    target: [position[0] + Math.sin(view.yaw) * radius * Math.cos(elevation),
      position[1] + Math.sin(elevation) * radius,
      position[2] - Math.cos(view.yaw) * radius * Math.cos(elevation)] as const,
  }
}

/** Keep narrow screens inside the lair instead of adding distant empty floor. */
export const resolveResponsiveCameraFraming = (desktop: readonly [number, number, number], portrait: readonly [number, number, number], aspect: number) => {
  if (aspect >= 0.8) return { framing: desktop, fieldOfView: 44, fogScale: 1 }
  const depthScale = clamp(aspect / 0.8, 0.8, 1)
  const fieldOfView = 50
  return {
    framing: [portrait[0], desktop[1], Math.min(portrait[2], desktop[2] * depthScale)] as const,
    fieldOfView,
    // A wider vertical view reveals more surrounding tissue. Match its optical fog depth.
    fogScale: Math.tan(44 * Math.PI / 360) / Math.tan(fieldOfView * Math.PI / 360),
  }
}

/**
 * Stages his face while he talks. The dialog normally sits below him, so the view looks down and his face rises.
 * Short landscape screens put the dialog on the right instead. The view pans right, so his face sits in the free area.
 */
export const resolveConversationFocus = (face: Vector3, width: number, height: number, fieldOfView: number) => {
  const aspect = width / height
  if (width > height && height <= 540) {
    // Matches the landscape dialog in _SpeechDialog.vue: up to 400px wide, 12px from the edge.
    const dialogShare = (Math.min(400, width / 2) + 12) / width
    const pan = dialogShare * 4.1 * Math.tan(fieldOfView * Math.PI / 360) * aspect
    return { position: face.clone().add(new Vector3(pan, 0.15, 4.1)), target: face.clone().add(new Vector3(pan, -0.2, 0)) }
  }
  const portrait = aspect < 0.8
  return { position: face.clone().add(new Vector3(0, 0.15, portrait ? 3.8 : 4.1)), target: face.clone().add(new Vector3(0, portrait ? -0.85 : -0.6, 0)) }
}

/**
 * The pixels the bottom dialog covers: its usual height, its gap from the edge, and a margin over its top edge.
 * Matches _SpeechDialog.vue. The side dialog of a short landscape screen covers no height.
 */
export const dialogCover = (width: number, height: number) =>
  width > height && height <= 540 ? 0 : width <= 600 ? Math.min(300, height * 0.52) + 26 : Math.min(270, height * 0.46) + 36

/**
 * How far the wide view turns, in radians, to bring the scene into the area the open dialog leaves free.
 * The middle of the view then lies in the middle of that area. A journey with the dialog open uses it, so he stays in sight while he walks.
 * The bottom dialog needs a look down. The side dialog of a short landscape screen needs a look to the right.
 */
export const resolveDialogClearance = (width: number, height: number, fieldOfView: number): TiltOffset => {
  const half = Math.tan(fieldOfView * Math.PI / 360)
  const side = width > height && height <= 540 ? (Math.min(400, width / 2) + 12) / width : 0
  return { yaw: Math.atan(side * half * width / height), pitch: Math.atan(dialogCover(width, height) / height * half) }
}

/**
 * How far the wide view turns, in radians, to keep him in sight at a place on the floor. A narrow screen shows only the middle of a set,
 * and he can walk out of it. `camera` is where the view stands, as x and z. `yaw` is the turn the visitor gave the view.
 * `reach` is half his width. Zero when all of him is in the picture already. A screen too narrow for him puts him in its middle.
 */
export function resolveFollowYaw(camera: readonly [x: number, z: number], yaw: number, place: readonly [x: number, z: number], reach: number, fieldOfView: number, aspect: number) {
  const across = place[0] - camera[0], away = camera[1] - place[1]
  const bearing = Math.atan2(across, away) - yaw
  const off = Math.atan2(Math.sin(bearing), Math.cos(bearing))
  const free = Math.max(0, Math.atan(Math.tan(fieldOfView * Math.PI / 360) * aspect) - Math.atan(reach / Math.max(reach, Math.hypot(across, away))))
  return off > free ? off - free : off < -free ? off + free : 0
}

/**
 * A head-and-shoulders shot for a full-bodied mascot. The camera stands a little to the side he faces, so he looks out of the frame at the visitor.
 * It drifts slowly with `drift`, in seconds. Zero gives the still shot.
 * `eyes` is the point between his eyes. His head reaches about half a unit above it and his mouthparts about half a unit below.
 * Both stay in the area the dialog leaves free, so the visitor sees his mouth move.
 */
export const resolveConversationCloseUp = (eyes: Vector3, width: number, height: number, fieldOfView: number, side: 1 | -1, drift: number): CameraShot => {
  const aspect = width / height
  const landscape = width > height && height <= 540
  const portrait = aspect < 0.8
  const half = Math.tan(fieldOfView * Math.PI / 360)
  const cover = dialogCover(width, height)
  // His head is one unit tall. It must fit the free band with room to spare, so a short window moves the camera back.
  const fit = height / (2 * half * (height - cover) * 0.9)
  // A narrow screen needs more distance to hold his head between its edges.
  const distance = Math.max(portrait ? 3 : landscape ? 2.6 : 2.7, fit) * (1 - Math.sin(drift * 0.13) * 0.025)
  const angle = side * (0.22 + Math.sin(drift * 0.21) * 0.035)
  // How far his eyes sit above the middle of the view, as a share of half the view height. They take the middle of the free band.
  const rise = landscape ? 0.12 : cover / height
  const position = eyes.clone().add(new Vector3(Math.sin(angle) * distance, 0.05, Math.cos(angle) * distance))
  const target = eyes.clone().add(new Vector3(0, -rise * distance * half, 0))
  if (landscape) {
    // The dialog sits on the right. The view slides along its own right axis, so his face sits in the middle of the free area.
    const dialogShare = (Math.min(400, width / 2) + 12) / width
    const slide = new Vector3(Math.cos(angle), 0, -Math.sin(angle)).multiplyScalar(dialogShare * distance * half * aspect)
    position.add(slide)
    target.add(slide)
  }
  return { position, target }
}

/** Eases the conversation close-up in while the dialog is open and out after it closes. Each end holds exactly, so a settled shot stays still. */
export const advanceConversationFocus = (progress: number, open: boolean, delta: number, reduced: boolean) =>
  reduced ? Number(open) : clamp(progress + (open ? delta : -delta) / 0.65, 0, 1)

export type CameraShot = { position: Vector3; target: Vector3 }
const up = new Vector3(0, 1, 0)
const facing = ({ position, target }: CameraShot) => new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position, target, up))
/**
 * Blends the free view toward the conversation close-up. The view turns along the shortest arc.
 * Blending look targets instead would swing a view that faces away through the floor in a few frames.
 */
export const blendCameraShot = (from: CameraShot, to: CameraShot, blend: number) =>
  ({ position: from.position.clone().lerp(to.position, blend), quaternion: facing(from).slerp(facing(to), blend) })

export type TiltReading ={ alpha: number; beta: number; gamma: number }
export type TiltOffset = { yaw: number; pitch: number }
const degrees = Math.PI / 180
// The view looks out of the back of the phone, not out of its top edge.
const backCamera = new Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2)
const screenAxis = new Vector3(0, 0, 1)

/** Phone orientation as a camera rotation. Quaternions stay stable when the phone stands upright. */
export const tiltPose = ({ alpha, beta, gamma }: TiltReading, screenAngle: number) =>
  new Quaternion().setFromEuler(new Euler(beta * degrees, alpha * degrees, -gamma * degrees, 'YXZ'))
    .multiply(backCamera)
    .multiply(new Quaternion().setFromAxisAngle(screenAxis, -screenAngle * degrees))

/** Turning the phone like a window looks the same way, at three quarters of the turn. */
export const resolveTiltView = (pose: Quaternion, rest: Quaternion): TiltOffset => {
  const look = new Vector3(0, 0, -1).applyQuaternion(rest.clone().invert().multiply(pose))
  const yaw = Math.atan2(look.x, -look.z) * 0.75
  const pitch = -Math.asin(clamp(look.y, -1, 1)) * 0.75
  // Adding zero turns a negative zero into zero for a level phone.
  return { yaw: clamp(yaw, -0.45, 0.45) + 0, pitch: clamp(pitch, -0.3, 0.3) + 0 }
}

/** A held pose slowly becomes the rest pose, so a new posture recentres the view. A flip or screen rotation rebases at once. */
export const followTiltRest = (rest: Quaternion | undefined, pose: Quaternion, delta: number) =>
  !rest || rest.angleTo(pose) > 75 * degrees ? pose.clone() : rest.clone().slerp(pose, Math.min(1, Math.max(0, delta) * 0.15))

/** Tilt adds to the dragged view. Pitch keeps the same limit as mouse look. */
export const tiltCameraView = (view: CameraView, tilt: TiltOffset): CameraView =>
  ({ ...view, yaw: view.yaw + tilt.yaw, pitch: clamp(view.pitch + tilt.pitch, -1.15, 1.15) })
