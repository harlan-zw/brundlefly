import { defaultCameraView, resolveCameraView, resolveResponsiveCameraFraming } from '../layers/brand/shared/camera-view.ts'
import { floorRelief, floorSurface } from '../layers/brand/shared/floor-surface.ts'
import type { SetLayout } from '../layers/brand/shared/scene-set.ts'

/**
 * The snails that came along from the office experiment, as plain data, and the rules they crawl by.
 * app/cave-snails.ts draws them. This file makes no three.js object, so a test can run every rule.
 *
 * They arrive for a celebration. They stand in a loose crowd round his start point, where a phone sees them, and dance with him.
 * When it is over he walks his loop again, so each snail first hurries out of his walking area, and then crawls slowly in front of it.
 */

type Point = readonly [x: number, z: number]
type Place = readonly [x: number, y: number, z: number]

/**
 * One snail. Coordinates are world units, and times are seconds.
 * `heading` is a turn about the vertical. The snail crawls along (cos heading, -sin heading) in x and z.
 * A model with its head on +x faces that way when its `rotation.y` is `heading`.
 * `size` is its scale, and `pace` is its mean speed in units a second. `wave` is the phase of the ripple along its body.
 * `clock` and `drift` drive its wander. `hand` is the way it turns when its way is shut.
 * `refugeX` and `refugeZ` are the place outside his walking area that it hurries to when the celebration ends.
 * `detour` is the seconds it still goes its own way round a blocked way, before it seeks its refuge again.
 */
export type Snail = {
  x: number, z: number, heading: number, size: number, pace: number, wave: number, clock: number, drift: number, hand: 1 | -1
  refugeX: number, refugeZ: number, detour: number
}

/**
 * `Gathered`: the snails stand in their crowd round his start point, while he stands there. They wait for the music, and dance to it.
 * `Free`: he has walked off, after the celebration or without one. They hurry out of his walking area and then crawl. It lasts for good.
 */
export type HerdPhase = 'Gathered' | 'Free'
export type Herd = { snails: Snail[], phase: HerdPhase }

/** A round patch of floor that no snail's middle enters. */
export type Keepout = { x: number, z: number, radius: number }

/**
 * The floor the snails live on.
 * `bounds` holds a snail's middle. `eggs` are the egg sacs and the middle of each egg cluster.
 * `beat` is a convex outline, anticlockwise, round every place he walks. His walking area is the floor within `reach` of it.
 * A free snail outside his walking area never enters it, so he passes it at `clearance` or more.
 * `start` is where he starts and dances. `firstStop` is where he walks first when the celebration ends.
 */
export type SnailGround = {
  bounds: { minX: number, maxX: number, minZ: number, maxZ: number }
  eggs: readonly Keepout[]
  beat: readonly Point[]
  reach: number
  clearance: number
  start: Point
  firstStop: Point
}

export type SnailStep = {
  delta: number
  /** Where he stands now. */
  avoid: Point
}
/** `dance` is the beats since the music's chorus hit, while the cave celebrates. */
export type HerdStep = SnailStep & { dance: number | undefined }

/** A camera as the scene places it: where it stands, the point it looks at, its vertical field of view in degrees, and the picture's width over its height. */
export type View = { position: Place, target: Place, fieldOfView: number, aspect: number }

/** The pictures the crowd is placed for: a portrait phone as the audience holds it, and a wide screen. */
export const phoneAspect = 390 / 844
export const wideAspect = 16 / 9

// At the default zoom a wide picture shows the floor to z = 3 at its bottom edge, and a phone to z = 2.1.
// A snail's middle keeps to z = 2.6 or less, so a wide picture shows its whole body clear of that edge.
// From the camera, the left egg sacs hide the floor left of x = -2.4. Behind them, his beat leaves only a narrow strip left of x = -1.9.
const bounds = { minX: -1.9, maxX: 3.6, minZ: -1.8, maxZ: 2.6 }
// The half length of the largest snail. Every egg keep-out grows by this much, so no part of a snail enters a sac.
const body = 0.22
// How far his body strays outside the outline of his stops as he curves between them. The walk simulation measures 0.05.
const overshoot = 0.1
// The sacs of one cluster, as eggs.ts builds them. Update both files together.
// A sac is its model at twice size. Its anchor strands meet the floor at 1.35 of the model's radius, the farthest the sac reaches.
const sacHeights = [1.29, 0.79, 1.06, 0.59]
const clusterCore = 1.1

// The crowd. He dances at his start point, and his feet stay well inside `partyNear` of it.
const partyNear = 1.05
const partyFar = 2.4
// He walks to his first stop at once when the celebration ends. No snail stands this near that path.
const firstLegClear = 0.75
// No snail stands farther from the camera than this behind him, where his body hides it.
const behind = 0.2
// Most of the crowd stands where a phone shows it, this far inside the edge of its picture. All of it stands well inside a wide picture.
const phoneShare = 0.75
const phoneInset = 0.15
const wideInset = 0.25
const startSpacing = 0.5
const refugeSpacing = 0.3
const refugeAhead = 1.3
const sideways = 2.5
// A snail starts, and a refuge lies, at least this far inside its floor, so it has room to turn.
const startRoom = 0.15
// The middle of a snail's body above the floor, for what a camera sees.
const bodyHeight = 0.1
// He has left his start point when he stands this far from it.
const leaveDistance = 0.25

// They begin to turn this far from an edge. It is less than half the depth of the narrowest strip they live on, so two edges never pin a snail.
const look = 0.25
// The fastest turn of a snail, in radians a second, and of a snail in a hurry.
const steer = 1.2
const hurrySteer = 2.5
// A snail in his walking area hurries out at this speed, added to its pace. It is a comic rush for a snail, and half his walking speed.
const hurry = 0.3
// How long a blocked snail goes its own way before it seeks its refuge again.
const detourTime = 0.7
// Two snails nearer than this turn apart. A snail never crawls closer to another one within `touch`, so they do not stack.
const spacing = 0.45
const touch = 0.2
// The ripple along a snail's body, in radians a second at a mean pace. A hurrying snail ripples up to three times as fast.
const ripple = 2.2
const meanPace = 0.055

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
/** The short way round to a turn, from -π to π. */
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
/** How hard an edge pushes a snail away: nothing at `range` or farther, and 1 at the edge. */
const shy = (gap: number, range: number) => gap >= range ? 0 : (1 - Math.max(0, gap) / range) ** 2

/** A seeded sequence of numbers from 0 to 1, so a seed gives the same snails each time. */
function sequence(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), state | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** The convex outline round some points, anticlockwise in x and z. */
function convexHull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const turn = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const chain = (list: readonly Point[]) => list.reduce<Point[]>((hull, point) => {
    while (hull.length >= 2 && turn(hull[hull.length - 2]!, hull[hull.length - 1]!, point) <= 0) hull.pop()
    hull.push(point)
    return hull
  }, [])
  const lower = chain(sorted)
  const upper = chain(sorted.reverse())
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/** The distance from a point to a segment. */
function segmentDistance(x: number, z: number, from: Point, to: Point) {
  const ex = to[0] - from[0], ez = to[1] - from[1]
  const share = clamp(((x - from[0]) * ex + (z - from[1]) * ez) / (ex * ex + ez * ez || 1), 0, 1)
  return Math.hypot(x - from[0] - share * ex, z - from[1] - share * ez)
}

/** How far a point lies outside a convex outline that runs anticlockwise. Zero inside. */
function outsideOf(corners: readonly Point[], x: number, z: number) {
  let nearest = Infinity
  let inside = true
  for (let index = 0; index < corners.length; index++) {
    const from = corners[index]!
    const to = corners[(index + 1) % corners.length]!
    if ((to[0] - from[0]) * (z - from[1]) - (to[1] - from[1]) * (x - from[0]) < 0) inside = false
    nearest = Math.min(nearest, segmentDistance(x, z, from, to))
  }
  return inside ? 0 : nearest
}

/** True when a point lies in his walking area. */
export function inWalkingArea(ground: SnailGround, x: number, z: number) {
  return outsideOf(ground.beat, x, z) < ground.reach
}

/** True when a snail's middle may stand at a point on the floor and out of the eggs, with `margin` to spare from every edge. */
function onFloor(ground: SnailGround, x: number, z: number, margin: number) {
  const { minX, maxX, minZ, maxZ } = ground.bounds
  if (x < minX + margin || x > maxX - margin || z < minZ + margin || z > maxZ - margin) return false
  for (let index = 0; index < ground.eggs.length; index++) {
    const egg = ground.eggs[index]!
    if (Math.hypot(x - egg.x, z - egg.z) < egg.radius + margin) return false
  }
  return true
}

/** True when a free snail may stand at a point: on the floor, out of the eggs, and out of his walking area, with `margin` to spare. */
function fits(ground: SnailGround, x: number, z: number, margin: number) {
  return onFloor(ground, x, z, margin) && outsideOf(ground.beat, x, z) >= ground.reach + margin
}

/** True when a step takes a snail closer to another snail that is already within `touch` of it. */
function crowds(snails: readonly Snail[], snail: Snail, x: number, z: number) {
  for (let index = 0; index < snails.length; index++) {
    const other = snails[index]!
    if (other === snail) continue
    const next = Math.hypot(x - other.x, z - other.z)
    if (next < touch && next < Math.hypot(snail.x - other.x, snail.z - other.z)) return true
  }
  return false
}

/**
 * The cave floor for the snails. `eggs` are the middles of the egg clusters.
 * `clearance` is the least distance between him and a free snail. He walks about ten times faster than a snail crawls, so a snail cannot step aside in time.
 * So a free snail keeps off every place he walks: his loops, his start, the way out, and the legs between them.
 */
export function snailGround(layout: Pick<SetLayout, 'mascot' | 'exit' | 'walk' | 'meshWalk'>, eggs: readonly Point[], clearance = 0.9): SnailGround {
  const keepouts = eggs.flatMap(([x, z], cluster) => {
    // eggs.ts spreads the sacs of the first cluster to the left, and the sacs of every other cluster to the right.
    const side = cluster === 0 ? -1 : 1
    const sacs = sacHeights.map((height, index) => ({
      x: x + side * (index % 2 * 1.3 + Math.floor(index / 2) * 0.44),
      z: z + (index - 1.5) * 0.8,
      radius: (0.23 + height * 0.15) * 2 * 1.35 + body,
    }))
    return [{ x, z, radius: clusterCore + body }, ...sacs]
  })
  return {
    bounds,
    eggs: keepouts,
    beat: convexHull([...layout.meshWalk, ...layout.walk, layout.mascot, layout.exit]),
    reach: clearance + overshoot,
    clearance,
    start: layout.mascot,
    firstStop: layout.meshWalk[0] ?? layout.mascot,
  }
}

/** The camera of a set at rest, for a picture of `aspect`, at `zoom`: the scene's own framing, with no turn by the visitor. */
export function restingView(camera: SetLayout['camera'], aspect: number, zoom: number): View {
  const { framing, fieldOfView } = resolveResponsiveCameraFraming(camera.desktop, camera.portrait, aspect)
  const { position, target } = resolveCameraView(defaultCameraView, framing, camera.target, zoom)
  return { position, target, fieldOfView, aspect }
}

/** True when a view shows a point at least `inset` inside the edge of its picture. `inset` is a share of the picture's half width and half height. */
export function sees(view: View, x: number, y: number, z: number, inset: number) {
  const [px, py, pz] = view.position
  const [tx, ty, tz] = view.target
  const length = Math.hypot(tx - px, ty - py, tz - pz)
  const fx = (tx - px) / length, fy = (ty - py) / length, fz = (tz - pz) / length
  // The camera stands upright, so its right is level: forward × up.
  const side = Math.hypot(fx, fz)
  const rx = -fz / side, rz = fx / side
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy
  const dx = x - px, dy = y - py, dz = z - pz
  const depth = dx * fx + dy * fy + dz * fz
  if (depth <= 0.1) return false
  const half = Math.tan(view.fieldOfView * Math.PI / 360) * depth
  return Math.abs((dx * rx + dz * rz) / (half * view.aspect)) <= 1 - inset && Math.abs((dx * ux + dy * uy + dz * uz) / half) <= 1 - inset
}

/** How many snails a view shows, at least `inset` inside the edge of its picture. It looks at the middle of each snail's body. */
export function countSeen(snails: readonly Snail[], view: View, inset: number) {
  return snails.filter(({ x, z }) => sees(view, x, floorHeight(x, z) + bodyHeight, z, inset)).length
}

/** True when a straight crawl between two points stays on the floor and out of the eggs. */
function clearPath(ground: SnailGround, fromX: number, fromZ: number, toX: number, toZ: number) {
  const steps = Math.ceil(Math.hypot(toX - fromX, toZ - fromZ) / 0.05)
  for (let index = 1; index <= steps; index++) {
    const share = index / steps
    if (!onFloor(ground, fromX + (toX - fromX) * share, fromZ + (toZ - fromZ) * share, 0)) return false
  }
  return true
}

/**
 * Snails in a loose crowd round his start point, the same for the same seed, and the refuge of each one outside his walking area.
 * At least three quarters of them stand where `phone` shows them, and every one stands well inside the picture of `wide`.
 * None stands behind him, near the path to his first stop, or nearer to him than `partyNear`. Each faces him, side on to the camera.
 * Throws if the floor has no room for them, which only a broken layout causes.
 */
export function gatherSnails(ground: SnailGround, { count, seed, phone, wide }: { count: number, seed: number, phone: View, wide: View }): Herd {
  const random = sequence(seed)
  const [startX, startZ] = ground.start
  // Every refuge candidate: a free place, a little inside the floor.
  const refuges: Point[] = []
  // Refuges lie in front of him, where the free floor is one connected strip. Behind him only narrow dead ends are left.
  for (let x = bounds.minX; x <= bounds.maxX; x += 0.15) {
    for (let z = startZ + refugeAhead; z <= bounds.maxZ; z += 0.15) if (fits(ground, x, z, startRoom)) refuges.push([x, z])
  }
  const snails: Snail[] = []
  const seenByPhone = Math.ceil(count * phoneShare)
  let apart = startSpacing
  for (let tries = 1; snails.length < count; tries++) {
    if (tries > 40000) throw new Error(`The cave floor has room for ${snails.length} snails in the crowd, not ${count}.`)
    // A crowded floor lets them stand closer together.
    if (tries % 400 === 0) apart *= 0.9
    const angle = (random() * 2 - 1) * 1.9
    const distance = partyNear + (partyFar - partyNear) * random()
    const x = startX + Math.sin(angle) * distance
    const z = startZ + Math.cos(angle) * distance
    if (z < startZ - behind || !onFloor(ground, x, z, startRoom)) continue
    if (segmentDistance(x, z, ground.start, ground.firstStop) < firstLegClear) continue
    if (snails.some(other => Math.hypot(x - other.x, z - other.z) < apart)) continue
    const middle = floorHeight(x, z) + bodyHeight
    if (!sees(wide, x, middle, z, wideInset) || (snails.length < seenByPhone && !sees(phone, x, middle, z, phoneInset))) continue
    // A snail in his walking area needs a refuge that it can crawl to in a straight line.
    if (!fits(ground, x, z, 0) && !refuges.some(([rx, rz]) => clearPath(ground, x, z, rx, rz))) continue
    // It faces him, turned toward side on, so the camera sees its shell from the side.
    const toward = Math.atan2(-(startZ - z), startX - x)
    const sideOn = x < startX ? 0 : Math.PI
    snails.push({ x, z, heading: wrap(sideOn + clamp(wrap(toward - sideOn), -0.6, 0.6) + (random() - 0.5) * 0.3),
      size: 0.22 + random() * 0.14, pace: 0.03 + random() * 0.05, wave: random() * Math.PI * 2, clock: random() * 100, drift: random(),
      hand: random() < 0.5 ? -1 : 1, refugeX: x, refugeZ: z, detour: 0 })
  }
  assignRefuges(ground, snails, refuges)
  return { snails, phase: 'Gathered' }
}

/**
 * Gives each snail in his walking area its own refuge. The nearest snail and refuge pair goes first, so most snails take a refuge straight ahead.
 * A sideways crawl counts `sideways` times its length here, because a snail that crosses in front of him meets him on his loop.
 * Refuges keep `refugeSpacing` apart. A snail left without one shares the nearest it can reach.
 */
function assignRefuges(ground: SnailGround, snails: Snail[], refuges: readonly Point[]) {
  const options = snails.filter(snail => !fits(ground, snail.x, snail.z, 0)).map(snail => ({ snail,
    reachable: refuges.filter(([rx, rz]) => clearPath(ground, snail.x, snail.z, rx, rz)).map(([rx, rz]) => ({ x: rx, z: rz, distance: Math.hypot((rx - snail.x) * sideways, rz - snail.z) })) }))
  const taken: Point[] = []
  const free = (x: number, z: number) => taken.every(([tx, tz]) => Math.hypot(x - tx, z - tz) >= refugeSpacing)
  let waiting = options
  while (waiting.length > 0) {
    let best: { option: typeof options[number], x: number, z: number, distance: number } | undefined
    for (const option of waiting) {
      for (const refuge of option.reachable) if (refuge.distance < (best?.distance ?? Infinity) && free(refuge.x, refuge.z)) best = { option, ...refuge }
    }
    if (!best) break
    best.option.snail.refugeX = best.x
    best.option.snail.refugeZ = best.z
    taken.push([best.x, best.z])
    const chosen = best.option
    waiting = waiting.filter(option => option !== chosen)
  }
  for (const { snail, reachable } of waiting) {
    const nearest = reachable.reduce((near, refuge) => refuge.distance < near.distance ? refuge : near)
    snail.refugeX = nearest.x
    snail.refugeZ = nearest.z
  }
}

/**
 * Moves the herd one frame, in place, and allocates nothing.
 * While `dance` is set, every snail dances where it stands.
 * The crowd holds while he stands at his start point: before the music, through the celebration, and through a frame that loses the beat.
 * When he walks off, they are free for good. His loop passes near his start point, so a later visit does not stop them.
 */
export function stepHerd(herd: Herd, ground: SnailGround, step: HerdStep) {
  if (step.dance !== undefined) return
  if (herd.phase === 'Gathered') {
    if (Math.hypot(step.avoid[0] - ground.start[0], step.avoid[1] - ground.start[1]) <= leaveDistance) return
    herd.phase = 'Free'
  }
  crawlSnails(herd.snails, ground, step)
}

/**
 * Moves every free snail one step, in place, and allocates nothing.
 * A snail in his walking area hurries straight to its refuge. It may cross his walking area, but never enters an egg or leaves its floor.
 * Any other snail crawls head first and wanders. It turns away from the eggs, the edge of its floor, his walking area, him, and the snails near it.
 * Its step never takes it into an egg, off its floor, or into his walking area. It turns where it stands instead.
 * If he comes nearer than `clearance`, a snail never crawls toward him.
 */
export function crawlSnails(snails: Snail[], ground: SnailGround, { delta, avoid }: SnailStep) {
  // A tab that wakes from the background gives a long step. A snail takes it as a short one.
  const time = Math.min(delta, 0.1)
  if (!(time > 0)) return
  const { minX, maxX, minZ, maxZ } = ground.bounds
  for (let index = 0; index < snails.length; index++) {
    const snail = snails[index]!
    const { x, z } = snail
    const hurrying = inWalkingArea(ground, x, z)
    // The edge of its floor turns it back toward the middle.
    let pushX = shy(x - minX, look) - shy(maxX - x, look)
    let pushZ = shy(z - minZ, look) - shy(maxZ - z, look)
    for (let other = 0; other < ground.eggs.length; other++) {
      const egg = ground.eggs[other]!
      const awayX = x - egg.x, awayZ = z - egg.z, distance = Math.hypot(awayX, awayZ)
      const push = shy(distance - egg.radius, look)
      if (push > 0) { pushX += awayX / distance * push; pushZ += awayZ / distance * push }
    }
    // The way off his walking area is the slope of the distance from it.
    const beatPush = hurrying ? 0 : shy(outsideOf(ground.beat, x, z) - ground.reach, look)
    if (beatPush > 0) {
      const slopeX = outsideOf(ground.beat, x + 0.01, z) - outsideOf(ground.beat, x - 0.01, z)
      const slopeZ = outsideOf(ground.beat, x, z + 0.01) - outsideOf(ground.beat, x, z - 0.01)
      const slope = Math.hypot(slopeX, slopeZ) || 1
      pushX += slopeX / slope * beatPush
      pushZ += slopeZ / slope * beatPush
    }
    // He is big and quick, so a snail turns from him early.
    const himX = x - avoid[0], himZ = z - avoid[1], fromHim = Math.hypot(himX, himZ)
    const himPush = shy(fromHim - ground.clearance, look * 3) * 1.5
    if (himPush > 0 && fromHim > 0) { pushX += himX / fromHim * himPush; pushZ += himZ / fromHim * himPush }
    // A positive turn is to its left, seen from above: its head swings toward (headZ, -headX).
    const headX = Math.cos(snail.heading), headZ = -Math.sin(snail.heading)
    let dodge = 0
    for (let other = 0; other < snails.length; other++) {
      const near = snails[other]!
      if (near === snail) continue
      const toX = near.x - x, toZ = near.z - z, apart = Math.hypot(toX, toZ)
      const push = shy(apart, spacing)
      if (push === 0 || apart === 0) continue
      pushX -= toX / apart * push * 0.3
      pushZ -= toZ / apart * push * 0.3
      // A snail ahead makes it turn aside, away from the side the other one is on.
      // Two snails head on each turn to their own right, so they pass each other.
      if (toX * headX + toZ * headZ <= 0) continue
      const onLeft = toX * headZ - toZ * headX
      dodge += (Math.abs(onLeft) < apart * 0.05 ? -1 : -Math.sign(onLeft)) * push
    }
    // It turns toward the way it wants to go plus the pushes. A hurrying snail wants its refuge, unless it is on a detour round a blocked way.
    // An edge dead ahead gives no side to turn to, so it turns its own way.
    const seeking = hurrying && snail.detour <= 0
    const refuge = Math.hypot(snail.refugeX - x, snail.refugeZ - z) || 1
    const wantX = seeking ? (snail.refugeX - x) / refuge : headX
    const wantZ = seeking ? (snail.refugeZ - z) / refuge : headZ
    let turn = wrap(Math.atan2(-(wantZ + pushZ * 3), wantX + pushX * 3) - snail.heading)
    if (Math.abs(turn) > 2.8) turn = snail.hand * Math.abs(turn)
    const fastest = hurrying ? hurrySteer : steer
    const steering = clamp(turn * 2 + dodge * steer * 1.5, -fastest, fastest)
    snail.clock += time
    snail.detour = Math.max(0, snail.detour - time)
    const wander = hurrying ? 0 : 0.3 * Math.sin(snail.clock * 0.23 + snail.drift * 6.28) + 0.2 * Math.sin(snail.clock * 0.57 + snail.drift * 19)
    const before = snail.heading
    snail.heading = wrap(before + (steering + wander) * time)
    // It surges as its body stretches, and slows in a sharp turn.
    const pace = hurrying ? snail.pace + hurry : snail.pace
    snail.wave = (snail.wave + time * ripple * Math.min(3, pace / meanPace)) % (Math.PI * 2)
    const speed = pace * (1 + 0.3 * Math.cos(snail.wave)) * (1 - 0.5 * Math.abs(steering) / fastest)
    const nextX = x + Math.cos(snail.heading) * speed * time
    const nextZ = z - Math.sin(snail.heading) * speed * time
    const nextFromHim = Math.hypot(nextX - avoid[0], nextZ - avoid[1])
    const allowed = hurrying ? onFloor(ground, nextX, nextZ, 0) : fits(ground, nextX, nextZ, 0)
    if (allowed && (nextFromHim >= ground.clearance || nextFromHim >= fromHim) && !crowds(snails, snail, nextX, nextZ)) {
      snail.x = nextX
      snail.z = nextZ
    }
    else {
      // Its way is shut. It turns its own way where it stands, and goes on for a moment the way it then faces, so it does not turn back into the block.
      snail.heading = wrap(before + snail.hand * fastest * time)
      snail.detour = detourTime
    }
  }
}

const cellWidth = floorSurface.width / floorSurface.columns
const cellDepth = floorSurface.depth / floorSurface.rows
const west = -floorSurface.width / 2
const north = floorSurface.z - floorSurface.depth / 2

/**
 * The height of the drawn cave floor at a point. It follows the floor mesh's own triangles, which leave the smooth relief by a few centimetres near the walls.
 * It is not `floorLevel` of the set layout. That is the level he stands on, 3.5 cm above flat ground.
 */
export function floorHeight(x: number, z: number) {
  const column = clamp(Math.floor((x - west) / cellWidth), 0, floorSurface.columns - 1)
  const row = clamp(Math.floor((z - north) / cellDepth), 0, floorSurface.rows - 1)
  const left = west + column * cellWidth, near = north + row * cellDepth
  const across = (x - left) / cellWidth, along = (z - near) / cellDepth
  // PlaneGeometry cuts each cell along the diagonal from (column, row + 1) to (column + 1, row).
  const a = floorRelief(left, near), b = floorRelief(left, near + cellDepth)
  const c = floorRelief(left + cellWidth, near + cellDepth), d = floorRelief(left + cellWidth, near)
  const relief = across + along <= 1 ? a + (d - a) * across + (b - a) * along : c + (b - c) * (1 - across) + (d - c) * (1 - along)
  return floorSurface.level + relief
}
