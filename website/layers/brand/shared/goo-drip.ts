import { BufferAttribute, BufferGeometry, Group, Mesh, MeshPhysicalMaterial, SphereGeometry, Vector3 } from 'three'
import type { Material } from 'three'

/** One hanging drip in local units. `period` is seconds per drop at flow 1. */
export type DripSpec = { reach: number, drop: number, thread: number, bead: number, period: number, phase: number }
/** `beading` swells small beads along a thinning thread, as stretched mucus does. */
export type Strand = { length: number, drop: number, thread: number, pinch: number, beading: number }
export type FreeDrop =
  | { _tag: 'None' }
  | { _tag: 'Falling', radius: number, distance: number, stretch: number, age: number }
  | { _tag: 'Spreading', radius: number, distance: number, spread: number, age: number }
export type DripPose = { strand: Strand, free: FreeDrop }
/** `exit` is where the strand leaves tissue. `landing` is the height of the surface below it. */
export type DripAttachment = { exit: Vector3, landing: number }

const release = 0.74
const gravity = 12
const embed = 0.07
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (from: number, to: number, value: number) => { const t = clamp01((value - from) / (to - from)); return t * t * (3 - 2 * t) }
const smoothMax = (a: number, b: number, k: number) => {
  const h = clamp01(0.5 + 0.5 * (a - b) / k)
  return b + (a - b) * h + k * h * (1 - h)
}

/** Pure drip cycle: the drop fills while its thread creeps and necks, then it snaps, falls, and spreads where it lands. */
export function dripPose(spec: DripSpec, cycle: number, fallHeight: number): DripPose {
  const u = (cycle % 1 + 1) % 1
  const stub = spec.reach * 0.3
  const seed = spec.drop * 0.4
  // A stretched thread thins. A recoiled stub thickens again.
  const thread = (length: number) => spec.thread * (1.5 - 0.8 * clamp01((length - stub) / (spec.reach - stub)))
  if (u < release) {
    const fill = u / release
    // Viscous creep accelerates as the drop gains weight.
    const length = stub + (spec.reach - stub) * fill ** 1.7
    return { strand: { length, drop: seed + (spec.drop - seed) * Math.sqrt(fill), thread: thread(length), pinch: smooth(0.8, 1, fill),
      beading: smooth(0.3, 0.95, fill) },
      free: { _tag: 'None' } }
  }
  const age = (u - release) * spec.period
  const window = (1 - release) * spec.period
  // The snapped thread springs back past its rest length and settles while a new bead fills its tip.
  const length = Math.max(stub * 0.6, stub + (spec.reach - stub) * Math.exp(-age * 6) * Math.cos(age * 15))
  // Recoil merges the beads back into the stub.
  const strand = { length, drop: spec.thread * 1.6 + (seed - spec.thread * 1.6) * smooth(0, 1, age / window), thread: thread(length), pinch: 0,
    beading: Math.exp(-age * 5) }
  const start = spec.reach - spec.drop * 1.1
  const fall = Math.max(0, fallHeight - start - spec.drop * 0.5)
  const impact = Math.sqrt(2 * fall / gravity)
  if (age < impact) return { strand, free: { _tag: 'Falling', radius: spec.drop, distance: start + 0.5 * gravity * age * age,
    stretch: 1 + 0.45 * Math.exp(-age * 7) * Math.cos(age * 26), age } }
  const landed = age - impact
  const life = 1 - smooth(0.15, 0.6, landed)
  if (life <= 0) return { strand, free: { _tag: 'None' } }
  return { strand, free: { _tag: 'Spreading', radius: spec.drop * life, distance: fallHeight, spread: 1 - Math.exp(-landed * 14), age } }
}

/** Radius along a strand. `s` runs down from the tissue exit. Negative `s` stays buried in the lip and closes in a dome. */
export function strandRadius({ length, drop, thread, pinch, beading }: Strand, bead: number, s: number) {
  if (s >= length) return 0
  const center = length - drop * 1.1
  const v = s - center
  // A pear: a round heavy base under a long taper into the thread.
  const body = drop * Math.sqrt(Math.max(0, 1 - (v / (drop * (v >= 0 ? 1.1 : 2))) ** 2))
  const neck = 1 - pinch * 0.92 * Math.exp(-(((s - (center - drop * 2.1)) / (drop * 0.8)) ** 2))
  const string = thread * (1 + 0.6 * clamp01(1 - s / length)) * neck * smooth(center + drop * 0.6, center, s)
  // A concave wet fillet where the thread leaves the lip.
  const meniscus = s <= 0 ? bead * Math.sqrt(Math.max(0, 1 - (s / embed) ** 2)) : bead * Math.exp(-s / (bead * 0.8))
  let radius = smoothMax(string, meniscus, thread)
  const neckTop = center - drop * 2.1
  for (const [at, size] of beads) {
    const place = bead * 3 + (neckTop - bead * 3) * at
    const r = thread * (1 + 2.6 * beading * size)
    if (place < bead * 3 || beading <= 0) continue
    radius = smoothMax(radius, r * Math.sqrt(Math.max(0, 1 - ((s - place) / (r * 1.3)) ** 2)), thread * 0.6)
  }
  return smoothMax(radius, body, thread * 0.8)
}

// Fractions of the free thread and relative sizes. Uneven spacing keeps beads from reading as a pattern.
const beads = [[0.22, 0.75], [0.47, 1], [0.71, 0.6]] as const
const sides = 12
const sections = [10, 30, 28] as const
const rings = sections[0] + sections[1] + sections[2] + 1

/** Clear olive slime. Thin threads read through their highlights, so the coat stays glassy. */
export function createDripMaterial() {
  const material = new MeshPhysicalMaterial({
    name: 'Brundlefly-drip-slime',
    color: '#B5B083',
    metalness: 0,
    roughness: 0.03,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    ior: 1.45,
    transmission: 0.72,
    thickness: 0.1,
    attenuationColor: '#6E5F2E',
    attenuationDistance: 0.14,
    specularIntensity: 1,
    specularColor: '#E8D4A6',
    emissive: '#0E0E07',
    // The tunnel tissue ignores fog. Its slime matches, so drips do not fade against the lip they leave.
    fog: false,
  })
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
float dripFacing = abs(dot(normal, normalize(vViewPosition)));
float dripRim = pow(1.0 - dripFacing, 2.2);
// Light gathers in the heavy lower curve of each drop, as it does behind a lens.
float dripCore = smoothstep(0.1, 0.85, -normal.y) * pow(dripFacing, 1.5);
outgoingLight += vec3(0.1, 0.12, 0.08) * dripRim + vec3(0.18, 0.16, 0.08) * dripCore;
#include <opaque_fragment>`)
  }
  material.customProgramCacheKey = () => 'brundlefly-drip-slime-v1'
  return material
}

/** Hanging threads with falling drops. The caller owns the material and moves each attachment every frame. */
export function createGooDrips(material: Material, specs: readonly DripSpec[]) {
  const root = new Group()
  root.name = 'Viscous drips'
  const index: number[] = []
  for (let ring = 0; ring < rings - 1; ring++) for (let side = 0; side < sides; side++) {
    const a = ring * sides + side, b = ring * sides + (side + 1) % sides
    index.push(a, b, a + sides, b, b + sides, a + sides)
  }
  const dropGeometry = new SphereGeometry(1, 18, 14)
  const splatGeometry = new SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2)
  const drips = specs.map(spec => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(rings * sides * 3), 3))
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(rings * sides * 3), 3))
    geometry.setIndex(index)
    const strand = new Mesh(geometry, material)
    // Vertices move every frame, so static bounds would cull a stretched thread.
    strand.frustumCulled = false
    const drop = new Mesh(dropGeometry, material)
    const splat = new Mesh(splatGeometry, material)
    root.add(strand, drop, splat)
    return { spec, geometry, drop, splat }
  })
  const depths = new Float32Array(rings)
  const tangent = new Vector3(), across = new Vector3(), around = new Vector3(), facing = new Vector3(0, 0, 1)
  let previousTime: number | undefined, clock = 0
  // A slow pendulum whose period follows the full reach, so release can recover the tip's sway.
  const sway = (spec: DripSpec, time: number) => {
    const rate = 2.2 / Math.sqrt(spec.reach + 0.3)
    return [Math.sin(time * rate + spec.phase * 6.3) * 0.055, Math.sin(time * rate * 0.73 + spec.phase * 4.1) * 0.03] as const
  }
  function shape(geometry: BufferGeometry, spec: DripSpec, strand: Strand, exit: Vector3, lean: readonly [number, number]) {
    const position = geometry.getAttribute('position') as BufferAttribute
    const normal = geometry.getAttribute('normal') as BufferAttribute
    const neckTop = Math.min(spec.bead * 3, strand.length)
    const dropTop = Math.min(strand.length, Math.max(neckTop, strand.length - strand.drop * 3.6))
    let ring = 0
    for (const [from, to, count] of [[-embed, neckTop, sections[0]], [neckTop, dropTop, sections[1]], [dropTop, strand.length, sections[2]]] as const) {
      for (let step = 0; step < count; step++) depths[ring++] = from + (to - from) * step / count
    }
    depths[ring] = strand.length
    const delta = (strand.length + embed) / 600
    for (let ring = 0; ring < rings; ring++) {
      const s = depths[ring]!
      const bend = s > 0 ? s * (0.55 + 0.45 * s / strand.length) : 0
      const slope = s > 0 ? 0.55 + 0.9 * s / strand.length : 0
      tangent.set(lean[0] * slope, -1, lean[1] * slope).normalize()
      across.crossVectors(tangent, facing).normalize()
      around.crossVectors(tangent, across)
      const radius = strandRadius(strand, spec.bead, s)
      const change = (strandRadius(strand, spec.bead, s + delta) - strandRadius(strand, spec.bead, s - delta)) / (2 * delta)
      for (let side = 0; side < sides; side++) {
        const angle = side / sides * Math.PI * 2
        const x = Math.cos(angle), y = Math.sin(angle)
        const dx = across.x * x + around.x * y, dy = across.y * x + around.y * y, dz = across.z * x + around.z * y
        const vertex = ring * sides + side
        position.setXYZ(vertex, exit.x + lean[0] * bend + dx * radius, exit.y - s + dy * radius, exit.z + lean[1] * bend + dz * radius)
        const nx = dx - change * tangent.x, ny = dy - change * tangent.y, nz = dz - change * tangent.z
        const length = Math.hypot(nx, ny, nz) || 1
        normal.setXYZ(vertex, nx / length, ny / length, nz / length)
      }
    }
    position.needsUpdate = true
    normal.needsUpdate = true
  }
  return {
    root,
    update({ time, flow, attachments }: { time: number, flow: number, attachments: readonly DripAttachment[] }) {
      const delta = previousTime === undefined ? 0 : Math.max(0, Math.min(0.1, time - previousTime))
      previousTime = time
      clock += delta * Math.max(0, flow)
      drips.forEach(({ spec, geometry, drop, splat }, index) => {
        const { exit, landing } = attachments[index]!
        const pose = dripPose(spec, clock / spec.period + spec.phase, exit.y - landing)
        shape(geometry, spec, pose.strand, exit, sway(spec, clock))
        const free = pose.free
        drop.visible = free._tag === 'Falling'
        splat.visible = free._tag === 'Spreading'
        if (free._tag === 'Falling') {
          // The drop keeps the sideways lean its thread had at the moment it snapped.
          const lean = sway(spec, clock - free.age)
          drop.position.set(exit.x + lean[0] * spec.reach, exit.y - free.distance, exit.z + lean[1] * spec.reach)
          drop.scale.set(free.radius / Math.sqrt(free.stretch), free.radius * free.stretch, free.radius / Math.sqrt(free.stretch))
        }
        if (free._tag === 'Spreading') {
          const lean = sway(spec, clock - free.age)
          splat.position.set(exit.x + lean[0] * spec.reach, landing, exit.z + lean[1] * spec.reach)
          const width = free.radius * (1.1 + free.spread * 1.7)
          splat.scale.set(width, free.radius * (0.7 - free.spread * 0.4), width)
        }
      })
    },
    dispose() {
      drips.forEach(({ geometry }) => geometry.dispose())
      dropGeometry.dispose()
      splatGeometry.dispose()
      root.clear()
    },
  }
}
