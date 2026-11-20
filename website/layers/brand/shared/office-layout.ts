import type { MannerismTag } from './mannerism.ts'

/**
 * The floor plan of the office set. Coordinates are world units: x to screen right, y up, z toward the viewer.
 *
 * The Codex CLI wrote the plan as data, from the prompt in assets/prompts/office-layout.json. The frame was the lair's:
 * its camera, its floor level, and the size of the mesh mascot. The plan puts two stations on the back wall, because a phone
 * sees only the middle of that wall and he hides half of it: the desk and the whiteboard on the left, the jars and the test chamber on the right.
 * `checkOfficePlan` then judged the plan with his measured size, and three things changed by hand:
 * the desk lost 0.22 of its depth, the two back stops moved 0.25 toward the viewer, so his turned body keeps clear of the desk,
 * and the keyboard and the jars moved to stand fully on the desk and near the front of the cabinet.
 */
type Point = readonly [x: number, z: number]
type Place = readonly [x: number, y: number, z: number]
export type Facing = '+x' | '-x' | '+z' | '-z'
type PropShape =
  | { _tag: 'Desk' | 'Monitor' | 'Keyboard' | 'Mug' | 'Chair' | 'Whiteboard' | 'JarShelf' | 'FilingCabinet' | 'VendingMachine' | 'WallClock' | 'Door' | 'ChamberWindow' }
  | { _tag: 'Jar', contents: 'specimen' | 'empty' }
  | { _tag: 'CeilingTube', lamp: 'steady' | 'flickering' }
/**
 * One box of the plan. `position` is its centre and `size` its full extent along world x, y, and z. `facing` is where its front looks.
 * `rests` names what holds it: the floor, a wall, the ceiling, or the prop below it.
 */
export type OfficeProp = PropShape & { id: string, position: Place, size: Place, facing: Facing, rests: 'floor' | 'wall' | 'ceiling' | { on: string } }
export type OfficeStop = { position: Point, pause: number, habit: MannerismTag }
export type OfficePlan = {
  room: { minX: number, maxX: number, minZ: number, maxZ: number, floorY: number, ceilingY: number }
  props: readonly OfficeProp[]
  /** Where he starts. */
  start: Point
  /** The point in front of the door. He walks to it when he leaves for another place, and comes in from it. */
  exit: Point
  /** The loop he walks, in order. */
  stops: readonly OfficeStop[]
  /** What his habits look at: the jars for the eggs, the test chamber for the light, the flickering tube for the ceiling. */
  cues: { jars: Place, light: Place, ceiling: Place }
}

const jar = (id: string, x: number, contents: 'specimen' | 'empty'): OfficeProp =>
  ({ _tag: 'Jar', contents, id, position: [x, -0.345, -3.75], size: [0.4, 0.55, 0.4], facing: '+z', rests: { on: 'jar-shelf' } })
const tube = (id: string, x: number, z: number, length: number, lamp: 'steady' | 'flickering'): OfficeProp =>
  ({ _tag: 'CeilingTube', lamp, id, position: [x, 2.34, z], size: [0.16, 0.12, length], facing: '+z', rests: 'ceiling' })

export const officePlan: OfficePlan = {
  // The room reaches behind the camera, so a visitor who walks back or turns round still stands inside it.
  room: { minX: -5.5, maxX: 5.5, minZ: -4.5, maxZ: 14.5, floorY: -2.2, ceilingY: 2.4 },
  props: [
    // The office station, on the left of the back wall.
    { _tag: 'Desk', id: 'desk', position: [-2.075, -1.575, -3.75], size: [3.05, 1.25, 1.5], facing: '+z', rests: 'floor' },
    { _tag: 'Monitor', id: 'monitor', position: [-1.6, -0.55, -3.76], size: [0.8, 0.8, 0.8], facing: '+z', rests: { on: 'desk' } },
    { _tag: 'Keyboard', id: 'keyboard', position: [-1.57, -0.91, -3.2], size: [0.83, 0.08, 0.32], facing: '+z', rests: { on: 'desk' } },
    { _tag: 'Mug', id: 'mug', position: [-0.81, -0.825, -3.28], size: [0.25, 0.25, 0.25], facing: '+z', rests: { on: 'desk' } },
    { _tag: 'Chair', id: 'chair', position: [-4.25, -1.47, -2.7], size: [1, 1.46, 1.2], facing: '-z', rests: 'floor' },
    { _tag: 'Whiteboard', id: 'whiteboard', position: [-1.9, 0.78, -4.4], size: [3, 1.7, 0.1], facing: '+z', rests: 'wall' },
    // The science station, on the right of the back wall.
    { _tag: 'JarShelf', id: 'jar-shelf', position: [2.27, -1.41, -3.765], size: [3.68, 1.58, 1.47], facing: '+z', rests: 'floor' },
    jar('jar-1', 1.25, 'specimen'), jar('jar-2', 1.71, 'specimen'), jar('jar-3', 2.17, 'empty'), jar('jar-4', 2.7, 'specimen'), jar('jar-5', 3.4, 'specimen'),
    { _tag: 'ChamberWindow', id: 'chamber-window', position: [2.28, 0.95, -4.4], size: [4.1, 1.9, 0.1], facing: '+z', rests: 'wall' },
    { _tag: 'WallClock', id: 'wall-clock', position: [-0.07, 1.97, -4.4], size: [0.48, 0.48, 0.1], facing: '+z', rests: 'wall' },
    // The side walls. Only a wide screen shows them.
    { _tag: 'FilingCabinet', id: 'filing-cabinet-1', position: [-5.02, -1.05, -1.37], size: [0.96, 2.3, 1.16], facing: '+x', rests: 'floor' },
    { _tag: 'FilingCabinet', id: 'filing-cabinet-2', position: [-5.02, -1.05, -0.08], size: [0.96, 2.3, 1.16], facing: '+x', rests: 'floor' },
    { _tag: 'Door', id: 'door', position: [5.4, -0.4, -1.75], size: [0.1, 3.6, 1.7], facing: '-x', rests: 'wall' },
    { _tag: 'VendingMachine', id: 'vending-machine', position: [5, -0.55, 1.25], size: [1, 3.3, 1.5], facing: '-x', rests: 'floor' },
    tube('tube-office', -1.65, -3.05, 1.8, 'steady'), tube('tube-science', 1.65, -3.05, 1.8, 'steady'), tube('tube-walk-rear', 0, -1.22, 1.46, 'steady'),
    tube('tube-walk-left', -0.7, 0.4, 1.8, 'steady'), tube('tube-walk-right', 0.7, 0.7, 1.8, 'flickering'),
  ],
  start: [0.35, -0.4],
  exit: [3.1, -1],
  // He crosses the room between the stations: the desk, the jars, the near left, and the flickering tube.
  stops: [
    { position: [-0.9, -0.95], pause: 3.2, habit: 'AirWriting' },
    { position: [0.9, -0.95], pause: 3.8, habit: 'GlanceEggs' },
    { position: [-0.7, 0.4], pause: 2.8, habit: 'CheckPalm' },
    { position: [0.7, 0.7], pause: 4.1, habit: 'ListenCeiling' },
  ],
  cues: { jars: [2.17, -0.345, -3.75], light: [1.45, 0.95, -4.35], ceiling: [0.7, 2.28, 0.7] },
}

/**
 * His body for the checks. `reach` is the furthest any part of him gets from his own vertical axis, so a disc of that radius holds him at every turn.
 * `width` and `height` are his box as the camera sees him.
 */
export type PlanBody = { reach: number, width: number, height: number }
/** Measured on the mesh mascot at the scene's scale, in his rest pose. */
export const meshBody: PlanBody = { reach: 1.65, width: 2.55, height: 3.15 }

/** A camera that stands still, or the conversation close shot, which stands in front of him on the side he faces. */
export type PlanViewpoint = { _tag: 'Fixed', name: string, position: Place } | { _tag: 'CloseShot', name: string, side: 1 | -1 }
export type PlanRules = {
  body: PlanBody
  /** The least distance between his body and a prop while he walks, and while he stands. He turns on his feet at a stop, which moves him. */
  legClearance: number
  stopClearance: number
  viewpoints: readonly PlanViewpoint[]
  /** Props a fixed viewpoint must see from the front, by id. */
  readable: readonly string[]
}
export type PlanProblem =
  | { _tag: 'OutsideRoom', prop: string }
  | { _tag: 'Overlap', prop: string, other: string }
  | { _tag: 'RouteBlocked', prop: string, leg: number, clearance: number }
  | { _tag: 'StopCrowded', prop: string, stop: number, clearance: number }
  /** `from` is the stop he leaves from, or the start point. */
  | { _tag: 'ExitBlocked', prop: string, from: number | 'start', clearance: number }
  /** `at` is the point of his walked path that comes nearest the prop. */
  | { _tag: 'PathBlocked', prop: string, at: Point, clearance: number }
  | { _tag: 'SightlineBlocked', prop: string, stop: number, viewpoint: string }
  | { _tag: 'Unreadable', prop: string, viewpoint: string, reason: 'faces-away' | 'missing' | { hiddenBy: string } }

type Bounds = { min: Place, max: Place }
const bounds = ({ position, size }: Pick<OfficeProp, 'position' | 'size'>): Bounds => ({
  min: [position[0] - size[0] / 2, position[1] - size[1] / 2, position[2] - size[2] / 2],
  max: [position[0] + size[0] / 2, position[1] + size[1] / 2, position[2] + size[2] / 2],
})
const slack = 1e-6

/** How far a floor point is from a prop's footprint. Zero inside it. */
const footprintDistance = (box: Bounds, [x, z]: Point) =>
  Math.hypot(Math.max(box.min[0] - x, 0, x - box.max[0]), Math.max(box.min[2] - z, 0, z - box.max[2]))

/** Whether the straight line between two points passes through a box. */
function crosses(box: Bounds, from: Place, to: Place) {
  let enter = 0, leave = 1
  for (const axis of [0, 1, 2] as const) {
    const travel = to[axis] - from[axis]
    if (Math.abs(travel) < slack) {
      if (from[axis] <= box.min[axis] || from[axis] >= box.max[axis]) return false
      continue
    }
    const a = (box.min[axis] - from[axis]) / travel, b = (box.max[axis] - from[axis]) / travel
    enter = Math.max(enter, Math.min(a, b))
    leave = Math.min(leave, Math.max(a, b))
    if (enter >= leave) return false
  }
  return true
}

/** How far a straight walk passes from a prop's footprint. Zero when it crosses the footprint. */
function walkDistance(box: Bounds, from: Point, to: Point) {
  const column: Bounds = { min: [box.min[0], -Infinity, box.min[2]], max: [box.max[0], Infinity, box.max[2]] }
  if (crosses(column, [from[0], 0, from[1]], [to[0], 0, to[1]])) return 0
  const dx = to[0] - from[0], dz = to[1] - from[1]
  const length = dx * dx + dz * dz
  const nearest = (x: number, z: number): Point => {
    const share = length > 0 ? Math.max(0, Math.min(1, ((x - from[0]) * dx + (z - from[1]) * dz) / length)) : 0
    return [from[0] + dx * share, from[1] + dz * share]
  }
  // The nearest pair of points has an end of the walk, or a corner of the footprint.
  const corners: Point[] = [[box.min[0], box.min[2]], [box.min[0], box.max[2]], [box.max[0], box.min[2]], [box.max[0], box.max[2]]]
  return Math.min(footprintDistance(box, from), footprintDistance(box, to), ...corners.map(([x, z]) => footprintDistance(box, nearest(x, z))))
}

/**
 * Judges the path he really walks. He leaves a stop in a curve and turns to the way out in a curve, so his path is not the straight legs
 * that `checkOfficePlan` judges. `path` holds points along it, close together. Each must keep the leg clearance from every prop he could touch.
 * A prop is reported once, with the point that comes nearest it.
 */
export function checkWalkedPath(plan: OfficePlan, rules: PlanRules, path: readonly Point[]): PlanProblem[] {
  const problems: PlanProblem[] = []
  for (const prop of plan.props) {
    const box = bounds(prop)
    if (box.min[1] >= plan.room.floorY + rules.body.height) continue
    let nearest: { at: Point, clearance: number } | undefined
    for (const at of path) {
      const clearance = footprintDistance(box, at) - rules.body.reach
      if (!nearest || clearance < nearest.clearance) nearest = { at, clearance }
    }
    if (nearest && nearest.clearance < rules.legClearance - slack) problems.push({ _tag: 'PathBlocked', prop: prop.id, ...nearest })
  }
  return problems
}

const normals: Record<Facing, Place> = { '+x': [1, 0, 0], '-x': [-1, 0, 0], '+z': [0, 0, 1], '-z': [0, 0, -1] }
/** The middle of a prop's front, a hair in front of it. */
const frontOf = ({ position, size, facing }: OfficeProp): Place => {
  const normal = normals[facing]
  return [position[0] + normal[0] * (size[0] / 2 + 0.01), position[1], position[2] + normal[2] * (size[2] / 2 + 0.01)]
}

/** The close shot stands about three units in front of his head, a little to the side he faces. Matches camera-view.ts. */
const closeShot = ([x, z]: Point, floorY: number, body: PlanBody, side: 1 | -1): Place =>
  [x + side * Math.sin(0.255) * 3.2, floorY + body.height * 0.85, z + Math.cos(0.255) * 3.2]

/**
 * Judges a plan. He must walk his loop and his way to the door clear of every prop, each camera must see all of him at every stop,
 * and the fixed cameras must see each readable prop from its front. An empty list means the plan holds.
 */
export function checkOfficePlan(plan: OfficePlan, rules: PlanRules): PlanProblem[] {
  const problems: PlanProblem[] = []
  const { room, props, stops } = plan
  const boxes = props.map(prop => ({ prop, box: bounds(prop) }))
  for (const { prop, box } of boxes) {
    if (box.min[0] < room.minX - slack || box.max[0] > room.maxX + slack || box.min[2] < room.minZ - slack || box.max[2] > room.maxZ + slack
      || box.min[1] < room.floorY - slack || box.max[1] > room.ceilingY + slack) problems.push({ _tag: 'OutsideRoom', prop: prop.id })
  }
  // A prop may touch the prop it rests on. Any other two props that share space are a mistake.
  for (const [index, a] of boxes.entries()) {
    for (const b of boxes.slice(index + 1)) {
      const apart = ([0, 1, 2] as const).some(axis => a.box.max[axis] <= b.box.min[axis] + slack || b.box.max[axis] <= a.box.min[axis] + slack)
      if (!apart) problems.push({ _tag: 'Overlap', prop: a.prop.id, other: b.prop.id })
    }
  }
  // Only a prop that reaches down to his height can touch him.
  const obstacles = boxes.filter(({ box }) => box.min[1] < room.floorY + rules.body.height)
  for (const { prop, box } of obstacles) {
    for (const [index, stop] of stops.entries()) {
      const next = stops[(index + 1) % stops.length]!
      const leg = walkDistance(box, stop.position, next.position) - rules.body.reach
      if (leg < rules.legClearance - slack) problems.push({ _tag: 'RouteBlocked', prop: prop.id, leg: index, clearance: leg })
      const stand = footprintDistance(box, stop.position) - rules.body.reach
      if (stand < rules.stopClearance - slack) problems.push({ _tag: 'StopCrowded', prop: prop.id, stop: index, clearance: stand })
    }
    // A journey can begin anywhere on his loop. Every stop and the start are its ends, so their straight walks to the door bound the rest.
    for (const [from, place] of [['start', plan.start] as const, ...stops.map((stop, index) => [index, stop.position] as const)]) {
      const way = walkDistance(box, place, plan.exit) - rules.body.reach
      if (way < rules.legClearance - slack) problems.push({ _tag: 'ExitBlocked', prop: prop.id, from, clearance: way })
    }
  }
  // Each camera must see his whole box: nine points across it, from his feet to the top of his head.
  for (const viewpoint of rules.viewpoints) {
    for (const [index, stop] of stops.entries()) {
      const eye = viewpoint._tag === 'Fixed' ? viewpoint.position : closeShot(stop.position, room.floorY, rules.body, viewpoint.side)
      const targets = [-0.5, 0, 0.5].flatMap(across => [0.02, 0.5, 1].map((up): Place =>
        [stop.position[0] + across * rules.body.width, room.floorY + up * rules.body.height, stop.position[1]]))
      const blocker = boxes.find(({ box }) => targets.some(target => crosses(box, eye, target)))
      if (blocker) problems.push({ _tag: 'SightlineBlocked', prop: blocker.prop.id, stop: index, viewpoint: viewpoint.name })
    }
  }
  for (const id of rules.readable) {
    const subject = props.find(prop => prop.id === id)
    for (const viewpoint of rules.viewpoints) {
      if (viewpoint._tag !== 'Fixed') continue
      if (!subject) { problems.push({ _tag: 'Unreadable', prop: id, viewpoint: viewpoint.name, reason: 'missing' }); continue }
      const front = frontOf(subject), normal = normals[subject.facing]
      const toward = (viewpoint.position[0] - front[0]) * normal[0] + (viewpoint.position[2] - front[2]) * normal[2]
      if (toward <= 0) { problems.push({ _tag: 'Unreadable', prop: id, viewpoint: viewpoint.name, reason: 'faces-away' }); continue }
      const blocker = boxes.find(({ prop, box }) => prop.id !== id && crosses(box, viewpoint.position, front))
      if (blocker) problems.push({ _tag: 'Unreadable', prop: id, viewpoint: viewpoint.name, reason: { hiddenBy: blocker.prop.id } })
    }
  }
  return problems
}
