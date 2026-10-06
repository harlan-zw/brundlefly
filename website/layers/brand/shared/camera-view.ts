import { Euler, Quaternion, Vector3 } from 'three'

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

export type TiltReading = { alpha: number; beta: number; gamma: number }
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
