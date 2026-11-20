import assert from 'node:assert/strict'
import test from 'node:test'
import { Group, SkinnedMesh, Vector2, Vector3 } from 'three'
import type { Object3D } from 'three'
import { createMeshMascot } from '../layers/brand/shared/mascot-mesh.ts'
import { strollPose } from '../layers/brand/shared/mascot-stroll.ts'
import { loadMascotModel } from './mascot-model.ts'
import { frame, meshCadence, meshWalk, sequence, startWalk, stepWalk, walkSets } from './walk-sim.ts'
import type { Walk } from './walk-sim.ts'

/**
 * The real model, walked through the scene's own loop. Nobody can watch a headless walk, so these tests measure it:
 * how far a foot on the floor moves, how he turns and speeds up, and what his legs do.
 * The scene's floor is at -2.2 and its figure is 1.25 times the mascot's own size.
 */
const floor = -2.2
const height = 2.5 * meshWalk.scale
const sides = ['left', 'right'] as const

async function standModel(start: readonly [number, number]) {
  const result = createMeshMascot(await loadMascotModel(), 2.5)
  assert.equal(result._tag, 'Ok')
  const mascot = (result as Extract<typeof result, { _tag: 'Ok' }>).mascot
  assert.ok(mascot.pose && mascot.strideLength, 'The model must take the pose code and have legs to stride with.')
  const figure = new Group()
  figure.scale.setScalar(meshWalk.scale)
  figure.add(mascot.root)
  figure.position.set(start[0], floor, start[1])
  const joint = (name: string) => mascot.root.getObjectByName(name)!
  const place = (object: Object3D) => object.getWorldPosition(new Vector3())
  mascot.pose({ time: 0, pressure: 0, pointer: new Vector2(), transform: 'squeeze' })
  // Each ankle's height while he stands. A foot is on the floor while its ankle is within one percent of his height of that.
  const ankleRest = sides.map(side => place(joint(`${side}-foot`)).y)
  let time = 0
  /** One frame as the scene draws it. Returns what the skeleton itself shows. */
  const show = (walk: Walk, delta: number) => {
    figure.position.set(walk.stroll.position[0], floor, walk.stroll.position[1])
    time += delta
    mascot.pose!({ time, pressure: 0, pointer: new Vector2(), transform: 'squeeze', ...strollPose(walk.stroll), eyes: { _tag: 'Wander' },
      stepInPlace: walk.turn.steps, stepPhase: walk.turn.phase }, undefined, walk.turn.heading)
    const forward = new Vector3(0, 0, 1).transformDirection(joint('pelvis').parent!.matrixWorld)
    return sides.map((side, index) => {
      const [hip, knee, ankle] = [place(joint(`${side}-hip`)), place(joint(`${side}-knee`)), place(joint(`${side}-foot`))]
      // A point eight millimetres of the model ahead of the ankle. It moves when a foot turns on the floor.
      const toe = joint(`${side}-foot`).localToWorld(new Vector3(0, 0, 8))
      const length = hip.distanceTo(knee) + knee.distanceTo(ankle)
      const line = ankle.clone().sub(hip)
      const off = knee.clone().sub(hip).addScaledVector(line, -knee.clone().sub(hip).dot(line) / line.lengthSq())
      return { ankle, toe, lift: ankle.y - ankleRest[index]!, reach: hip.distanceTo(ankle) / length, knee: off.dot(forward) / length }
    })
  }
  return { mascot, joint, show, cadence: meshCadence(mascot.strideLength) }
}

type Shown = Awaited<ReturnType<typeof standModel>>['show'] extends (...args: never[]) => infer Result ? Result : never
type Measure = { slide: number, toeSlide: number, inPlace: number, airborne: number, reach: number, knee: number, sunk: number, turnJump: number, speedJump: number, steps: number }

/** Walks one lap of a set, from his first arrival at the first stop to his next, and measures it. */
async function measureLap(name: keyof typeof walkSets, frameTime: () => number): Promise<Measure> {
  const set = walkSets[name]
  const { show, cadence } = await standModel(set.start)
  let walk = startWalk(set.start)
  const measure: Measure = { slide: 0, toeSlide: 0, inPlace: 0, airborne: 0, reach: 0, knee: Infinity, sunk: 0, turnJump: 0, speedJump: 0, steps: 0 }
  // The slide of each foot since it last came down: its ankle, and the point ahead of it.
  const planted = [{ slide: 0, toe: 0 }, { slide: 0, toe: 0 }]
  let arrivals = 0, wasPausing = false, before: Shown | undefined, elapsed = 0, lastRate = 0
  while (arrivals < 2 && elapsed < 120) {
    const delta = frameTime()
    const next = stepWalk(walk, { delta, route: set.route, pauses: set.pauses, cadence })
    const feet = show(next, delta)
    elapsed += delta
    const pausing = next.stroll.activity._tag === 'Pausing'
    if (pausing && !wasPausing && next.stroll.activity._tag === 'Pausing' && next.stroll.activity.waypoint === 0) arrivals++
    wasPausing = pausing
    if (arrivals >= 1 && before) {
      const band = height * 0.01
      feet.forEach((foot, index) => {
        const last = before![index]!
        if (foot.lift < band && last.lift < band) {
          planted[index]!.slide += Math.hypot(foot.ankle.x - last.ankle.x, foot.ankle.z - last.ankle.z)
          planted[index]!.toe += Math.hypot(foot.toe.x - last.toe.x, foot.toe.z - last.toe.z)
        }
        else if (foot.lift < band) { planted[index] = { slide: 0, toe: 0 }; measure.steps++ }
        measure.slide = Math.max(measure.slide, planted[index]!.slide)
        measure.toeSlide = Math.max(measure.toeSlide, planted[index]!.toe)
        measure.reach = Math.max(measure.reach, foot.reach)
        measure.knee = Math.min(measure.knee, foot.knee)
        measure.sunk = Math.max(measure.sunk, -foot.lift)
      })
      const speed = Math.hypot(next.stroll.position[0] - walk.stroll.position[0], next.stroll.position[1] - walk.stroll.position[1]) / delta
      if (feet.some(foot => foot.lift >= band) && speed < meshWalk.speed * 0.1) measure.inPlace += delta
      if (feet.every(foot => foot.lift >= band)) measure.airborne += delta
      const rate = (next.turn.heading - walk.turn.heading) / delta
      measure.turnJump = Math.max(measure.turnJump, Math.abs(rate - lastRate))
      measure.speedJump = Math.max(measure.speedJump, Math.abs(next.stroll.speed - walk.stroll.speed))
      lastRate = rate
    }
    else lastRate = (next.turn.heading - walk.turn.heading) / delta
    before = feet
    walk = next
  }
  assert.equal(arrivals, 2, `He must walk a whole lap of the ${name}.`)
  return measure
}

for (const name of ['lair', 'office'] as const) {
  test(`through a lap of the ${name}, a foot on the floor stays where it stands, and he steps only to cover ground`, async () => {
    const lap = await measureLap(name, () => frame)
    assert.ok(lap.steps >= 16, `A lap must take many steps, not ${lap.steps}.`)
    // The bound of the brief is two percent of his height for each step. The walk holds a quarter of that.
    assert.ok(lap.slide < height * 0.01, `A planted foot slid ${lap.slide.toFixed(3)} units in one step. One percent of his height is ${(height * 0.01).toFixed(3)}.`)
    assert.ok(lap.toeSlide < height * 0.01, `A planted foot turned on the floor: its toe moved ${lap.toeSlide.toFixed(3)} units in one step.`)
    // Before this walk he stepped in place for 2.5 seconds of a lap of the lair and 4.7 of the office, to turn at each stop.
    assert.ok(lap.inPlace < 0.3, `He stepped in place for ${lap.inPlace.toFixed(2)} s of the lap.`)
    assert.equal(lap.airborne, 0, 'One foot must be on the floor at every moment.')
    // No leg stretches past 97 percent of its bones, no knee bends backward, and no foot goes below the floor.
    assert.ok(lap.reach <= 0.9701, `A leg straightened to ${lap.reach.toFixed(4)} of its length.`)
    assert.ok(lap.knee > 0.04, `A knee came within ${lap.knee.toFixed(3)} of a leg length of bending backward.`)
    assert.ok(lap.sunk < 1e-4, `A foot went ${lap.sunk} below the floor.`)
    // His turn and his speed never jump: one frame changes his rate of turn by less than 0.2 radians a second, and his speed by less than 0.03 units a second.
    assert.ok(lap.turnJump < 0.2, `One frame changed his rate of turn by ${lap.turnJump.toFixed(3)} rad/s.`)
    assert.ok(lap.speedJump < 0.03, `One frame changed his speed by ${lap.speedJump.toFixed(4)} units/s.`)
  })
}

test('uneven frames, as on a slow device, still hold his feet to the floor', async () => {
  const random = sequence(3)
  // Frames from 4 to 50 milliseconds. The scene never draws a longer one.
  const lap = await measureLap('office', () => 0.004 + random() * 0.046)
  assert.ok(lap.slide < height * 0.02 && lap.toeSlide < height * 0.02, `A planted foot slid ${lap.slide.toFixed(3)} units, or turned ${lap.toeSlide.toFixed(3)}, in one step.`)
  assert.ok(lap.inPlace < 0.5 && lap.airborne === 0 && lap.reach <= 0.9701 && lap.knee > 0.04 && lap.sunk < 1e-4, JSON.stringify(lap))
})

test('through a stride on the floor, the skin of the foot that carries him rests on it and the other foot never goes under', async () => {
  const { mascot, show, cadence } = await standModel([0, 0])
  let skin: SkinnedMesh | undefined
  mascot.root.traverse((object) => { if (object instanceof SkinnedMesh && !skin) skin = object })
  assert.ok(skin, 'The model must have a skin.')
  const body: SkinnedMesh = skin
  const bones = body.skeleton.bones.map(bone => bone.name)
  const position = body.geometry.getAttribute('position'), skinIndex = body.geometry.getAttribute('skinIndex'), skinWeight = body.geometry.getAttribute('skinWeight')
  // The vertices that each foot joint moves most: the skin of that foot.
  const soles = sides.map((side) => {
    const bone = bones.indexOf(`${side}-foot`)
    const vertices: number[] = []
    for (let vertex = 0; vertex < position.count; vertex++) {
      for (let slot = 0; slot < 4; slot++) if (skinIndex.getComponent(vertex, slot) === bone && skinWeight.getComponent(vertex, slot) > 0.6) vertices.push(vertex)
    }
    assert.ok(vertices.length > 50, `The ${side} foot must have skin of its own.`)
    return vertices
  })
  const point = new Vector3()
  /** The lowest point of each foot's skin above the floor, in world units. */
  const lowest = () => {
    mascot.root.updateMatrixWorld(true)
    body.skeleton.update()
    return soles.map(vertices => vertices.reduce((low, vertex) => {
      body.applyBoneTransform(vertex, point.fromBufferAttribute(position, vertex))
      return Math.min(low, body.localToWorld(point).y - floor)
    }, Infinity))
  }
  // He walks to screen right at a full stride. The first second lets his feet take up the walk.
  let walk = startWalk([0, 0])
  const route = [[60, 0]] as const
  let standing: number[] | undefined, deepest = 0, floated = 0, highest = 0
  for (let step = 0; step < 240; step++) {
    walk = stepWalk(walk, { route, pauses: [600], cadence })
    const feet = show(walk, frame)
    if (step === 0) standing = lowest()
    if (step < 120 || step % 4 !== 0) continue
    const soleHeights = lowest()
    soleHeights.forEach((sole, index) => {
      // A foot on the floor lies as it does at rest: its skin is where it was while he stood.
      if (feet[index]!.lift < 1e-6) floated = Math.max(floated, Math.abs(sole - standing![index]!))
      deepest = Math.min(deepest, sole - standing![index]!)
      highest = Math.max(highest, sole)
    })
    assert.ok(Math.min(...soleHeights) < height * 0.01, 'One foot must rest on the floor in every pose of the stride.')
  }
  assert.ok(standing && Math.max(...standing.map(Math.abs)) < height * 0.01, `At rest his soles must lie on the floor, not at ${standing}.`)
  assert.ok(floated < height * 0.002, `The foot that carries him floats or sinks by ${floated.toFixed(4)} units.`)
  assert.ok(deepest > -height * 0.01, `The skin of a foot went ${(-deepest).toFixed(3)} units under the floor during a step.`)
  assert.ok(highest > height * 0.02, 'The foot in the air must lift clear of the floor.')
})
