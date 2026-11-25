import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DoubleSide, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, Vector3 } from 'three'
import type { InstancedMesh } from 'three'
import { createCaveSnails } from '../app/cave-snails.ts'
import { countSeen, crawlSnails, floorHeight, gatherSnails, inWalkingArea, phoneAspect, restingView, sees, snailGround, stepHerd, wideAspect } from '../shared/cave-snails.ts'
import type { Herd, Snail, SnailGround, View } from '../shared/cave-snails.ts'
import { createFloorGeometry } from '../layers/brand/shared/floor-surface.ts'
import { sceneLayout } from '../layers/brand/shared/scene-layout.ts'
import { defaultSceneSettings } from '../layers/brand/shared/scene-settings.ts'
import { meshCadence, startWalk, stepWalk } from './walk-sim.ts'

type Point = readonly [number, number]
// The cave's layout, as lair-set.ts gives it to the scene, and the scene's numbers for the snails.
const layout = { floorLevel: -2.2, mascot: sceneLayout.mascot, exit: sceneLayout.exit, walk: sceneLayout.walk, meshWalk: sceneLayout.meshWalk,
  walkPauses: sceneLayout.walkPauses, walkHabits: sceneLayout.walkHabits, camera: sceneLayout.camera }
const count = 14
const ground = snailGround(layout, sceneLayout.eggs, 0.9)
const view = (aspect: number) => restingView(layout.camera, aspect, defaultSceneSettings.zoom)
const phone = view(phoneAspect)
const wide = view(wideAspect)
const gather = (seed: number) => gatherSnails(ground, { count, seed, phone, wide })
const frame = 1 / 30
const far: Point = [0, -40]
const cadence = meshCadence(0.71)
const snailAt = (x: number, z: number, heading: number): Snail => ({ x, z, heading, size: 0.3, pace: 0.08, wave: 0, clock: 0, drift: 0.5, hand: 1, refugeX: x, refugeZ: z, detour: 0 })
const places = (herd: Herd) => herd.snails.map(({ x, z }) => [x, z])

const segmentDistance = ([x, z]: Point, [ax, az]: Point, [bx, bz]: Point) => {
  const ex = bx - ax, ez = bz - az
  const share = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)))
  return Math.hypot(x - ax - share * ex, z - az - share * ez)
}
/** The distance from his walk loop, the way he walks it between his stops. */
const fromLoop = (point: Point) => Math.min(...sceneLayout.meshWalk.map((stop, index) => segmentDistance(point, stop, sceneLayout.meshWalk[(index + 1) % sceneLayout.meshWalk.length]!)))

/** Every way a snail can stand where no snail may ever stand: off its floor, in an egg sac, or in an egg cluster. */
function trespasses(ground: SnailGround, { x, z }: Snail) {
  const problems: string[] = []
  const { minX, maxX, minZ, maxZ } = ground.bounds
  if (x < minX || x > maxX || z < minZ || z > maxZ) problems.push('off the floor')
  if (ground.eggs.some(egg => Math.hypot(x - egg.x, z - egg.z) < egg.radius)) problems.push('in an egg sac')
  if (sceneLayout.eggs.some(([ex, ez]) => Math.hypot(x - ex, z - ez) < 1.1)) problems.push('in an egg cluster')
  return problems
}
/** The same, and also on his walk loop, where no free snail may stand once it has left. */
const trespassesFree = (ground: SnailGround, snail: Snail) => [...trespasses(ground, snail), ...fromLoop([snail.x, snail.z]) < ground.clearance ? ['on his loop'] : []]

test('the view helper sees what a three.js camera at the same framing sees', () => {
  for (const aspect of [phoneAspect, 0.45, wideAspect, 4 / 3]) {
    const resting = view(aspect)
    const camera = new PerspectiveCamera(resting.fieldOfView, aspect, 0.1, 50)
    camera.position.set(...resting.position)
    camera.lookAt(new Vector3(...resting.target))
    camera.updateMatrixWorld()
    let shown = 0
    for (let x = -4; x <= 4; x += 0.23) {
      for (let z = -2; z <= 4; z += 0.19) {
        const point = new Vector3(x, -2.1, z).project(camera)
        for (const inset of [0, 0.2]) {
          const inside = Math.abs(point.x) <= 1 - inset && Math.abs(point.y) <= 1 - inset
          // A point within a hair of the edge may round either way.
          if (Math.abs(Math.abs(point.x) - (1 - inset)) > 1e-6 && Math.abs(Math.abs(point.y) - (1 - inset)) > 1e-6) assert.equal(sees(resting, x, -2.1, z, inset), inside, `aspect ${aspect} at ${x}, ${z}`)
          shown += Number(inside)
        }
      }
    }
    assert.ok(shown > 50)
  }
})

test('at the default zoom a phone shows the floor to z = 2.14 and a wide screen to z = 3.01, as the scene frames them', () => {
  // These edges were measured with three.js cameras placed as the scene places its camera. A view at another zoom moves them by a unit or more.
  const floor = -2.235
  assert.equal(sees(phone, 0, floor, 2.05, 0), true)
  assert.equal(sees(phone, 0, floor, 2.25, 0), false)
  assert.equal(sees(wide, 0, floor, 2.95, 0), true)
  assert.equal(sees(wide, 0, floor, 3.1, 0), false)
})

test('at the celebration a portrait phone sees at least 8 of the 14 snails, and a wide screen sees them all well inside its picture', () => {
  const pictures: { name: string, at: View, inset: number, least: number }[] = [
    { name: 'a 390 by 844 phone', at: phone, inset: 0.1, least: 8 },
    { name: 'a narrower phone', at: view(0.45), inset: 0.1, least: 8 },
    { name: 'a wide screen', at: wide, inset: 0.2, least: count },
    { name: 'a 4:3 screen', at: view(4 / 3), inset: 0.2, least: count },
  ]
  for (let seed = 1; seed <= 10; seed++) {
    const herd = gather(seed)
    for (const { name, at, inset, least } of pictures) {
      const seen = countSeen(herd.snails, at, inset)
      assert.ok(seen >= least, `with seed ${seed} ${name} sees ${seen} snails`)
    }
  }
})

test('the crowd stands on its floor, out of every egg cluster, near him but not behind him, and apart', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const { snails } = gather(seed)
    assert.equal(snails.length, count)
    for (const snail of snails) {
      assert.deepEqual(trespasses(ground, snail), [], `a snail stands at ${snail.x}, ${snail.z}`)
      const fromHim = Math.hypot(snail.x - sceneLayout.mascot[0], snail.z - sceneLayout.mascot[1])
      assert.ok(fromHim >= 1 && fromHim < 2.5, `a snail stands ${fromHim.toFixed(2)} from him`)
      assert.ok(snail.z >= sceneLayout.mascot[1] - 0.2, 'a snail stands behind him, where his body hides it')
      for (const other of snails) if (other !== snail) assert.ok(Math.hypot(snail.x - other.x, snail.z - other.z) >= 0.25, 'two snails stand on top of each other')
    }
  }
})

test('the same seed gives the same crowd, and another seed gives another crowd', () => {
  assert.deepEqual(gather(11), gather(11))
  const first = gather(11).snails
  assert.ok(gather(12).snails.some((snail, index) => Math.hypot(snail.x - first[index]!.x, snail.z - first[index]!.z) > 0.1))
})

test('the crowd waits while he waits at his start point for the music, and dances where it stands', () => {
  const herd = gather(11)
  const before = places(herd)
  for (let time = 0; time < 10; time += frame) stepHerd(herd, ground, { delta: frame, avoid: sceneLayout.mascot, dance: undefined })
  for (let time = 0; time < 50; time += frame) {
    // A clock correction at the chorus can lose the beat for a frame. He still stands at his start point, so the party goes on.
    const beats = time * 110 / 60
    stepHerd(herd, ground, { delta: frame, avoid: sceneLayout.mascot, dance: Math.abs(time - 1) < frame / 2 ? undefined : beats })
  }
  assert.deepEqual(places(herd), before)
})

/**
 * The celebration, then his loop. Each frame checks that no snail is off its floor or in an egg, and that a snail that has left his walking area never comes back to his loop.
 * Returns when the last snail left his walking area, how near any came to him after the music, and how far each one got from its place in the crowd.
 */
function celebrate(seed: number, { dance, after }: { dance: boolean, after: number }) {
  const herd = gather(seed)
  const crowd = places(herd)
  if (dance) {
    for (let time = 0; time < 3; time += frame) stepHerd(herd, ground, { delta: frame, avoid: sceneLayout.mascot, dance: undefined })
    for (let time = 0; time < 50; time += frame) stepHerd(herd, ground, { delta: frame, avoid: sceneLayout.mascot, dance: time * 110 / 60 })
  }
  let walk = startWalk(sceneLayout.mascot)
  let cleared: number | undefined
  const out = herd.snails.map(() => false)
  let nearest = Infinity
  let frozen = 0
  const range = herd.snails.map(() => 0)
  for (let time = 0; time < after; time += frame) {
    walk = stepWalk(walk, { delta: frame, route: sceneLayout.meshWalk, pauses: sceneLayout.walkPauses, cadence })
    const him = walk.stroll.position
    const before = places(herd)
    stepHerd(herd, ground, { delta: frame, avoid: him, dance: undefined })
    // His loop passes his start point. The snails must not take that for another wait.
    if (cleared !== undefined && Math.hypot(him[0] - sceneLayout.mascot[0], him[1] - sceneLayout.mascot[1]) < 0.25) frozen += Number(JSON.stringify(places(herd)) === JSON.stringify(before))
    herd.snails.forEach((snail, index) => {
      out[index] ||= !inWalkingArea(ground, snail.x, snail.z)
      const problems = out[index] ? trespassesFree(ground, snail) : trespasses(ground, snail)
      if (problems.length) assert.fail(`with seed ${seed} at ${time.toFixed(1)} s a snail at ${snail.x.toFixed(3)}, ${snail.z.toFixed(3)} is ${problems.join(', ')}`)
      nearest = Math.min(nearest, Math.hypot(snail.x - him[0], snail.z - him[1]))
      range[index] = Math.max(range[index]!, Math.hypot(snail.x - crowd[index]![0]!, snail.z - crowd[index]![1]!))
    })
    if (cleared === undefined && out.every(Boolean)) cleared = time
  }
  return { cleared, nearest, range, frozen }
}

test('after the dance every snail leaves his walking area within 30 s, never meets him, and stays out', () => {
  // Seed 11 is the crowd the scene shows.
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 11]) {
    const { cleared, nearest, frozen } = celebrate(seed, { dance: true, after: 90 })
    assert.ok(cleared !== undefined && cleared < 30, `with seed ${seed} the last snail left his loop after ${cleared?.toFixed(1)} s`)
    // His feet stay well inside this.
    assert.ok(nearest > 0.6, `with seed ${seed} a snail came ${nearest.toFixed(2)} from him`)
    assert.equal(frozen, 0, 'the snails stop when he passes his start point')
  }
})

test('if he walks off without a celebration, the crowd clears his walking area the same way', () => {
  const { cleared, nearest } = celebrate(11, { dance: false, after: 60 })
  assert.ok(cleared !== undefined && cleared < 30, `the last snail left his loop after ${cleared?.toFixed(1)} s`)
  assert.ok(nearest > 0.6, `a snail came ${nearest.toFixed(2)} from him`)
})

test('in ten minutes after the celebration no snail enters an egg cluster, leaves its floor, comes back to his loop, or stacks on another, and every snail travels', () => {
  const { range } = celebrate(11, { dance: true, after: 600 })
  // A snail that only turns on the spot, or jitters at an edge, stays near its place in the crowd.
  for (const reach of range) assert.ok(reach > 0.5, `a snail never got farther than ${reach.toFixed(2)} from its place in the crowd`)
  const herd = gather(11)
  stepHerd(herd, ground, { delta: frame, avoid: far, dance: undefined })
  let closest = Infinity
  for (let time = 0; time < 300; time += frame) {
    stepHerd(herd, ground, { delta: frame, avoid: far, dance: undefined })
    for (const snail of herd.snails) for (const other of herd.snails) if (other !== snail) closest = Math.min(closest, Math.hypot(snail.x - other.x, snail.z - other.z))
  }
  assert.ok(closest > 0.19, `two snails came ${closest.toFixed(3)} apart`)
})

test('a free snail that crawls straight at an egg sac, the front edge, the right edge, or his loop turns away and keeps crawling', () => {
  // The middle of the left egg cluster is the egg keep-out nearest the snails' floor.
  const [eggX, eggZ] = sceneLayout.eggs[0]
  const cases: { name: string, x: number, z: number, heading: number }[] = [
    { name: 'the left eggs', x: -1.2, z: 2.3, heading: Math.atan2(-(eggZ - 2.3), eggX + 1.2) },
    { name: 'the front edge', x: 0.5, z: 2.45, heading: -Math.PI / 2 },
    { name: 'the right edge', x: 3.3, z: 2.2, heading: 0 },
    { name: 'his loop', x: 0.5, z: 2.1, heading: Math.PI / 2 },
  ]
  for (const { name, x, z, heading } of cases) {
    const snail = snailAt(x, z, heading)
    assert.deepEqual(trespassesFree(ground, snail), [], `the case for ${name} starts on the floor`)
    let reach = 0
    for (let time = 0; time < 60; time += frame) {
      crawlSnails([snail], ground, { delta: frame, avoid: far })
      assert.deepEqual(trespassesFree(ground, snail), [], `a snail aimed at ${name}`)
      reach = Math.max(reach, Math.hypot(snail.x - x, snail.z - z))
    }
    assert.ok(reach > 0.5, `a snail aimed at ${name} stalls`)
  }
})

test('off his beat, a snail that crawls at him turns away before it comes near him', () => {
  // He stands in the snails' strip of floor, ahead of the snail.
  const him: Point = [1.3, 2.2]
  const snail = snailAt(-0.5, 2.2, 0)
  let nearest = Infinity
  for (let time = 0; time < 60; time += frame) {
    crawlSnails([snail], ground, { delta: frame, avoid: him })
    nearest = Math.min(nearest, Math.hypot(snail.x - him[0], snail.z - him[1]))
  }
  assert.ok(nearest >= ground.clearance, `the snail came ${nearest.toFixed(3)} from him`)
})

test('a snail that he comes too near never crawls closer to him, and leaves', () => {
  const him: Point = [1.1, 2.2]
  const snail = snailAt(0.4, 2.2, 0)
  let distance = Math.hypot(snail.x - him[0], snail.z - him[1])
  let left = false
  for (let time = 0; time < 30; time += frame) {
    crawlSnails([snail], ground, { delta: frame, avoid: him })
    const next = Math.hypot(snail.x - him[0], snail.z - him[1])
    if (distance < ground.clearance) assert.ok(next >= distance - 1e-9, `the snail crawled from ${distance.toFixed(4)} to ${next.toFixed(4)} from him`)
    left ||= next >= ground.clearance
    distance = next
  }
  assert.ok(left, `the snail stays ${distance.toFixed(3)} from him`)
})

test('two snails that crawl head on turn apart instead of stacking', () => {
  const left = snailAt(0.2, 2.2, 0)
  const right = snailAt(1.2, 2.2, Math.PI)
  let nearest = Infinity
  for (let time = 0; time < 30; time += frame) {
    crawlSnails([left, right], ground, { delta: frame, avoid: far })
    nearest = Math.min(nearest, Math.hypot(left.x - right.x, left.z - right.z))
  }
  assert.ok(nearest > 0.19, `the snails came ${nearest.toFixed(3)} apart`)
  assert.ok(Math.hypot(left.x - right.x, left.z - right.z) > 0.5, 'the snails stay together after they meet')
})

test('the floor height follows the drawn floor mesh, near the walls too', () => {
  const floor = new Mesh(createFloorGeometry(), new MeshBasicMaterial({ side: DoubleSide }))
  floor.updateMatrixWorld()
  const ray = new Raycaster()
  let worst = 0
  for (let x = -4.9; x <= 4.9; x += 0.137) {
    for (let z = -2.4; z <= 3.4; z += 0.161) {
      ray.set(new Vector3(x, 5, z), new Vector3(0, -1, 0))
      const hit = ray.intersectObject(floor)[0]!
      worst = Math.max(worst, Math.abs(hit.point.y - floorHeight(x, z)))
    }
  }
  assert.ok(worst < 1e-4, `the height leaves the mesh by ${worst}`)
  floor.geometry.dispose()
})

/**
 * Each snail as the drawn mesh holds it: its place, the way its head points, and its length.
 * `pitch` is how much higher its head sits above the floor than its tail. `roll` is the same for its left and right sides. Both are zero on a body that lies along the floor.
 */
function drawn(mesh: InstancedMesh) {
  const matrix = new Matrix4()
  const above = (x: number, y: number, z: number) => {
    const point = new Vector3(x, y, z).applyMatrix4(matrix)
    return point.y - floorHeight(point.x, point.z)
  }
  return Array.from({ length: mesh.count }, (_, index) => {
    mesh.getMatrixAt(index, matrix)
    const e = matrix.elements
    return { x: e[12]!, y: e[13]!, z: e[14]!, headX: e[0]!, headZ: e[2]!, length: Math.hypot(e[0]!, e[1]!, e[2]!), matrix: [...e],
      pitch: above(0.55, 0, 0) - above(-0.55, 0, 0), roll: above(0, 0, 0.2) - above(0, 0, -0.2) }
  })
}

test('a drawn snail crawls head first, lies along the floor, and stretches a little as it goes', () => {
  const snails = createCaveSnails(layout)
  const mesh = snails.group.children[0] as InstancedMesh
  const lengths = drawn(mesh).map(({ length }) => [length, length])
  const moved = new Set<number>()
  // He walks off without a celebration, so the snails leave their crowd.
  for (let step = 0; step < 300; step++) {
    const before = drawn(mesh)
    snails.update({ delta: frame, still: false, avoid: sceneLayout.meshWalk[2] })
    drawn(mesh).forEach((after, index) => {
      const { x, z } = before[index]!
      const distance = Math.hypot(after.x - x, after.z - z)
      if (distance > 1e-4) {
        moved.add(index)
        const ahead = Math.hypot(after.headX, after.headZ)
        const along = ((after.x - x) * after.headX + (after.z - z) * after.headZ) / (distance * ahead)
        assert.ok(along > 0.99, `a snail crawls at ${Math.acos(along).toFixed(2)} radians from where its head points`)
      }
      const lift = after.y - floorHeight(after.x, after.z)
      assert.ok(lift >= 0 && lift < 0.03, `a snail sits ${lift.toFixed(3)} above the floor`)
      // The floor slopes by up to 0.09 here. A body that did not follow it would lean by about 0.03 from head to tail.
      assert.ok(Math.abs(after.pitch) < 0.004 && Math.abs(after.roll) < 0.004, `a snail leans off the floor by ${after.pitch.toFixed(4)} along and ${after.roll.toFixed(4)} across`)
      lengths[index]![0] = Math.min(lengths[index]![0]!, after.length)
      lengths[index]![1] = Math.max(lengths[index]![1]!, after.length)
    })
  }
  assert.ok(moved.size >= count - 1, `only ${moved.size} snails moved`)
  for (const [shortest, longest] of lengths) assert.ok(longest / shortest > 1.03 && longest / shortest < 1.1, `a snail's length changes by ${(longest / shortest).toFixed(3)}`)
  snails.dispose()
})

test('a dancing snail keeps its place on the floor and bobs, wherever he stands', () => {
  const snails = createCaveSnails(layout)
  const mesh = snails.group.children[0] as InstancedMesh
  const first = drawn(mesh)
  const heights = first.map(({ y }) => [y, y])
  for (let step = 0; step < 120; step++) {
    snails.update({ delta: frame, still: false, avoid: sceneLayout.meshWalk[2], dance: step * frame * 110 / 60 })
    drawn(mesh).forEach((after, index) => {
      assert.ok(Math.hypot(after.x - first[index]!.x, after.z - first[index]!.z) < 1e-6, 'a dancing snail moves over the floor')
      heights[index]![0] = Math.min(heights[index]![0]!, after.y)
      heights[index]![1] = Math.max(heights[index]![1]!, after.y)
    })
  }
  for (const [low, high] of heights) assert.ok(high - low > 0.03, `a dancing snail rises only ${(high - low).toFixed(3)}`)
  snails.dispose()
})

test('a still snail keeps its place and its shape', () => {
  const snails = createCaveSnails(layout)
  const mesh = snails.group.children[0] as InstancedMesh
  const first = drawn(mesh).map(({ matrix }) => matrix)
  for (let step = 0; step < 600; step++) snails.update({ delta: frame, still: true, avoid: sceneLayout.meshWalk[2] })
  assert.deepEqual(drawn(mesh).map(({ matrix }) => matrix), first)
  snails.dispose()
})
