import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { FLOAT_POSE, multiply, type PoseInput, type Quat, type Vec, rotate, solveStance } from '../stance_float.ts'

const joints: Record<string, Vec> = JSON.parse(readFileSync(resolve(import.meta.dirname, '../source/rig-joints.json'), 'utf8')).joints_mm
const straight = Object.fromEntries(Object.entries(joints).map(([name, [x, y, z]]): [string, Vec] => [name, [x, z, -y]]))
const near = (a: number, b: number, message: string) => assert.ok(Math.abs(a - b) < 1e-3, `${message}: ${a} against ${b}`)
const offset = (from: string, to: string, set: Record<string, Vec>): Vec => [set[to]![0] - set[from]![0], set[to]![1] - set[from]![1], set[to]![2] - set[from]![2]]

test('the local rotations carry each joint to the place the solver reports', () => {
  const stance = solveStance(straight, FLOAT_POSE)
  // Walk from the pelvis to the left foot with the local rotations only, as the armature does.
  let world: Quat = [0, 0, 0, 1]
  let place: Vec = [straight.pelvis![0] + stance.pelvis_offset_mm[0], straight.pelvis![1] + stance.pelvis_offset_mm[1], straight.pelvis![2] + stance.pelvis_offset_mm[2]]
  const chain = ['pelvis', 'left-hip', 'left-knee', 'left-foot', 'left-foot-end']
  chain.slice(0, -1).forEach((joint, index) => {
    world = multiply(world, stance.rotations[joint]!)
    const step = rotate(world, offset(joint, chain[index + 1]!, straight))
    place = [place[0] + step[0], place[1] + step[1], place[2] + step[2]]
  })
  stance.joints_mm['left-foot-end']!.forEach((value, axis) => near(place[axis]!, value, `left toe axis ${axis}`))
})

test('the toes of the float pose point down, and no foot is level', () => {
  const stance = solveStance(straight, FLOAT_POSE)
  for (const side of ['left', 'right']) {
    const was = offset(`${side}-foot`, `${side}-foot-end`, straight)
    const now = offset(`${side}-foot`, `${side}-foot-end`, stance.joints_mm)
    const steepness = (v: Vec) => -v[1] / Math.hypot(v[0], v[1], v[2])
    assert.ok(steepness(now) > steepness(was) + 0.1, `${side} foot: ${steepness(now)} against ${steepness(was)}`)
  }
})

test('a bone with no turn of its own keeps the turn of its parent', () => {
  const pose: PoseInput = { pelvisOffset: [0, 0, 0], turns: { 'left-shoulder': { from: 'parent', turns: [['z', 30]] } } }
  const stance = solveStance(straight, pose)
  assert.deepEqual(stance.rotations['left-elbow'], [0, 0, 0, 1])
  // The forearm turned with the upper arm: the hand moved, and the arm kept its length.
  const before = offset('left-shoulder', 'left-hand', straight), after = offset('left-shoulder', 'left-hand', stance.joints_mm)
  near(Math.hypot(...after), Math.hypot(...before), 'arm length')
  assert.ok(Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]) > 5)
})

test('a bone that turns from the straight stand ignores its parent', () => {
  const pose: PoseInput = { pelvisOffset: [0, 0, 0], turns: { 'left-shoulder': { from: 'parent', turns: [['z', 30]] }, 'left-elbow': { from: 'straight', turns: [] } } }
  const stance = solveStance(straight, pose)
  const before = offset('left-elbow', 'left-hand', straight), after = offset('left-elbow', 'left-hand', stance.joints_mm)
  after.forEach((value, axis) => near(value, before[axis]!, `forearm axis ${axis}`))
})

test('a turn of a bone that the skeleton does not have is an error', () => {
  const pose: PoseInput = { pelvisOffset: [0, 0, 0], turns: { 'left-toe': { from: 'parent', turns: [['x', 10]] } } }
  assert.throws(() => solveStance(straight, pose), /no such bone/)
})
