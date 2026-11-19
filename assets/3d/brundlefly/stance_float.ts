// Make source/stance-float.json: the stance of the jar variant of the print model.
//
//   node stance_float.ts
//
// The figure hangs slack, as a specimen in fluid, and stands on two flat soles.
// The inputs are FLOAT_POSE below. The output file repeats them, so the file alone says how it was made.
// Axes are the site's: +X to the figure's left side, +Y up, +Z the way the body faces. Units are millimetres and degrees.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type Vec = [number, number, number]
export type Quat = [number, number, number, number]   // x, y, z, w
/** One turn about a fixed axis of the site, in degrees. */
export type Turn = ['x' | 'y' | 'z', number]

export interface LegInput {
  /** Where the ankle goes, from its place in the straight stand: across and forward. The height does not change. */
  ankle: [number, number]
  /** The way the knee points, from the hip: across and forward. */
  knee: [number, number]
  /** The turn of the foot about the vertical. The sole stays flat. */
  footYaw: number
}

export interface PoseInput {
  /** The pelvis moves this far from the straight stand: across, up, forward. */
  pelvisOffset: Vec
  /** Turns of a bone, applied in order. A bone that is not listed keeps the turn of its parent. */
  turns: Record<string, { from: 'parent' | 'straight', turns: Turn[] }>
  legs: { left: LegInput, right: LegInput }
}

export interface Stance {
  rotations: Record<string, Quat>
  pelvis_offset_mm: Vec
  /** Where each joint is after the pose, in the axes of the site. */
  joints_mm: Record<string, Vec>
}

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const length = (a: Vec) => Math.sqrt(dot(a, a))
const unit = (a: Vec): Vec => scale(a, 1 / length(a))

const IDENTITY: Quat = [0, 0, 0, 1]
const multiply = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
const inverse = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]]
export const rotate = (q: Quat, v: Vec): Vec => {
  const u: Vec = [q[0], q[1], q[2]]
  const t = scale(cross(u, v), 2)
  return add(add(v, scale(t, q[3])), cross(u, t))
}
const aboutAxis = (axis: Vec, degrees: number): Quat => {
  const half = degrees * Math.PI / 360
  const [x, y, z] = scale(unit(axis), Math.sin(half))
  return [x, y, z, Math.cos(half)]
}
/** The shortest turn that takes one direction onto another. It adds no twist. */
const between = (from: Vec, to: Vec): Quat => {
  const a = unit(from), b = unit(to)
  const w = 1 + dot(a, b)
  if (w < 1e-9)
    return aboutAxis(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]), 180)
  const [x, y, z] = cross(a, b)
  const n = Math.sqrt(x * x + y * y + z * z + w * w)
  return [x / n, y / n, z / n, w / n]
}
const AXES: Record<Turn[0], Vec> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }
const turned = (turns: Turn[]): Quat => turns.reduce<Quat>((q, [axis, degrees]) => multiply(aboutAxis(AXES[axis], degrees), q), IDENTITY)

/** Each bone: its joint, its parent joint, and the joint at its far end. Parents come first. */
export function boneList(): [string, string | undefined, string][] {
  const bones: [string, string | undefined, string][] = [['pelvis', undefined, 'chest'], ['chest', 'pelvis', 'head'], ['head', 'chest', 'head-end']]
  for (const s of ['left', 'right']) {
    bones.push([`${s}-shoulder`, 'chest', `${s}-elbow`], [`${s}-elbow`, `${s}-shoulder`, `${s}-hand`], [`${s}-hand`, `${s}-elbow`, `${s}-hand-end`],
      [`${s}-rib`, 'chest', `${s}-small-elbow`], [`${s}-small-elbow`, `${s}-rib`, `${s}-small-hand`], [`${s}-small-hand`, `${s}-small-elbow`, `${s}-small-hand-end`],
      [`${s}-wing`, 'chest', `${s}-wing-tip`], [`${s}-wing-tip`, `${s}-wing`, `${s}-wing-tip-end`],
      [`${s}-hip`, 'pelvis', `${s}-knee`], [`${s}-knee`, `${s}-hip`, `${s}-foot`], [`${s}-foot`, `${s}-knee`, `${s}-foot-end`])
  }
  return bones
}

/**
 * Solve a stance. `straight` holds each joint of the straight stand in the axes of the site.
 * Each leg reaches from its hip to its ankle with two bones. Each foot keeps its height and turns about the vertical only.
 */
export function solveStance(straight: Record<string, Vec>, pose: PoseInput): Stance {
  const world: Record<string, Quat> = {}
  const posed: Record<string, Vec> = { pelvis: add(straight.pelvis!, pose.pelvisOffset) }
  const bones = boneList()
  for (const [joint, parent] of bones) {
    if (parent && !posed[joint])
      posed[joint] = add(posed[parent]!, rotate(world[parent]!, sub(straight[joint]!, straight[parent]!)))
    const carried = parent ? world[parent]! : IDENTITY
    const side = joint.split('-')[0] as 'left' | 'right'
    if (joint.endsWith('-hip')) {
      const leg = pose.legs[side]
      const knee = `${side}-knee`, foot = `${side}-foot`
      const hip = posed[joint]!
      const thigh = length(sub(straight[knee]!, straight[joint]!)), shin = length(sub(straight[foot]!, straight[knee]!))
      const ankle: Vec = [straight[foot]![0] + leg.ankle[0], straight[foot]![1], straight[foot]![2] + leg.ankle[1]]
      const reach = length(sub(ankle, hip))
      if (reach > (thigh + shin) * 0.995)
        throw new Error(`The ${side} ankle is ${reach.toFixed(2)} mm from its hip, and the leg is ${(thigh + shin).toFixed(2)} mm long. Lower the pelvis or move the ankle.`)
      const toAnkle = unit(sub(ankle, hip))
      const along = (thigh * thigh - shin * shin + reach * reach) / (2 * reach)
      const out = Math.sqrt(Math.max(thigh * thigh - along * along, 0))
      const hint: Vec = [leg.knee[0], 0, leg.knee[1]]
      const bend = unit(sub(hint, scale(toAnkle, dot(hint, toAnkle))))
      const kneePoint = add(add(hip, scale(toAnkle, along)), scale(bend, out))
      const thighWas = rotate(carried, sub(straight[knee]!, straight[joint]!))
      world[joint] = multiply(between(thighWas, sub(kneePoint, hip)), carried)
      posed[knee] = kneePoint
      const shinWas = rotate(world[joint]!, sub(straight[foot]!, straight[knee]!))
      world[knee] = multiply(between(shinWas, sub(add(hip, scale(toAnkle, reach)), kneePoint)), world[joint]!)
    }
    else if (joint.endsWith('-knee')) { /* solved with the hip */ }
    else if (joint.endsWith('-foot')) {
      world[joint] = aboutAxis(AXES.y, pose.legs[side].footYaw)
    }
    else {
      const own = pose.turns[joint]
      world[joint] = own ? multiply(turned(own.turns), own.from === 'parent' ? carried : IDENTITY) : carried
    }
  }
  for (const [joint, , end] of bones)
    posed[end] ??= add(posed[joint]!, rotate(world[joint]!, sub(straight[end]!, straight[joint]!)))
  const round = (value: number) => Math.round(value * 1e5) / 1e5
  const rotations = Object.fromEntries(bones.map(([joint, parent]): [string, Quat] => {
    const local = multiply(inverse(parent ? world[parent]! : IDENTITY), world[joint]!)
    return [joint, local.map(round) as Quat]
  }))
  return { rotations, pelvis_offset_mm: pose.pelvisOffset, joints_mm: Object.fromEntries(Object.entries(posed).map(([name, p]) => [name, p.map(round) as Vec])) }
}

// The float pose. A turn about x bends a part forward when it is positive. A turn about z rolls it: positive lifts the
// figure's left side. A turn about y turns it about the vertical: positive turns the front toward the figure's left.
export const FLOAT_POSE: PoseInput = {
  pelvisOffset: [0, 1.2, -1],
  turns: {
    'pelvis': { from: 'straight', turns: [['x', -10], ['z', 5]] },
    'chest': { from: 'parent', turns: [['x', 3], ['z', -8], ['y', 6]] },
    'head': { from: 'parent', turns: [['x', 14], ['z', 22], ['y', -15]] },
    'left-shoulder': { from: 'parent', turns: [['z', -4], ['x', -4]] },
    'left-elbow': { from: 'straight', turns: [['x', -12], ['z', 4]] },
    'left-hand': { from: 'straight', turns: [] },
    'right-shoulder': { from: 'parent', turns: [['z', 22], ['x', 4]] },
    'right-elbow': { from: 'straight', turns: [['x', -36], ['z', 10]] },
    'right-hand': { from: 'straight', turns: [['x', -10]] },
    'left-small-elbow': { from: 'straight', turns: [['x', -10]] },
    'left-small-hand': { from: 'straight', turns: [['x', 40]] },
    'right-small-elbow': { from: 'straight', turns: [['x', -5]] },
    'right-small-hand': { from: 'straight', turns: [['x', 45]] },
    'left-wing': { from: 'parent', turns: [['x', -40], ['z', -18]] },
    'left-wing-tip': { from: 'parent', turns: [['x', -12]] },
    'right-wing': { from: 'parent', turns: [['x', -45], ['z', 20]] },
    'right-wing-tip': { from: 'parent', turns: [['x', -12]] },
  },
  legs: {
    left: { ankle: [4, 5], knee: [-0.6, 1], footYaw: 12 },
    right: { ankle: [-3, -5], knee: [0.6, 1], footYaw: -12 },
  },
}

const NOTE = 'Stance of the jar variant of the print model: the figure hangs slack, as a specimen in fluid, and stands on two flat soles with no base. '
  + 'Build it with build_from_mesh.py --stance source/stance-float.json --no-base. The format is that of stance.json: each rotation is a joint\'s local quaternion [x, y, z, w] '
  + 'from the straight stand of rig-joints.json, in the body\'s axes: +X to the figure\'s left side, +Y up, +Z the way the body faces. '
  + 'stance_float.ts made this file from the values under inputs. Change them there and run it again. The website model does not use this file.'

function main(): void {
  const dir = join(import.meta.dirname, 'source')
  const joints: Record<string, Vec> = JSON.parse(readFileSync(join(dir, 'rig-joints.json'), 'utf8')).joints_mm
  // rig-joints.json has Z up and the figure facing -Y.
  const straight = Object.fromEntries(Object.entries(joints).map(([name, [x, y, z]]): [string, Vec] => [name, [x, z, -y]]))
  const stance = solveStance(straight, FLOAT_POSE)
  const file = { note: NOTE, inputs: FLOAT_POSE, pelvis_offset_mm: stance.pelvis_offset_mm, rotations: stance.rotations }
  writeFileSync(join(dir, 'stance-float.json'), `${JSON.stringify(file, null, 1)}\n`)
  console.log(`stance-float.json: ${Object.keys(stance.rotations).length} joints`)
}

if (import.meta.main)
  main()
