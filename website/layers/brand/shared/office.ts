import {
  AmbientLight, BufferGeometry, CanvasTexture, Color, DirectionalLight, Float32BufferAttribute, Group, HemisphereLight, Matrix4,
  Mesh, MeshBasicMaterial, MeshLambertMaterial, NearestFilter, PointLight, SRGBColorSpace, Vector3,
} from 'three'
import type { Material, Texture } from 'three'
import { officePlan } from './office-layout.ts'
import type { Facing, OfficePlan, OfficeProp } from './office-layout.ts'
import { markRegion, marksSize, paintOfficeMarks } from './office-marks.ts'
import type { UvRect } from './office-marks.ts'
import { defaultSceneSettings } from './scene-settings.ts'
import type { SceneSettings } from './scene-settings.ts'
import { tubeFlicker } from './office-flicker.ts'

export type OfficeTextures = { floor: Texture, wall: Texture, ceiling: Texture, desk: Texture, metal: Texture, screen: Texture, hazard: Texture, door: Texture }
export type OfficeInput = { time: number, settings: SceneSettings }

type Place = readonly [x: number, y: number, z: number]
/** A colour as linear red, green, and blue. It multiplies the texture of its surface. */
type Tone = readonly [number, number, number]
/** Every surface is one material and one draw call. All boxes of a surface share one geometry. */
type Surface = 'floor' | 'wall' | 'ceiling' | 'desk' | 'metal' | 'hazard' | 'door' | 'screen' | 'marks' | 'paint' | 'glow' | 'flicker' | 'glass'
type Batch = { positions: number[], normals: number[], uvs: number[], colours: number[], indices: number[] }
type BoxLook = { tone?: Tone, /** Darkens the foot of the side faces, as a baked floor shadow. */ ground?: number, /** World units for one repeat of the texture. Without it each face shows the whole texture. */ tile?: number }

const tone = (hex: string, gain = 1): Tone => { const colour = new Color(hex); return [colour.r * gain, colour.g * gain, colour.b * gain] }
const plain: Tone = [1, 1, 1]
const dim = (value: Tone, gain: number): Tone => [value[0] * gain, value[1] * gain, value[2] * gain]
// The brand palette. The office is painted with it and with lighter and darker steps of it.
const ink = { rust: tone('#AA604B'), bruise: tone('#69404B'), chitin: tone('#343C3B'), olive: tone('#777648'), teal: tone('#418B90'),
  cream: tone('#E8D4A6'), night: tone('#080B08'), wing: tone('#A4B5A0'), beige: tone('#C9BC98') }
const whole: UvRect = [0, 0, 1, 1]
const yaws: Record<Facing, number> = { '+z': 0, '+x': Math.PI / 2, '-z': Math.PI, '-x': -Math.PI / 2 }
const at = (position: Place, yaw = 0) => new Matrix4().makeRotationY(yaw).setPosition(...position)

/** Collects flat faces by surface. Every face has one normal, so every edge is hard, as in a game of the late 1990s. */
function createSculptor() {
  const batches = new Map<Surface, Batch>()
  const edgeA = new Vector3(), edgeB = new Vector3(), normal = new Vector3()
  const batch = (surface: Surface) => {
    const found = batches.get(surface)
    if (found) return found
    const made: Batch = { positions: [], normals: [], uvs: [], colours: [], indices: [] }
    batches.set(surface, made)
    return made
  }
  /** Corners run counter-clockwise as seen from the front. `tones` gives one colour to each corner. */
  function face(surface: Surface, frame: Matrix4, corners: readonly Place[], uvs: readonly (readonly [number, number])[], tones: readonly Tone[]) {
    const target = batch(surface)
    const first = target.positions.length / 3
    const world = corners.map(corner => new Vector3(...corner).applyMatrix4(frame))
    normal.crossVectors(edgeA.subVectors(world[1]!, world[0]!), edgeB.subVectors(world[world.length - 1]!, world[0]!)).normalize()
    world.forEach((point, index) => {
      target.positions.push(point.x, point.y, point.z)
      target.normals.push(normal.x, normal.y, normal.z)
      target.uvs.push(...uvs[index]!)
      target.colours.push(...tones[index]!)
    })
    for (let index = 2; index < world.length; index++) target.indices.push(first, first + index - 1, first + index)
  }
  /** Corners: bottom left, bottom right, top right, top left. `low` tints the two bottom corners. */
  const quad = (surface: Surface, frame: Matrix4, corners: readonly [Place, Place, Place, Place], uv: UvRect = whole, top: Tone = plain, low: Tone = top) =>
    face(surface, frame, corners, [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]], [low, low, top, top])
  /** A flat panel that faces local +z, centred on `centre`. */
  const panel = (surface: Surface, frame: Matrix4, [x, y, z]: Place, width: number, height: number, uv: UvRect = whole, top: Tone = plain, low: Tone = top) =>
    quad(surface, frame, [[x - width / 2, y - height / 2, z], [x + width / 2, y - height / 2, z], [x + width / 2, y + height / 2, z], [x - width / 2, y + height / 2, z]], uv, top, low)
  function box(surface: Surface, frame: Matrix4, [x, y, z]: Place, [width, height, depth]: Place, { tone: top = plain, ground = 1, tile }: BoxLook = {}) {
    const l = x - width / 2, r = x + width / 2, b = y - height / 2, t = y + height / 2, back = z - depth / 2, front = z + depth / 2
    const low = dim(top, ground)
    const span = (across: number, up: number): UvRect => tile ? [0, 0, across / tile, up / tile] : whole
    quad(surface, frame, [[l, b, front], [r, b, front], [r, t, front], [l, t, front]], span(width, height), top, low)
    quad(surface, frame, [[r, b, back], [l, b, back], [l, t, back], [r, t, back]], span(width, height), top, low)
    quad(surface, frame, [[r, b, front], [r, b, back], [r, t, back], [r, t, front]], span(depth, height), top, low)
    quad(surface, frame, [[l, b, back], [l, b, front], [l, t, front], [l, t, back]], span(depth, height), top, low)
    quad(surface, frame, [[l, t, front], [r, t, front], [r, t, back], [l, t, back]], span(width, depth), top)
    quad(surface, frame, [[l, b, back], [r, b, back], [r, b, front], [l, b, front]], span(width, depth), low)
  }
  /** An upright column with flat sides and a flat top. Eight sides read as round at this distance. */
  function prism(surface: Surface, frame: Matrix4, [x, y, z]: Place, radius: number, height: number, sides: number, top: Tone = plain, cap: Tone = top) {
    const rim = Array.from({ length: sides }, (_, index): readonly [number, number] => {
      const angle = (index + 0.5) / sides * Math.PI * 2
      return [x + Math.sin(angle) * radius, z + Math.cos(angle) * radius]
    })
    const b = y - height / 2, t = y + height / 2
    rim.forEach(([ax, az], index) => {
      const [bx, bz] = rim[(index + 1) % sides]!
      quad(surface, frame, [[ax, b, az], [bx, b, bz], [bx, t, bz], [ax, t, az]], whole, top, dim(top, 0.8))
    })
    face(surface, frame, rim.map(([px, pz]): Place => [px, t, pz]), rim.map(() => [0.5, 0.5] as const), rim.map(() => cap))
  }
  const build = () => new Map([...batches].map(([surface, { positions, normals, uvs, colours, indices }]) => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
    geometry.setIndex(indices)
    return [surface, geometry] as const
  }))
  return { quad, panel, box, prism, build }
}
type Sculptor = ReturnType<typeof createSculptor>
/** A prop's own frame: the origin is the middle of its box and +z is its front. */
type Stand = { frame: Matrix4, width: number, height: number, depth: number }
const standOf = (prop: OfficeProp, turn = 0): Stand => {
  const sideways = prop.facing === '+x' || prop.facing === '-x'
  return { frame: at(prop.position, yaws[prop.facing] + turn), width: prop.size[sideways ? 2 : 0], height: prop.size[1], depth: prop.size[sideways ? 0 : 2] }
}

function buildRoom({ quad, box }: Sculptor, { room, props }: OfficePlan, hole: { minX: number, maxX: number, minY: number, maxY: number } | undefined) {
  const world = new Matrix4()
  const { minX, maxX, minZ, maxZ, floorY, ceilingY } = room
  // Four units of wall show the panel texture once. The texture runs from the floor to the ceiling.
  const wall = (from: readonly [number, number], to: readonly [number, number], low: number, high: number, along: readonly [number, number]) =>
    quad('wall', world, [[from[0], low, from[1]], [to[0], low, to[1]], [to[0], high, to[1]], [from[0], high, from[1]]],
      [along[0] / 4, (low - floorY) / (ceilingY - floorY), along[1] / 4, (high - floorY) / (ceilingY - floorY)])
  quad('floor', world, [[minX, floorY, maxZ], [maxX, floorY, maxZ], [maxX, floorY, minZ], [minX, floorY, minZ]], [minX / 3, -maxZ / 3, maxX / 3, -minZ / 3])
  quad('ceiling', world, [[minX, ceilingY, minZ], [maxX, ceilingY, minZ], [maxX, ceilingY, maxZ], [minX, ceilingY, maxZ]], [minX / 2, minZ / 2, maxX / 2, maxZ / 2])
  wall([minX, maxZ], [minX, minZ], floorY, ceilingY, [-maxZ, -minZ])
  wall([maxX, minZ], [maxX, maxZ], floorY, ceilingY, [minZ, maxZ])
  wall([maxX, maxZ], [minX, maxZ], floorY, ceilingY, [-maxX, -minX])
  if (hole) {
    // The back wall leaves a hole for the window into the test chamber.
    wall([minX, minZ], [hole.minX, minZ], floorY, ceilingY, [minX, hole.minX])
    wall([hole.maxX, minZ], [maxX, minZ], floorY, ceilingY, [hole.maxX, maxX])
    wall([hole.minX, minZ], [hole.maxX, minZ], floorY, hole.minY, [hole.minX, hole.maxX])
    wall([hole.minX, minZ], [hole.maxX, minZ], hole.maxY, ceilingY, [hole.minX, hole.maxX])
  }
  else wall([minX, minZ], [maxX, minZ], floorY, ceilingY, [minX, maxX])
  // A pipe runs under the ceiling along the back wall, and a conduit drops from it in the left corner.
  box('paint', world, [(minX + maxX) / 2, ceilingY - 0.1, minZ + 0.14], [maxX - minX, 0.14, 0.14], { tone: dim(ink.rust, 0.8) })
  box('paint', world, [minX + 0.3, (floorY + ceilingY) / 2, minZ + 0.12], [0.12, ceilingY - floorY, 0.12], { tone: dim(ink.chitin, 1.4) })
  // The fittings hold the tubes. The plan says where each tube hangs and which one fails.
  for (const prop of props) {
    if (prop._tag !== 'CeilingTube') continue
    const { frame, depth } = standOf(prop)
    box('paint', frame, [0, 0.03, 0], [0.36, 0.06, depth], { tone: ink.wing })
    box(prop.lamp === 'flickering' ? 'flicker' : 'glow', frame, [0, -0.025, 0], [0.11, 0.07, depth - 0.16], { tone: dim(ink.cream, 1.7) })
  }
}

/** The test chamber behind the window: a dark room with two pylons and an emitter that hangs between them. Only its upper half shows. */
function buildChamber({ quad, box, prism }: Sculptor, { room }: OfficePlan, hole: { minX: number, maxX: number, minY: number, maxY: number }) {
  const world = new Matrix4()
  const left = hole.minX - 1.4, right = hole.maxX + 1.4, front = room.minZ, back = room.minZ - 5.5, floor = room.floorY, top = room.ceilingY + 0.5
  const dark = dim(ink.wing, 0.9), darker = dim(ink.wing, 0.55)
  const middle = (left + right) / 2
  quad('metal', world, [[left, floor, back], [right, floor, back], [right, top, back], [left, top, back]], [0, 0, (right - left) / 2, (top - floor) / 2], dark, darker)
  quad('metal', world, [[left, floor, front], [left, floor, back], [left, top, back], [left, top, front]], [0, 0, 2.75, (top - floor) / 2], dark, darker)
  quad('metal', world, [[right, floor, back], [right, floor, front], [right, top, front], [right, top, back]], [0, 0, 2.75, (top - floor) / 2], dark, darker)
  quad('metal', world, [[left, top, back], [right, top, back], [right, top, front], [left, top, front]], [0, 0, (right - left) / 2, 2.75], darker)
  quad('metal', world, [[left, floor, front], [right, floor, front], [right, floor, back], [left, floor, back]], [0, 0, (right - left) / 2, 2.75], darker)
  // A hazard band crosses the far wall at the height of the window.
  quad('hazard', world, [[left, 0.25, back + 0.02], [right, 0.25, back + 0.02], [right, 0.7, back + 0.02], [left, 0.7, back + 0.02]], [0, 0, (right - left) / 0.9, 0.5], dim(plain, 0.8))
  for (const side of [-1, 1]) {
    box('paint', world, [middle + side * 1.45, (floor + top) / 2, back + 2.3], [0.42, top - floor, 0.42], { tone: dim(ink.chitin, 1.5) })
    box('glow', world, [middle + side * 1.45, 1, back + 2.3], [0.5, 0.16, 0.5], { tone: dim(ink.teal, 1.5) })
    box('paint', world, [middle + side * 1.45, 0.35, back + 2.3], [0.56, 0.1, 0.56], { tone: ink.rust })
  }
  box('paint', world, [middle, top - 0.3, back + 2.3], [1.5, 0.6, 1.5], { tone: dim(ink.bruise, 1.3) })
  prism('paint', world, [middle, top - 0.85, back + 2.3], 0.42, 0.5, 8, ink.rust)
  box('glow', world, [middle, top - 1.14, back + 2.3], [0.5, 0.08, 0.5], { tone: dim(ink.cream, 1.6) })
  // The platform under the emitter. Its top edge is the lowest thing the window shows.
  prism('paint', world, [middle, floor + 1.3, back + 2.3], 1.05, 2.6, 8, dim(ink.chitin, 1.3), dim(ink.cream, 0.8))
}

function buildProp(sculptor: Sculptor, prop: OfficeProp, index: number) {
  const { quad, panel, box, prism } = sculptor
  const { frame, width: w, height: h, depth: d } = standOf(prop, prop._tag === 'Chair' ? 0.55 : 0)
  switch (prop._tag) {
    case 'Desk': {
      box('desk', frame, [0, h / 2 - 0.06, 0], [w, 0.12, d], { tile: 1.5 })
      for (const side of [-1, 1]) box('metal', frame, [side * (w / 2 - 0.42), -0.06, 0], [0.72, h - 0.12, d - 0.12], { tone: dim(ink.wing, 2.4), ground: 0.7, tile: 1.13 })
      box('metal', frame, [0, 0.12, -d / 2 + 0.1], [w - 1.5, h - 0.5, 0.06], { tone: dim(ink.wing, 1.8), tile: 1.13 })
      for (let drawer = 0; drawer < 3; drawer++) box('paint', frame, [w / 2 - 0.42, 0.3 - drawer * 0.36, d / 2 - 0.04], [0.3, 0.05, 0.05], { tone: ink.cream })
      // A stack of paper lies on the far side of the desk from the monitor.
      box('paint', frame, [-0.75, h / 2 + 0.03, 0.18], [0.5, 0.06, 0.38], { tone: dim(ink.cream, 1.05) })
      box('paint', frame, [-0.71, h / 2 + 0.065, 0.2], [0.5, 0.01, 0.38], { tone: dim(ink.wing, 1.2) })
      return
    }
    case 'Monitor': {
      box('paint', frame, [0, -h / 2 + 0.04, 0], [0.46, 0.08, 0.46], { tone: dim(ink.beige, 0.7) })
      box('paint', frame, [0, -h / 2 + 0.11, 0], [0.22, 0.08, 0.22], { tone: dim(ink.beige, 0.6) })
      box('paint', frame, [0, 0.075, d / 2 - 0.2], [w, h - 0.15, 0.4], { tone: ink.beige, ground: 0.85 })
      box('paint', frame, [0, 0.075, -0.16], [w * 0.74, h * 0.62, 0.46], { tone: dim(ink.beige, 0.8) })
      // The picture sits a little into the case, behind a dark surround.
      panel('paint', frame, [0, 0.11, d / 2 + 0.002], w - 0.14, h - 0.33, whole, ink.night)
      panel('screen', frame, [0, 0.11, d / 2 + 0.004], w - 0.2, h - 0.38)
      panel('glow', frame, [w / 2 - 0.1, -0.2, d / 2 + 0.002], 0.05, 0.03, whole, dim(ink.teal, 1.6))
      return
    }
    case 'Keyboard': {
      box('paint', frame, [0, 0, 0], [w, h, d], { tone: ink.beige })
      quad('marks', frame, [[-w / 2 + 0.02, h / 2 + 0.003, d / 2 - 0.02], [w / 2 - 0.02, h / 2 + 0.003, d / 2 - 0.02], [w / 2 - 0.02, h / 2 + 0.003, -d / 2 + 0.02], [-w / 2 + 0.02, h / 2 + 0.003, -d / 2 + 0.02]], markRegion('keys'))
      return
    }
    case 'Mug': {
      prism('paint', frame, [0, 0, 0], w * 0.42, h, 8, ink.rust, dim(ink.bruise, 0.4))
      box('paint', frame, [w * 0.5, 0, 0], [0.06, h * 0.55, 0.04], { tone: ink.rust })
      // The label faces the room. A name can go on it later.
      panel('marks', frame, [0, 0, w * 0.42 * Math.cos(Math.PI / 8) + 0.004], w * 0.3, h * 0.5, markRegion('label'))
      return
    }
    case 'Chair': {
      const seat = dim(ink.bruise, 1.25), steel = dim(ink.chitin, 1.3)
      box('paint', frame, [0, -h / 2 + 0.05, 0], [w * 0.85, 0.08, 0.12], { tone: steel })
      box('paint', frame, [0, -h / 2 + 0.05, 0], [0.12, 0.08, w * 0.85], { tone: steel })
      prism('paint', frame, [0, -h / 2 + 0.36, 0], 0.06, 0.56, 6, steel)
      box('paint', frame, [0, -h / 2 + 0.71, 0.03], [w * 0.8, 0.14, w * 0.8], { tone: seat, ground: 0.8 })
      box('paint', frame, [0, -h / 2 + 0.9, -w * 0.38], [0.1, 0.4, 0.06], { tone: steel })
      box('paint', frame, [0, h / 2 - 0.33, -w * 0.38], [w * 0.76, 0.66, 0.12], { tone: seat, ground: 0.85 })
      return
    }
    case 'Whiteboard': {
      box('paint', frame, [0, 0, 0], [w, h, d], { tone: dim(ink.wing, 1.1) })
      // The board is one flat face with its own drawing. Words can replace the drawing later.
      panel('marks', frame, [0, 0, d / 2 + 0.004], w - 0.14, h - 0.14, markRegion('whiteboard'))
      box('paint', frame, [0, -h / 2 - 0.02, d / 2 + 0.07], [w * 0.6, 0.05, 0.14], { tone: dim(ink.wing, 0.8) })
      for (const [x, colour] of [[-0.5, ink.rust], [-0.2, ink.teal], [0.35, ink.chitin]] as const) box('paint', frame, [x, -h / 2 + 0.025, d / 2 + 0.08], [0.2, 0.045, 0.045], { tone: colour })
      return
    }
    case 'JarShelf': {
      box('paint', frame, [0, -h / 2 + 0.06, 0], [w - 0.12, 0.12, d - 0.12], { tone: ink.night })
      box('metal', frame, [0, 0.03, 0], [w, h - 0.18, d], { tone: dim(ink.olive, 4), ground: 0.7, tile: 1.4 })
      box('paint', frame, [0, h / 2 - 0.03, 0], [w + 0.06, 0.06, d + 0.06], { tone: dim(ink.chitin, 1.2) })
      for (const share of [-0.25, 0, 0.25]) box('paint', frame, [share * w, 0.03, d / 2 + 0.004], [0.03, h - 0.3, 0.01], { tone: ink.night })
      for (const share of [-0.29, -0.21, 0.04, 0.29]) box('paint', frame, [share * w, 0.2, d / 2 + 0.03], [0.05, 0.2, 0.04], { tone: ink.cream })
      return
    }
    case 'Jar': {
      const radius = w / 2
      prism('glass', frame, [0, -0.03, 0], radius, h - 0.06, 8, dim(ink.wing, 1.2))
      prism('paint', frame, [0, h / 2 - 0.03, 0], radius + 0.012, 0.06, 8, dim(ink.chitin, 1.3))
      if (prop.contents === 'empty') return
      // Each full jar holds a different lump in a different fluid.
      const fluid = [ink.olive, ink.rust, ink.teal, ink.bruise, ink.cream][index % 5]!
      const lump = [ink.rust, ink.cream, ink.olive, ink.cream, ink.bruise][index % 5]!
      prism('glass', frame, [0, -0.07, 0], radius - 0.03, h - 0.2, 8, dim(fluid, 1.6))
      if (index % 2) prism('paint', at([prop.position[0], prop.position[1] - 0.08, prop.position[2]], index), [0, 0, 0], 0.08, 0.26, 5, lump)
      else box('paint', at([prop.position[0], prop.position[1] - 0.1, prop.position[2]], index * 0.7), [0, 0, 0], [0.17, 0.2 + index % 3 * 0.04, 0.13], { tone: lump })
      return
    }
    case 'ChamberWindow': {
      const rim = 0.2
      // The hazard frame stays inside the plan's box. The glass fills the hole it leaves.
      box('hazard', frame, [0, h / 2 - rim / 2, 0.03], [w, rim, 0.16], { tile: 0.8 })
      box('hazard', frame, [0, -h / 2 + rim / 2, 0.03], [w, rim, 0.16], { tile: 0.8 })
      for (const side of [-1, 1]) box('hazard', frame, [side * (w / 2 - rim / 2), 0, 0.03], [rim, h - rim * 2, 0.16], { tile: 0.8 })
      box('paint', frame, [0, 0, 0], [0.08, h - rim * 2, 0.1], { tone: dim(ink.chitin, 1.2) })
      panel('glass', frame, [0, 0, -0.03], w - rim * 2, h - rim * 2, whole, dim(ink.teal, 1.3))
      return
    }
    case 'WallClock': {
      // The clock is a short column that lies on its side, so its flat top faces the room.
      const flat = frame.clone().multiply(new Matrix4().makeRotationX(Math.PI / 2))
      prism('paint', flat, [0, 0, 0], w / 2, d, 12, dim(ink.chitin, 1.3))
      panel('marks', frame, [0, 0, d / 2 + 0.004], w * 0.9, h * 0.9, markRegion('clock'))
      // The two slow hands are painted on. The second hand is its own mesh and ticks with scene time.
      for (const [angle, length] of [[-1.05, 0.11], [1.9, 0.16]] as const) {
        box('paint', frame.clone().multiply(new Matrix4().makeRotationZ(-angle)), [0, length / 2, d / 2 + 0.008], [0.03, length, 0.004], { tone: ink.night })
      }
      return
    }
    case 'FilingCabinet': {
      // Half the cabinet's height shows the metal texture once. Its seam and its edges draw four drawers.
      box('metal', frame, [0, 0, 0], [w, h, d], { tone: dim(ink.wing, 3), ground: 0.7, tile: h / 2 })
      for (let drawer = 0; drawer < 4; drawer++) {
        const y = -h / 2 + h * (drawer + 0.5) / 4
        box('paint', frame, [0, y - 0.08, d / 2 + 0.02], [0.32, 0.05, 0.04], { tone: ink.cream })
        panel('paint', frame, [0, y + 0.12, d / 2 + 0.004], 0.26, 0.1, whole, dim(ink.cream, 0.9))
      }
      return
    }
    case 'Door': {
      const steel = dim(ink.chitin, 1.3)
      box('paint', frame, [0, h / 2 + 0.08, 0], [w + 0.32, 0.16, 0.2], { tone: steel })
      for (const side of [-1, 1]) box('paint', frame, [side * (w / 2 + 0.08), 0, 0], [0.16, h, 0.2], { tone: steel, ground: 0.75 })
      box('paint', frame, [0, 0, -0.01], [w, h, 0.06], { tone: ink.bruise })
      panel('door', frame, [0, 0, 0.024], w, h, whole, plain, dim(plain, 0.8))
      box('glow', frame, [0, h / 2 + 0.36, 0.05], [0.6, 0.2, 0.08], { tone: dim(ink.teal, 1.4) })
      // The sign plate hangs beside the door on the viewer's side. A room name can go on it later.
      box('paint', frame, [w / 2 + 0.6, 0.45, 0], [0.62, 0.3, 0.05], { tone: steel })
      panel('marks', frame, [w / 2 + 0.6, 0.45, 0.03], 0.56, 0.21, markRegion('sign'))
      return
    }
    case 'VendingMachine': {
      box('metal', frame, [0, 0, 0], [w, h, d], { tone: dim(ink.bruise, 3.4), ground: 0.7, tile: 1.6 })
      box('paint', frame, [0, -h / 2 + 0.08, 0], [w + 0.02, 0.16, d + 0.02], { tone: ink.night })
      const face = d / 2 + 0.004
      // The lit window shows rows of blank packets. Nothing on the machine is a word.
      panel('glow', frame, [-0.18, 0.5, face], w * 0.6, 1.7, whole, dim(ink.cream, 0.5), dim(ink.cream, 0.35))
      const packets = [ink.rust, ink.olive, ink.teal, ink.cream, ink.bruise, ink.wing]
      for (let row = 0; row < 4; row++) {
        for (let column = 0; column < 3; column++) panel('glow', frame, [-0.18 + (column - 1) * 0.27, 1.12 - row * 0.4, face + 0.004], 0.18, 0.26, whole, dim(packets[(row * 2 + column) % packets.length]!, 1.1))
        panel('paint', frame, [-0.18, 0.95 - row * 0.4, face + 0.006], w * 0.6, 0.03, whole, ink.chitin)
      }
      for (let button = 0; button < 5; button++) panel('glow', frame, [w / 2 - 0.2, 0.95 - button * 0.2, face], 0.12, 0.1, whole, dim(button === 1 ? ink.teal : ink.cream, 0.8))
      panel('paint', frame, [w / 2 - 0.2, -0.25, face], 0.06, 0.16, whole, ink.night)
      panel('paint', frame, [-0.18, -1.05, face], w * 0.6, 0.4, whole, ink.night)
      return
    }
    case 'CeilingTube':
      // The room builds the tubes with its ceiling.
      return
  }
}

/**
 * The research office: a late-1990s low-poly room built from flat boxes. Hard pixels are right here, so every texture keeps nearest filtering.
 * The plan in office-layout.ts says where each thing stands. Each surface is one draw call, and the lights cast no shadows.
 */
export function createOffice(textures: OfficeTextures, plan: OfficePlan = officePlan) {
  const root = new Group()
  root.name = 'Brundlefly office'
  const sculptor = createSculptor()
  const pane = plan.props.find(prop => prop._tag === 'ChamberWindow')
  const hole = pane && { minX: pane.position[0] - pane.size[0] / 2 + 0.2, maxX: pane.position[0] + pane.size[0] / 2 - 0.2,
    minY: pane.position[1] - pane.size[1] / 2 + 0.2, maxY: pane.position[1] + pane.size[1] / 2 - 0.2 }
  buildRoom(sculptor, plan, hole)
  if (hole) buildChamber(sculptor, plan, hole)
  plan.props.forEach((prop, index) => buildProp(sculptor, prop, index))

  const sheet = document.createElement('canvas')
  sheet.width = sheet.height = marksSize
  paintOfficeMarks(sheet.getContext('2d')!)
  const marks = new CanvasTexture(sheet)
  marks.colorSpace = SRGBColorSpace
  marks.magFilter = NearestFilter
  const failing = new MeshBasicMaterial({ vertexColors: true })
  const lit = (map?: Texture) => new MeshLambertMaterial({ map, vertexColors: true })
  const materials: Record<Surface, Material> = {
    floor: lit(textures.floor), wall: lit(textures.wall), ceiling: lit(textures.ceiling), desk: lit(textures.desk), metal: lit(textures.metal),
    hazard: lit(textures.hazard), door: lit(textures.door), paint: lit(),
    // The clock face is a disc on a square. The clear corners of its drawing are cut away.
    marks: new MeshLambertMaterial({ map: marks, alphaTest: 0.5 }),
    // A screen and a lamp give their own light, so the room's lights do not shade them.
    screen: new MeshBasicMaterial({ map: textures.screen }),
    glow: new MeshBasicMaterial({ vertexColors: true }),
    flicker: failing,
    glass: new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.38, depthWrite: false }),
  }
  const geometries = sculptor.build()
  for (const [surface, geometry] of geometries) root.add(new Mesh(geometry, materials[surface]))

  // The second hand of the clock.
  const clock = plan.props.find(prop => prop._tag === 'WallClock')
  const handGeometry = new BufferGeometry()
  handGeometry.setAttribute('position', new Float32BufferAttribute([-0.008, -0.03, 0, 0.008, -0.03, 0, 0.008, 0.19, 0, -0.008, 0.19, 0], 3))
  handGeometry.setIndex([0, 1, 2, 0, 2, 3])
  const handMaterial = new MeshBasicMaterial({ color: new Color('#AA604B') })
  const hand = new Mesh(handGeometry, handMaterial)
  if (clock) {
    hand.position.set(clock.position[0], clock.position[1], clock.position[2] + clock.size[2] / 2 + 0.012)
    root.add(hand)
  }

  // Four lights and no shadows. The sky light fills the room as the tubes would, and one sun shapes the boxes and him.
  const sky = new HemisphereLight(new Color('#F2EEDC'), new Color('#777648'), 1)
  const fill = new AmbientLight(new Color('#A4B5A0'), 0.25)
  const sun = new DirectionalLight(new Color('#FFF4DC'), 1)
  sun.position.set(-2.5, 6, 5)
  sun.target.position.set(0, -1, -1)
  // The failing tube lights the floor under it, so its flicker shows in the room.
  const lamp = new PointLight(new Color('#FFF1CF'), 1, 9, 1.6)
  lamp.position.set(plan.cues.ceiling[0], plan.cues.ceiling[1] - 0.25, plan.cues.ceiling[2])
  // Cold light leaks from the test chamber. It is the only strong teal in the room.
  const leak = new PointLight(new Color('#418B90'), 1, 8, 1.6)
  leak.position.set(plan.cues.light[0], plan.cues.light[1], plan.room.minZ - 1.2)
  root.add(sky, fill, sun, sun.target, lamp, leak)
  const levels = { sky: 1.9, sun: 1.5, lamp: 9, leak: 16 }
  const bright = new Color('#FFF6DD')

  return {
    root,
    update({ time, settings }: OfficeInput) {
      // The lighting sliders keep their roles: ambient is the sky light, key the sun, inner the failing tube, rim the chamber's leak.
      sky.intensity = levels.sky * settings.ambient / defaultSceneSettings.ambient
      sun.intensity = levels.sun * settings.key / defaultSceneSettings.key
      const glow = tubeFlicker(time)
      lamp.intensity = levels.lamp * glow * settings.inner / defaultSceneSettings.inner
      failing.color.copy(bright).multiplyScalar(0.18 + glow * 0.82)
      leak.intensity = levels.leak * settings.rim / defaultSceneSettings.rim
      // One tick each second. A whole second of scene time must pass, so a still scene keeps a still hand.
      hand.rotation.z = -Math.floor(time) / 60 * Math.PI * 2
    },
    dispose() {
      geometries.forEach(geometry => geometry.dispose())
      Object.values(materials).forEach(material => material.dispose())
      handGeometry.dispose()
      handMaterial.dispose()
      marks.dispose()
      root.clear()
    },
  }
}
