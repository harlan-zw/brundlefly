import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Group, Mesh, SkinnedMesh, Texture, Vector2, Vector3 } from 'three'
import { createMeshMascot } from '../layers/brand/shared/mascot-mesh.ts'
import { createOffice } from '../layers/brand/shared/office.ts'
import { defaultSceneSettings } from '../layers/brand/shared/scene-settings.ts'
import { loadMascotModel } from './mascot-model.ts'
import { officePlan } from '../layers/brand/shared/office-layout.ts'
import { keyTaps, mannerismDuration, pauseMannerism, poseMannerisms } from '../layers/brand/shared/mannerism.ts'
import { advanceTurn, settleTurn, startStroll, startTurn, workLimit } from '../layers/brand/shared/mascot-stroll.ts'
import type { Stroll } from '../layers/brand/shared/mascot-stroll.ts'

const turning = { walkSpeed: 1, rest: 0.5, limit: 1.3, attention: 'free' as const }
const standingAt = (waypoint: number): Stroll => ({ ...startStroll([0, 0], waypoint), activity: { _tag: 'Pausing', remaining: 5, duration: 6, waypoint, age: 1 } })
const near = (value: number, wanted: number, slack: number) => assert.ok(Math.abs(value - wanted) <= slack, `${value} is not within ${slack} of ${wanted}`)

test('a stop at his work turns him past the walking limit, and no further than the work limit', () => {
  const stand = standingAt(0)
  near(settleTurn(startTurn(0.5), stand, { ...turning, stand: -2.35 }).heading, -2.35, 1e-9)
  near(settleTurn(startTurn(0.5), stand, { ...turning, stand: 3.1 }).heading, workLimit, 1e-9)
  assert.ok(Math.abs(settleTurn(startTurn(0.5), stand, turning).heading) <= turning.limit)
})

test('he steps round to his work at a stop, and back when a visitor has his attention, with no jump', () => {
  let turn = startTurn(0.5)
  const stand = standingAt(0)
  let largest = 0
  const run = (seconds: number, input: Parameters<typeof advanceTurn>[2]) => {
    for (let time = 0; time < seconds; time += 1 / 60) {
      const next = advanceTurn(turn, stand, input)
      largest = Math.max(largest, Math.abs(next.heading - turn.heading))
      turn = next
    }
  }
  run(12, { ...turning, stand: -2.35, delta: 1 / 60 })
  near(turn.heading, -2.35, 0.13)
  run(12, { ...turning, attention: 'noticed', delta: 1 / 60 })
  assert.ok(Math.abs(turn.heading) <= turning.limit + 0.01, `he stays turned away at ${turn.heading}`)
  // A sixtieth of a second never carries more of the turn than his steps in place allow.
  assert.ok(largest < 0.05, `one frame turned him ${largest}`)
})

test('the typing habit strikes its keys in bursts, with pauses between', () => {
  assert.equal(keyTaps(0.5), 0)
  assert.ok(keyTaps(mannerismDuration({ _tag: 'TypeKeys' })) > 20)
  let last = 0
  for (let age = 0; age <= 6.4; age += 0.05) { assert.ok(keyTaps(age) >= last); last = keyTaps(age) }
  // Between the first and the second burst he reads, and strikes no key.
  assert.equal(keyTaps(2.85), keyTaps(2.35))
})

test('typing lifts both long arms, and tending a jar lifts the arm on the side the jar stands', () => {
  const typing = poseMannerisms([{ mannerism: { _tag: 'TypeKeys' }, age: 1.5 }]).turns
  assert.ok(typing['left-shoulder']![0] < -0.4 && typing['right-shoulder']![0] < -0.4)
  const right = poseMannerisms([{ mannerism: { _tag: 'TendJar' }, age: 2.5, side: 1 }]).turns
  const left = poseMannerisms([{ mannerism: { _tag: 'TendJar' }, age: 2.5, side: -1 }]).turns
  assert.ok(right['left-shoulder']![0] < -0.6)
  assert.equal(right['right-shoulder'], undefined)
  assert.ok(left['right-shoulder']![0] < -0.6)
})

test('the two stations have a work habit, a facing, and the longest stops of his round', () => {
  const stations = officePlan.stops.filter(stop => stop.facing !== undefined)
  assert.deepEqual(stations.map(stop => stop.habit), ['TypeKeys', 'TendJar'])
  const others = officePlan.stops.filter(stop => stop.facing === undefined)
  assert.ok(Math.min(...stations.map(stop => stop.pause)) > Math.max(...others.map(stop => stop.pause)))
  for (const stop of stations) assert.ok(mannerismDuration({ _tag: stop.habit }) < stop.pause)
})

test('the selected jar turns during contact and settles when the habit ends', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => ({ fillRect() {}, clearRect() {} }) }) } })
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document') })
  const model = await loadMascotModel(new URL('../../assets/3d/office/office.glb', import.meta.url))
  const texture = new Texture()
  const office = createOffice({ model: model.scene, lightMax: 1, atlas: texture, floor: texture, wall: texture, ceiling: texture, concrete: texture, light: texture })
  const vertices = () => {
    const points: string[] = []
    office.root.updateMatrixWorld(true)
    office.root.traverse(object => {
      if (!(object instanceof Mesh)) return
      const positions = object.geometry.getAttribute('position')
      const indices = object.geometry.getIndex()!
      for (let i = 0; i < indices.count; i++) {
        const p = object.localToWorld(new Vector3().fromBufferAttribute(positions, indices.getX(i)))
        if (p.x > 1 && p.x < 1.5 && p.y > -0.63 && p.y < 0 && p.z < -2.9) points.push(p.toArray().map(n => n.toFixed(4)).join(','))
      }
    })
    return points.sort()
  }
  const result = createMeshMascot(await loadMascotModel(), 2.5)
  assert.equal(result._tag, 'Ok')
  if (result._tag !== 'Ok') return
  const mascot = result.mascot
  const station = officePlan.stops.find(stop => stop.habit === 'TendJar')!
  const figure = new Group()
  figure.scale.setScalar(1.25)
  figure.position.set(station.position[0], officePlan.room.floorY, station.position[1])
  figure.add(mascot.root)
  let turn = startTurn(1.3)
  let contacts = 0
  for (let age = 0; age < station.pause; age += 1 / 30) {
    const stroll: Stroll = { ...startStroll(station.position, 1), activity: { _tag: 'Pausing', age, duration: station.pause, remaining: station.pause - age, waypoint: 1 } }
    turn = advanceTurn(turn, stroll, { ...turning, walkSpeed: 0.63, stand: station.facing, delta: 1 / 30 })
    const habit = pauseMannerism(stroll, officePlan.stops.map(stop => stop.habit))!
    const mannerism = poseMannerisms([{ ...habit, side: -1 }])
    const reach = mannerism.jar ? { target: office.jarGrip(mannerism.jar.turn), ...mannerism.jar } : undefined
    mascot.pose!({ time: age, pressure: 0, pointer: new Vector2(), transform: 'squeeze', mannerism, reach, stepInPlace: turn.steps, stepPhase: turn.phase }, undefined, turn.heading)
    office.update({ time: 0, light: 1, settings: defaultSceneSettings, mannerism })
    if (!reach || Math.abs(reach.turn) < 0.02) continue
    contacts++
    const grip = mascot.root.getObjectByName('right-finger-2')!.getWorldPosition(new Vector3())
    assert.ok(grip.distanceTo(reach.target) < 0.04, 'the claw must follow the rotating jar during contact')
    let skinGap = Infinity
    figure.updateMatrixWorld(true)
    mascot.root.traverse(object => {
      if (!(object instanceof SkinnedMesh)) return
      object.skeleton.update()
      const positions = object.geometry.getAttribute('position')
      for (let i = 0; i < positions.count; i++) {
        const point = object.localToWorld(object.applyBoneTransform(i, new Vector3().fromBufferAttribute(positions, i)))
        skinGap = Math.min(skinGap, point.distanceTo(reach.target))
      }
    })
    assert.ok(skinGap < 0.06, 'the rendered claw skin must touch the jar, including while it turns')
  }
  assert.ok(contacts > 30, 'the turn must hold contact for more than one second')
  mascot.dispose()
  const update = (age?: number) => office.update({ time: 0, light: 1, settings: defaultSceneSettings,
    mannerism: age === undefined ? undefined : poseMannerisms([{ mannerism: { _tag: 'TendJar' }, age, side: -1 }]) })
  update()
  const resting = vertices()
  update(2.8)
  const first = vertices()
  assert.notDeepEqual(first, resting, 'the selected jar must rotate during contact')
  update(3)
  assert.notDeepEqual(vertices(), first, 'the jar must follow the changing claw turn')
  update()
  assert.deepEqual(vertices(), resting, 'the jar must return to rest after contact')
  office.dispose()
})
