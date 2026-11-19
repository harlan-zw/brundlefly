import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { FLOAT_POSE, type PoseInput, type Vec, rotate, solveStance } from '../stance_float.ts'

const joints: Record<string, Vec> = JSON.parse(readFileSync(resolve(import.meta.dirname, '../source/rig-joints.json'), 'utf8')).joints_mm
const straight = Object.fromEntries(Object.entries(joints).map(([name, [x, y, z]]): [string, Vec] => [name, [x, z, -y]]))
const near = (a: number, b: number, message: string) => assert.ok(Math.abs(a - b) < 1e-3, `${message}: ${a} against ${b}`)

test('each sole stays flat on the floor in the float pose', () => {
  const stance = solveStance(straight, FLOAT_POSE)
  for (const side of ['left', 'right'] as const) {
    const leg = FLOAT_POSE.legs[side]
    const [x, y, z] = stance.joints_mm[`${side}-foot`]!
    // The ankle keeps its height and moves by the input across and forward.
    near(y, straight[`${side}-foot`]![1], `${side} ankle height`)
    near(x, straight[`${side}-foot`]![0] + leg.ankle[0], `${side} ankle across`)
    near(z, straight[`${side}-foot`]![2] + leg.ankle[1], `${side} ankle forward`)
    // The toe end is as far above or below the ankle as in the straight stand: the foot turned about the vertical only.
    near(stance.joints_mm[`${side}-foot-end`]![1] - y, straight[`${side}-foot-end`]![1] - straight[`${side}-foot`]![1], `${side} toe height`)
  }
})

test('the local rotations carry each joint to the place the solver reports', () => {
  const stance = solveStance(straight, FLOAT_POSE)
  // Walk from the pelvis to the left hand with the local rotations only.
  let world: [number, number, number, number] = [0, 0, 0, 1]
  let place: Vec = [straight.pelvis![0] + stance.pelvis_offset_mm[0], straight.pelvis![1] + stance.pelvis_offset_mm[1], straight.pelvis![2] + stance.pelvis_offset_mm[2]]
  const chain = ['pelvis', 'chest', 'left-shoulder', 'left-elbow', 'left-hand']
  chain.forEach((joint, index) => {
    const [ax, ay, az, aw] = world, [bx, by, bz, bw] = stance.rotations[joint]!
    world = [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz]
    const next = chain[index + 1]
    if (next) {
      const step = rotate(world, [straight[next]![0] - straight[joint]![0], straight[next]![1] - straight[joint]![1], straight[next]![2] - straight[joint]![2]])
      place = [place[0] + step[0], place[1] + step[1], place[2] + step[2]]
    }
  })
  stance.joints_mm['left-hand']!.forEach((value, axis) => near(place[axis]!, value, `left hand axis ${axis}`))
})

test('a pelvis too high for the legs is an error, and the feet do not leave the floor', () => {
  const lifted: PoseInput = { ...FLOAT_POSE, pelvisOffset: [0, 12, 0] }
  assert.throws(() => solveStance(straight, lifted), /ankle is .* mm from its hip/)
})
