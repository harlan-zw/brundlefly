import { Group, InstancedMesh, MeshStandardMaterial, Object3D, Vector3 } from 'three'
import type { BufferGeometry } from 'three'
import { officePlan } from '@brundlefly/brand/shared/office-layout'
import type { OfficePlan } from '@brundlefly/brand/shared/office-layout'
import { creatureKinds } from '#shared/office-experiment'
import type { Creature, Tally } from '#shared/office-experiment'
import { groundAt, platformsOf } from '#shared/office-ground'
import { specimenGeometry } from './office-specimens'

/**
 * The specimens of the office experiment. Each accepted tap drops one creature from the ceiling.
 * It falls under gravity, lands on the furniture or the floor, and joins the pile. In the critical scene the test chamber draws them all in.
 */

// World units and seconds. He is about three units tall, so gravity is stronger than nine point eight.
const gravity = 13
const size = 0.26
// One layer of a pile. Bodies interleave, so a layer is thinner than a body.
const layer = 0.055
const cellSize = 0.24
/** The snails the chamber spits out in the critical scene. */
export const spitSnails = 860
/** The most bodies of one creature in the room. The oldest body leaves when a new one needs its place. */
export const bodiesPerCreature = 900
// How each creature falls and lands. `drag` slows it in the air. `bounce` is the share of its speed that a landing gives back.
const manner: Record<Creature, { weight: number, drag: number, bounce: number, tumble: number, hops: number }> = {
  snail: { weight: 1, drag: 0, bounce: 0.06, tumble: 2, hops: 0 },
  beetle: { weight: 1, drag: 0.25, bounce: 0.4, tumble: 9, hops: 0 },
  fly: { weight: 0.3, drag: 2, bounce: 0, tumble: 0, hops: 0 },
  cricket: { weight: 0.9, drag: 0.3, bounce: 0.3, tumble: 5, hops: 2 },
}

type Body = {
  kind: Creature, slot: number, seed: number
  x: number, y: number, z: number, vx: number, vy: number, vz: number
  rx: number, ry: number, rz: number, spinX: number, spinZ: number
  // `Waiting` has not left the ceiling. `Settling` is on the pile and turns upright. `Pulled` goes to the chamber from where it was.
  state: 'Waiting' | 'Falling' | 'Settling' | 'Resting' | 'Pulled' | 'Gone'
  age: number, hops: number, slides: number
  cell: number, restX: number, restZ: number, fromX: number, fromY: number, fromZ: number
}

export type RainInput = {
  run: number, tally: Tally, delta: number
  /** Reduced motion and Motion off: specimens stand on the pile at once. */
  still: boolean
  /** Where he stands. Falling specimens glance off him. */
  mascot: readonly [x: number, z: number]
  /** How far the chamber has drawn the specimens in, from 0 to 1. Nothing during the count. */
  pull: number | undefined
  /** How many of its snails the chamber has spat out, from 0 to 1. Nothing during the count. */
  spurt: number | undefined
  /** The experiment is over and the room is empty. */
  gone: boolean
}
export type RainFrame = { busy: boolean, landed: Creature | undefined }

const turnTo = (from: number, to: number, share: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * share
const smooth = (value: number) => { const share = Math.max(0, Math.min(1, value)); return share * share * (3 - 2 * share) }

export function createSpecimenRain(plan: OfficePlan = officePlan) {
  const group = new Group()
  group.name = 'Office specimens'
  const platforms = platformsOf(plan)
  const floor = plan.room.floorY
  const ceiling = plan.room.ceilingY - 0.08
  // They fall in the part of the room that the camera sees, and clear of the walls.
  const area = { minX: plan.room.minX + 0.9, maxX: plan.room.maxX - 1.1, minZ: plan.room.minZ + 0.35, maxZ: 3.4 }
  // The chamber window draws them in at its middle.
  const windowProp = plan.props.find(prop => prop._tag === 'ChamberWindow')
  const sink = windowProp ? new Vector3(windowProp.position[0], windowProp.position[1], windowProp.position[2] + 0.1) : new Vector3(...plan.cues.light)
  const layers = new Map<Creature, InstancedMesh<BufferGeometry, MeshStandardMaterial>>()
  const bodies = new Map<Creature, Body[]>()
  for (const kind of creatureKinds) {
    const mesh = new InstancedMesh(specimenGeometry(kind, false), new MeshStandardMaterial({ vertexColors: true, roughness: kind === 'beetle' ? 0.28 : 0.68, metalness: kind === 'beetle' ? 0.24 : 0.04 }), bodiesPerCreature)
    mesh.count = 0
    // The bodies fill the room, so the mesh is always in view.
    mesh.frustumCulled = false
    group.add(mesh)
    layers.set(kind, mesh)
    bodies.set(kind, [])
  }
  const pile = new Map<number, number>()
  const cellOf = (x: number, z: number) => Math.floor(x / cellSize) * 4096 + Math.floor(z / cellSize)
  const moving = new Set<Body>()
  const pose = new Object3D()
  pose.rotation.order = 'YXZ'
  const dirty = new Set<Creature>()
  const place = (body: Body, scale: number, squash = 1) => {
    pose.position.set(body.x, body.y, body.z)
    pose.rotation.set(body.rx, body.ry, body.rz)
    pose.scale.set(scale, scale * squash, scale)
    pose.updateMatrix()
    layers.get(body.kind)!.setMatrixAt(body.slot, pose.matrix)
    dirty.add(body.kind)
  }
  const surface = (x: number, z: number) => groundAt(platforms, floor, x, z)
  // A body that leaves its place gives its layer back, if it lay on top.
  const lift = (body: Body) => {
    const height = pile.get(body.cell) ?? 0
    if (height > 0) pile.set(body.cell, Math.max(0, height - layer))
  }
  const rest = (body: Body) => {
    body.cell = cellOf(body.x, body.z)
    const height = pile.get(body.cell) ?? 0
    body.y = surface(body.x, body.z) + height
    pile.set(body.cell, height + layer)
    body.vx = body.vy = body.vz = 0
    body.restX = height > 0 ? (Math.random() - 0.5) * 0.7 : 0
    body.restZ = height > 0 ? (Math.random() - 0.5) * 0.7 : 0
    body.state = 'Settling'
    body.age = 0
  }
  function add(kind: Creature, index: number, wait: number, instant: boolean) {
    const list = bodies.get(kind)!
    const slot = index % bodiesPerCreature
    const old = list[slot]
    if (old) { if (old.state === 'Resting' || old.state === 'Settling') lift(old); moving.delete(old) }
    const mesh = layers.get(kind)!
    mesh.count = Math.max(mesh.count, slot + 1)
    const { tumble, hops } = manner[kind]
    const body: Body = { kind, slot, seed: Math.random(),
      x: area.minX + Math.random() * (area.maxX - area.minX), y: ceiling, z: area.minZ + Math.random() * (area.maxZ - area.minZ),
      vx: (Math.random() - 0.5) * 0.8, vy: -Math.random() * 0.6, vz: (Math.random() - 0.5) * 0.8,
      rx: Math.random() * 6.28, ry: Math.random() * 6.28, rz: Math.random() * 6.28, spinX: (Math.random() - 0.5) * tumble, spinZ: (Math.random() - 0.5) * tumble,
      state: 'Waiting', age: -wait, hops: Math.round(Math.random() * hops), slides: 0, cell: 0, restX: 0, restZ: 0, fromX: 0, fromY: 0, fromZ: 0 }
    list[slot] = body
    if (instant) {
      rest(body)
      body.rx = body.restX; body.rz = body.restZ
      body.state = 'Resting'
      place(body, size)
    }
    else { place(body, 0); moving.add(body) }
  }
  // The chamber spits one snail out of its window, over the room and toward the viewer. It falls and lands as every specimen does.
  function spit(index: number, instant: boolean) {
    add('snail', index, 0, instant)
    if (instant) return
    const body = bodies.get('snail')![index % bodiesPerCreature]!
    body.x = sink.x + (Math.random() - 0.5) * 1.6; body.y = sink.y + (Math.random() - 0.5) * 0.7; body.z = sink.z + 0.15
    body.vx = (Math.random() - 0.5) * 9 - sink.x * 0.9; body.vy = 1.5 + Math.random() * 5.5; body.vz = 2.5 + Math.random() * 7
    body.state = 'Falling'
    body.age = 0
  }
  let run: number | undefined
  let seen: Tally = { snail: 0, beetle: 0, fly: 0, cricket: 0 }
  let pulling = false
  // The chamber has taken every specimen. The room is empty until it spits.
  let emptied = false
  let spat = 0
  function clear() {
    for (const kind of creatureKinds) { layers.get(kind)!.count = 0; bodies.get(kind)!.length = 0 }
    pile.clear(); moving.clear()
    seen = { snail: 0, beetle: 0, fly: 0, cricket: 0 }
    pulling = false
    emptied = false
    spat = 0
  }
  let idle = 0
  // One resting fly takes off, or one cricket hops. Only a body on top of its pile can leave it.
  function stir(kind: 'fly' | 'cricket') {
    const list = bodies.get(kind)!
    const body = list[Math.floor(Math.random() * list.length)]
    if (!body || body.state !== 'Resting' || Math.abs(body.y + layer - surface(body.x, body.z) - (pile.get(body.cell) ?? 0)) > 0.001) return
    lift(body)
    const angle = Math.random() * 6.28
    const speed = kind === 'fly' ? 0.9 : 1.2 + Math.random()
    body.vx = Math.cos(angle) * speed; body.vz = Math.sin(angle) * speed
    body.vy = kind === 'fly' ? 2.4 : 3 + Math.random() * 1.5
    body.ry = -angle
    body.spinX = body.spinZ = 0
    body.hops = 0; body.slides = 0
    body.state = 'Falling'; body.age = 0
    moving.add(body)
  }

  function update({ run: now, tally, delta, still, mascot, pull, spurt, gone }: RainInput): RainFrame {
    let landed: Creature | undefined
    if (run !== now || gone) {
      const first = run === undefined
      clear()
      run = now
      if (gone) { seen = { ...tally }; return { busy: false, landed } }
      // A visitor who arrives in a run sees its pile as it lies.
      if (first || still) for (const kind of creatureKinds) for (let index = Math.max(0, tally[kind] - bodiesPerCreature); index < tally[kind]; index++) add(kind, index, 0, true)
      seen = first || still ? { ...tally } : seen
    }
    for (const kind of creatureKinds) {
      const fresh = tally[kind] - seen[kind]
      if (fresh <= 0) continue
      // A long gap ends in one message. Only its last bodies fall, and the rest lie on the pile already.
      for (let index = 0; index < fresh; index++) add(kind, seen[kind] + index, Math.random() * 0.14, still || pull !== undefined || fresh - index > 60)
      seen[kind] = tally[kind]
    }
    if (pull !== undefined && pull > 0 && !emptied) {
      if (!pulling) {
        pulling = true
        for (const list of bodies.values()) for (const body of list) {
          body.fromX = body.x; body.fromY = body.y; body.fromZ = body.z
          body.state = 'Pulled'
        }
        moving.clear()
      }
      for (const list of bodies.values()) for (const body of list) {
        if (body.state !== 'Pulled') continue
        // Each body leaves in its own moment: it rises from the pile, then the chamber takes it.
        const share = smooth((pull - body.seed * 0.4) / 0.6)
        const turn = share * 9 + body.seed * 6.28
        const swing = Math.sin(share * Math.PI) * 0.55
        const up = Math.sin(Math.min(1, share * 2.4) * Math.PI / 2) * (0.5 + body.seed)
        const near = share * share
        body.x = body.fromX + (sink.x - body.fromX) * near + Math.cos(turn) * swing
        body.y = body.fromY + up * (1 - near) + (sink.y - body.fromY) * near + Math.sin(turn) * swing
        body.z = body.fromZ + (sink.z - body.fromZ) * near
        body.rx = body.restX + share * 14 * (body.seed - 0.5); body.rz = body.restZ + share * 11
        place(body, size * (1 - smooth((share - 0.75) / 0.25)))
        if (share >= 1) body.state = 'Gone'
      }
      if (pull >= 1) {
        // Every specimen is in the chamber. The layers start again from nothing, for what comes out.
        const counted = seen
        clear()
        seen = counted
        emptied = true
      }
    }
    else if (emptied && spurt !== undefined) {
      // The chamber fails. It spits snails, and only snails, whatever went in.
      for (const due = Math.floor(spurt * spitSnails); spat < due; spat++) spit(spat, still)
    }
    if (!still && (pull === undefined || emptied)) {
      // A few flies and crickets keep moving, so the pile is alive.
      idle += delta
      if (pull === undefined && idle > 0.35 && moving.size < 240) { idle = 0; stir(Math.random() < 0.6 ? 'fly' : 'cricket') }
      for (const body of moving) {
        body.age += delta
        if (body.state === 'Waiting') { if (body.age < 0) continue; body.state = 'Falling'; body.age = 0 }
        const { weight, drag, bounce } = manner[body.kind]
        if (body.state === 'Settling') {
          // It turns upright on the pile. A snail lands soft and spreads.
          const share = Math.min(1, body.age / 0.22)
          body.rx = turnTo(body.rx, body.restX, share); body.rz = turnTo(body.rz, body.restZ, share)
          place(body, size, body.kind === 'snail' ? 0.65 + 0.35 * share : 1)
          if (share >= 1) { body.state = 'Resting'; moving.delete(body) }
          continue
        }
        body.vy -= gravity * weight * delta
        const slow = Math.exp(-drag * delta)
        body.vx *= slow; body.vy *= slow; body.vz *= slow
        // A fly does not fall straight. It circles down.
        if (body.kind === 'fly') { body.vx += Math.cos(body.age * 5 + body.seed * 6.28) * 3.2 * delta; body.vz += Math.sin(body.age * 5 + body.seed * 6.28) * 3.2 * delta; body.ry = Math.atan2(-body.vz, body.vx) }
        const nextX = Math.max(area.minX, Math.min(area.maxX, body.x + body.vx * delta))
        const nextZ = Math.max(area.minZ, Math.min(area.maxZ, body.z + body.vz * delta))
        // The side of a cabinet turns it back.
        if (surface(nextX, nextZ) > body.y + 0.02) { body.vx = -body.vx * 0.4; body.vz = -body.vz * 0.4 }
        else { body.x = nextX; body.z = nextZ }
        body.y += body.vy * delta
        body.rx += body.spinX * delta; body.rz += body.spinZ * delta
        // He stands in the rain, and it glances off him.
        const awayX = body.x - mascot[0]
        const awayZ = body.z - mascot[1]
        const reach = Math.hypot(awayX, awayZ)
        if (reach < 0.8 && body.y < floor + 2.9) {
          const out = reach > 0.01 ? 0.8 / reach : 1
          body.x = mascot[0] + (reach > 0.01 ? awayX * out : 0.8); body.z = mascot[1] + awayZ * out
          body.vx += awayX * out * 1.6; body.vz += awayZ * out * 1.6
        }
        const ground = surface(body.x, body.z) + (pile.get(cellOf(body.x, body.z)) ?? 0)
        if (body.y <= ground && body.vy <= 0) {
          body.y = ground
          const impact = -body.vy
          landed ??= body.kind
          if (impact * bounce > 0.9) { body.vy = impact * bounce; body.vx *= 0.6; body.vz *= 0.6; body.spinX *= 0.5; body.spinZ *= 0.5 }
          else if (body.hops > 0) {
            body.hops--
            const angle = Math.random() * 6.28
            body.vx = Math.cos(angle) * 1.3; body.vz = Math.sin(angle) * 1.3; body.vy = 2.6 + Math.random() * 1.6
            body.ry = -angle
          }
          else {
            // A steep pile does not hold. The body slides to the lower side.
            const cell = cellOf(body.x, body.z)
            const height = pile.get(cell) ?? 0
            const here = surface(body.x, body.z)
            const lower = body.slides < 4 ? ([[cellSize, 0], [-cellSize, 0], [0, cellSize], [0, -cellSize]] as const).find(([dx, dz]) =>
              surface(body.x + dx, body.z + dz) === here && height - (pile.get(cellOf(body.x + dx, body.z + dz)) ?? 0) > layer * 2.5) : undefined
            if (lower) { body.slides++; body.vx = lower[0] * 5; body.vz = lower[1] * 5; body.vy = 1.1 }
            else rest(body)
          }
        }
        if (body.state === 'Falling') place(body, size)
      }
    }
    for (const kind of dirty) layers.get(kind)!.instanceMatrix.needsUpdate = true
    dirty.clear()
    return { busy: moving.size > 0 || (pulling && !emptied), landed }
  }
  function dispose() {
    for (const mesh of layers.values()) { mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose() }
    group.removeFromParent()
  }
  return { group, update, dispose }
}
