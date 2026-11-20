import { Vector2 } from 'three'
import type { Euler } from 'three'
import type { Transform } from './organism'
import { wanderingLook } from './eye-gaze.ts'
import type { EyeFocus } from './eye-gaze.ts'
import type { MannerismJoint, MannerismPose } from './mannerism.ts'

/** The joints the pose code turns. Left and right are screen left and screen right. */
export const bodyJointNames = [
  'pelvis', 'chest', 'head',
  'left-shoulder', 'left-elbow', 'left-hand', 'right-shoulder', 'right-elbow', 'right-hand',
  'left-rib', 'left-small-elbow', 'left-small-hand', 'right-rib', 'right-small-elbow', 'right-small-hand',
  'left-hip', 'left-knee', 'left-foot', 'right-hip', 'right-knee', 'right-foot',
  'left-wing', 'right-wing', 'left-wing-tip', 'right-wing-tip',
] as const
export type BodyJointName = typeof bodyJointNames[number]
/** `gait` blends the walk cycle from standing (0) to a full stride (1). `gaze` turns only the head. `eyes` aims the pupils. `mannerism` layers a habit on top. */
export type MascotPoseInput = {
  time: number, pressure: number, pointer: Vector2, transform: Transform
  gait?: number, walkPhase?: number, gaze?: { yaw: number, tilt: number }
  /** Steps in place, for a full body that turns where it stands: how far each foot lifts, from 0 to 1, and the cycle of those steps. */
  stepInPlace?: number, stepPhase?: number
  speaking?: number, blink?: number, brow?: number, squint?: number, eyes?: EyeFocus, mannerism?: MannerismPose
}
/** Whole-figure motion and face inputs that the pose produces beside the joint turns. */
export type BodyPose = {
  speaking: number, blink: number, calm: number
  root: { rotationY: number, positionY: number, scaleY: number }
}
type Turnable = { rotation: Euler }

// Irregular schedules keep idle habits from ticking like a metronome. Offsets repeat every cycle.
const blinkSchedule = { cycle: 26.5, offsets: [1.8, 5.9, 6.25, 9.4, 14.6, 17.2, 22.8], halfWidth: 0.12 }
const buzzSchedule = { cycle: 31, offsets: [7.4, 21.1], halfWidth: 0.32 }
const rubSchedule = { cycle: 33, offsets: [11.5, 27], halfWidth: 0.95 }
function scheduled(time: number, { cycle, offsets, halfWidth }: { cycle: number, offsets: readonly number[], halfWidth: number }) {
  const local = (time % cycle + cycle) % cycle
  let nearest = Infinity
  for (const offset of offsets) {
    const gap = Math.abs(local - offset)
    nearest = Math.min(nearest, gap, cycle - gap)
  }
  return Math.max(0, 1 - nearest / halfWidth)
}
const ease = (value: number) => value * value * (3 - 2 * value)

/**
 * Turns the body joints for one frame. Every joint must start the frame at its rest rotation, which is identity.
 * The axes are +X screen right, +Y up, and +Z toward the viewer. The same code poses the relief rig and a mesh with these joints.
 */
export function poseBody(joint: (name: BodyJointName) => Turnable, input: MascotPoseInput): BodyPose {
  const { time, pressure, pointer, transform, walkPhase = time * 3.6, mannerism } = input
  const calm = 1 - (mannerism?.calm ?? 0)
  const gait = Math.min(1, Math.max(0, input.gait ?? 0))
  const speaking = Math.min(1, Math.max(0, input.speaking ?? 0, mannerism?.jaw ?? 0))
  const blink = Math.min(1, Math.max(0, input.blink ?? scheduled(time, blinkSchedule), mannerism?.blink ?? 0))
  // Going still slows his breath without stopping it.
  const pulse = Math.sin(time * 1.4) * (0.35 + 0.65 * calm)
  const stride = gait * Math.sin(walkPhase)
  const leftLift = gait * Math.max(0, Math.cos(walkPhase))
  const rightLift = gait * Math.max(0, -Math.cos(walkPhase))
  const still = 1 - gait
  const buzz = Math.max(ease(scheduled(time, buzzSchedule)) * calm, mannerism?.buzz ?? 0)
  const rub = Math.max(ease(scheduled(time, rubSchedule)) * still * calm, mannerism?.rub ?? 0)
  // Small rotations preserve the canonical relief while depth travel gives each foot a real stride.
  joint('pelvis').rotation.set(0, stride * 0.035, stride * 0.016)
  // He hunches into the walk and lifts his chest a little while he speaks.
  joint('chest').rotation.x = pulse * 0.025 + pressure * 0.035 + gait * 0.04 - speaking * 0.015
  joint('chest').rotation.z = -stride * 0.025
  // A wandering look leads and the head follows late and slow, so the glance reads from across the chamber.
  const follow = input.eyes?._tag === 'Wander' ? wanderingLook(time - 0.16, 0.6) : { x: 0, y: 0 }
  const headFollow = (1 - gait * 0.7) * calm
  joint('head').rotation.set(-pointer.y * 0.08 - speaking * 0.03 + Math.sin(time * 0.53) * 0.012 * still * calm - follow.y * 0.05 * headFollow,
    pointer.x * 0.14 + (input.gaze?.yaw ?? 0) + follow.x * 0.09 * headFollow, pulse * 0.015 + (input.gaze?.tilt ?? 0))
  joint('left-shoulder').rotation.z = -pressure * 0.09 + pulse * 0.02
  joint('right-shoulder').rotation.z = pressure * 0.09 - pulse * 0.02
  joint('left-shoulder').rotation.x = -stride * 0.15
  joint('right-shoulder').rotation.x = stride * 0.15
  joint('left-elbow').rotation.z = pressure * 0.1
  joint('right-elbow').rotation.z = -pressure * 0.1
  joint('left-elbow').rotation.x = leftLift * 0.045
  joint('right-elbow').rotation.x = rightLift * 0.045
  joint('left-rib').rotation.x = stride * 0.11
  joint('right-rib').rotation.x = -stride * 0.11
  joint('left-rib').rotation.z = stride * 0.028
  joint('right-rib').rotation.z = -stride * 0.028
  // Fly habit: the small inner arms rub their hands together during some idle moments.
  const scrub = Math.sin(time * 11) * rub
  joint('left-small-elbow').rotation.z = -pressure * 0.13 - rub * 0.1 + scrub * 0.1
  joint('right-small-elbow').rotation.z = pressure * 0.13 + rub * 0.1 + scrub * 0.1
  joint('left-small-elbow').rotation.x = -stride * 0.075
  joint('right-small-elbow').rotation.x = stride * 0.075
  joint('left-hand').rotation.y = pressure * 0.18
  joint('right-hand').rotation.y = -pressure * 0.18
  // Claws flex slowly while he stands, out of step with each other.
  joint('left-hand').rotation.z = Math.sin(time * 0.81) * 0.045 * still * calm
  joint('right-hand').rotation.z = Math.sin(time * 0.67 + 2.1) * 0.04 * still * calm
  const spread = transform === 'unfurl' ? pressure * 0.6 : pressure * 0.1
  // Wings idle with a slow drift and an occasional short buzz.
  const flutter = Math.sin(time * 71) * buzz
  joint('left-wing').rotation.y = -spread + Math.sin(time * 2.2) * 0.035 * calm + stride * 0.035 + flutter * 0.11
  joint('right-wing').rotation.y = spread - Math.sin(time * 2.2 + 1) * 0.025 * calm - stride * 0.018 - flutter * 0.07
  joint('left-wing').rotation.z = leftLift * 0.018
  joint('right-wing').rotation.z = -rightLift * 0.012
  joint('left-wing-tip').rotation.set(Math.sin(time * 3.1 + 0.7) * 0.032 * calm + leftLift * 0.04, -spread * 0.38, 0)
  joint('right-wing-tip').rotation.set(Math.sin(time * 2.7 + 1.9) * 0.018 * calm + rightLift * 0.022, spread * 0.26, 0)
  joint('left-hip').rotation.set(stride * 0.22, 0, stride * 0.045)
  joint('right-hip').rotation.set(-stride * 0.22, 0, -stride * 0.045)
  joint('left-knee').rotation.set(pulse * 0.018 - leftLift * 0.18, 0, leftLift * 0.055)
  joint('right-knee').rotation.set(-pulse * 0.015 - rightLift * 0.18, 0, -rightLift * 0.055)
  joint('left-foot').rotation.set(leftLift * 0.11 - stride * 0.06, 0, -leftLift * 0.04)
  joint('right-foot').rotation.set(rightLift * 0.11 + stride * 0.06, 0, rightLift * 0.04)
  for (const [name, [x, y, z]] of Object.entries(mannerism?.turns ?? {}) as [MannerismJoint, [number, number, number]][]) {
    const rotation = joint(name).rotation
    rotation.set(rotation.x + x, rotation.y + y, rotation.z + z)
  }
  return {
    speaking, blink, calm,
    root: {
      rotationY: pointer.x * 0.16 + (transform === 'twist' ? pressure * 0.22 : 0),
      // The body rises as the legs pass each other and settles as each foot lands.
      positionY: pulse * 0.012 + gait * Math.abs(Math.cos(walkPhase)) * 0.03,
      scaleY: transform === 'squeeze' ? 1 - pressure * 0.04 : 1,
    },
  }
}

/** The three motions the inspector plays and the relief rig exports as clips. Each maps a time in the clip to a pose input. */
export const clipPoses = {
  Idle: { duration: 4.8, pose: (time: number): MascotPoseInput => ({ time, pressure: 0, pointer: new Vector2(), transform: 'squeeze' }) },
  Walk: { duration: 1.75, pose: (time: number): MascotPoseInput => ({
    time: 0, pressure: 0, pointer: new Vector2(), transform: 'squeeze', gait: 1,
    walkPhase: time / 1.75 * Math.PI * 2,
  }) },
  Speaking: { duration: 3.2, pose: (time: number): MascotPoseInput => ({
    time: 0, pressure: 0, pointer: new Vector2(), transform: 'squeeze',
    speaking: Math.pow(Math.sin(time * Math.PI * 5 / 3.2), 2) * (0.6 + Math.sin(time * 9) * 0.22),
    blink: Math.max(0, 1 - Math.abs(time - 2.45) / 0.12),
  }) },
} as const

/** Whole-figure motion that `addBodyDepth` adds, in rig units, and a bounce for loose parts such as mouthparts. */
export type BodyDepth = { rootX: number, bounce: number }

/**
 * Adds the motion a full body can take and a flat relief cannot. It runs after `poseBody` and adds to its turns.
 * Walking: a longer stride with a real foot lift, a pelvis that twists against the chest, forearms that follow through,
 * and wings that lag a step behind. Standing: his weight shifts slowly from one leg to the other, and he breathes deeper.
 * The relief rig does not use it, because large turns out of the picture plane tear a relief.
 */
export function addBodyDepth(joint: (name: BodyJointName) => Turnable, input: MascotPoseInput): BodyDepth {
  const { time, walkPhase = time * 3.6 } = input
  const calm = 1 - (input.mannerism?.calm ?? 0)
  const gait = Math.min(1, Math.max(0, input.gait ?? 0))
  const still = (1 - gait) * calm
  const stride = gait * Math.sin(walkPhase)
  const leftLift = gait * Math.max(0, Math.cos(walkPhase))
  const rightLift = gait * Math.max(0, -Math.cos(walkPhase))
  // Loose parts trail the stride by about a sixth of a step.
  const trail = gait * Math.sin(walkPhase - 0.9)
  const turn = (name: BodyJointName, x: number, y: number, z: number) => {
    const { rotation } = joint(name)
    rotation.set(rotation.x + x, rotation.y + y, rotation.z + z)
  }
  // Legs: each thigh swings further, the knee folds as the foot leaves the floor, and the foot trails.
  turn('left-hip', stride * 0.1, 0, 0)
  turn('right-hip', -stride * 0.1, 0, 0)
  turn('left-knee', -leftLift * 0.22, 0, 0)
  turn('right-knee', -rightLift * 0.22, 0, 0)
  turn('left-foot', leftLift * 0.16, 0, 0)
  turn('right-foot', rightLift * 0.16, 0, 0)
  // Steps in place: each foot lifts in turn with no stride, so he can turn where he stands. They fade as a walk takes over.
  const inPlace = Math.min(1, Math.max(0, input.stepInPlace ?? 0)) * (1 - gait)
  const leftStep = inPlace * Math.max(0, Math.cos(input.stepPhase ?? 0))
  const rightStep = inPlace * Math.max(0, -Math.cos(input.stepPhase ?? 0))
  turn('left-knee', -leftStep * 0.4, 0, 0)
  turn('right-knee', -rightStep * 0.4, 0, 0)
  turn('left-foot', leftStep * 0.27, 0, 0)
  turn('right-foot', rightStep * 0.27, 0, 0)
  turn('pelvis', 0, 0, (leftStep - rightStep) * 0.03)
  turn('chest', 0, 0, (rightStep - leftStep) * 0.03)
  // Spine: the pelvis follows the leading leg and drops over the lifted one. The chest twists against it and leans into the walk.
  turn('pelvis', 0, stride * 0.06, stride * 0.03)
  turn('chest', gait * 0.03, -stride * 0.11, 0)
  // The head undoes part of the chest's twist and lean, so his eyes stay level and ahead.
  turn('head', -gait * 0.03, stride * 0.05, 0)
  // Arms: only the forearm swings forward, after the shoulder. A backward swing would bring a long hand into its own leg.
  turn('left-elbow', -Math.max(0, trail) * 0.12, 0, 0)
  turn('right-elbow', -Math.max(0, -trail) * 0.12, 0, 0)
  // Wings: they lag the stride and bounce twice in each cycle, the large one more than the small one.
  const bounce = gait * Math.sin(walkPhase * 2 - 1.2)
  turn('left-wing', 0, trail * 0.07, 0)
  turn('right-wing', 0, -trail * 0.05, 0)
  turn('left-wing-tip', bounce * 0.06, 0, 0)
  turn('right-wing-tip', bounce * 0.04, 0, 0)
  // Standing: his weight shifts from leg to leg. Each hip turns back by the pelvis's roll, so both legs stay upright.
  const shift = Math.sin(time * 0.42) * still
  turn('pelvis', 0, 0, shift * 0.035)
  turn('left-hip', 0, 0, -shift * 0.035)
  turn('right-hip', 0, 0, -shift * 0.035)
  turn('chest', Math.sin(time * 1.4) * 0.02 * still, 0, -shift * 0.03)
  turn('head', 0, 0, shift * 0.012)
  turn('left-wing', 0, 0, Math.sin(time * 0.5 + 1) * 0.03 * still)
  turn('right-wing', 0, 0, -Math.sin(time * 0.5 + 2.2) * 0.02 * still)
  return { rootX: shift * 0.015, bounce }
}
