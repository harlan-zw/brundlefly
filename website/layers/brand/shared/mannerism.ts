import type { Stroll } from './mascot-stroll.ts'

/** Habits he performs on his own or as a dialogue beat. Human habits first, then fly habits. */
export type MannerismTag = 'CheckPalm' | 'HeadTilt' | 'JawCatch' | 'LeanIn' | 'AirWriting' | 'GlanceEggs'
  | 'WingTwitch' | 'WingBuzz' | 'RubHands' | 'WipeEye' | 'ListenCeiling' | 'LookToLight' | 'Still' | 'ReachSwitch' | 'Greet' | 'TypeKeys' | 'TendJar'
export type Mannerism = { _tag: 'None' } | { _tag: MannerismTag }
/** `age` counts seconds since the mannerism began. `weight` fades a whole layer in or out. `side` mirrors a directional turn. */
export type MannerismLayer = { mannerism: Mannerism, age: number, weight?: number, side?: 1 | -1 }
/** `Palm` is his long right hand, `Claw` his long left hand. The scene turns each cue into a world point. */
export type EyeCue = 'Palm' | 'Claw' | 'Eggs' | 'Light' | 'Ceiling'
export type MannerismJoint = 'chest' | 'head' | 'left-shoulder' | 'left-elbow' | 'left-hand' | 'right-shoulder' | 'right-elbow' | 'right-hand'
  | 'left-small-elbow' | 'right-small-elbow' | 'left-wing' | 'right-wing'
type Turn = [x: number, y: number, z: number]
/** Rotations add to the walking and idle pose. Scalars override idle habits; `calm` damps idle motion. */
export type MannerismPose = {
  turns: Partial<Record<MannerismJoint, Turn>>
  eyes: { cue: EyeCue, weight: number } | undefined
  buzz: number, rub: number, jaw: number, blink: number, calm: number
}
type Motion = { turns?: Partial<Record<MannerismJoint, Turn>>, cue?: EyeCue, buzz?: number, rub?: number, jaw?: number, blink?: number, calm?: number }
type Shape = { duration: number, attack: number, release: number, motion: (envelope: number, age: number, side: 1 | -1) => Motion }

const beatMannerisms: Record<string, MannerismTag> = {
  'He checks an empty palm.': 'CheckPalm', 'He tilts his head.': 'HeadTilt', 'His jaw catches.': 'JawCatch',
  'He leans closer.': 'LeanIn', 'A claw writes in the air.': 'AirWriting', 'He glances at the eggs.': 'GlanceEggs',
  'One wing twitches.': 'WingTwitch', 'His wings buzz once.': 'WingBuzz', 'His small hands rub together.': 'RubHands',
  'He wipes an eye with his wrist.': 'WipeEye', 'He listens to the ceiling.': 'ListenCeiling',
  'He looks toward the light.': 'LookToLight', 'He goes very still.': 'Still',
}

// The rig is a relief of flat artwork. The sculpted head and chest carry the large turns; limbs fold mostly in plane (z).
// Each pose must read at scene distance, so the head and chest move with the hands.
const shapes: Record<MannerismTag, Shape> = {
  // He folds the long right forearm up in front of his ribs, turns to look into the palm, and closes the claws once.
  CheckPalm: { duration: 2.4, attack: 0.5, release: 0.6, motion: (e, age) => ({ cue: 'Palm', turns: {
    'right-shoulder': [0, 0, 0.24 * e], 'right-elbow': [-0.45 * e, 0, -0.95 * e],
    'right-hand': [0, -0.35 * e, (-0.3 + Math.max(0, Math.sin((age - 1.1) * 4)) * 0.15) * e],
    head: [0.22 * e, 0.18 * e, -0.08 * e], chest: [0.06 * e, 0.08 * e, 0] } }) },
  HeadTilt: { duration: 1.8, attack: 0.35, release: 0.55, motion: e => ({ turns: { head: [0.04 * e, 0, 0.32 * e], chest: [0, 0, 0.04 * e] } }) },
  // The mouthparts open, snag, and shut. A jerk of the head sells the catch.
  JawCatch: { duration: 0.95, attack: 0.1, release: 0.3, motion: (e, age) => ({
    jaw: (0.6 + Math.sin(age * 38) * 0.12) * e, turns: { head: [0.07 * e * Math.max(0, Math.sin(age * 9)), 0, 0] } }) },
  LeanIn: { duration: 2.4, attack: 0.55, release: 0.7, motion: e => ({ turns: { chest: [0.2 * e, 0, 0], head: [-0.14 * e, 0, 0] } }) },
  // The long left claw scratches a short line in the air while he turns to watch it.
  AirWriting: { duration: 2.6, attack: 0.45, release: 0.55, motion: (e, age) => ({ cue: 'Claw', turns: {
    'left-shoulder': [0, 0, -0.32 * e], 'left-elbow': [-0.35 * e, 0, (-0.3 + Math.sin(age * 4.2) * 0.14) * e],
    'left-hand': [0, 0, Math.sin(age * 9) * 0.2 * e], head: [0.1 * e, -0.22 * e, 0.06 * e], chest: [0, -0.06 * e, 0] } }) },
  // `side` turns him toward the nearer egg cluster.
  GlanceEggs: { duration: 2.4, attack: 0.4, release: 0.7, motion: (e, _age, side) => ({ cue: 'Eggs', turns: {
    head: [0.2 * e, 0.38 * e * side, 0.06 * e * side], chest: [0.06 * e, 0.1 * e * side, 0] } }) },
  WingTwitch: { duration: 0.8, attack: 0.08, release: 0.45, motion: (e, age) => ({ turns: { 'left-wing': [0, (0.2 + Math.sin(age * 24) * 0.06) * e, 0] } }) },
  WingBuzz: { duration: 0.7, attack: 0.08, release: 0.22, motion: e => ({ buzz: e }) },
  RubHands: { duration: 2.2, attack: 0.3, release: 0.4, motion: e => ({ rub: e }) },
  // A fly grooms its eyes with a foreleg. The arm cannot reach his face in this relief,
  // so the head ducks and turns to meet the wrist halfway, and the eye shuts as it passes.
  WipeEye: { duration: 1.8, attack: 0.4, release: 0.5, motion: (e, age) => ({ blink: e * Math.max(0, Math.sin((age - 0.35) * 4.5)), turns: {
    'right-shoulder': [0, 0, 0.42 * e], 'right-elbow': [-0.4 * e, 0, (-1.15 + Math.sin(age * 12) * 0.08) * e], 'right-hand': [-0.15 * e, 0, -0.4 * e],
    head: [0.26 * e, 0.16 * e, -0.24 * e], chest: [0.08 * e, 0.06 * e, 0] } }) },
  ListenCeiling: { duration: 2.6, attack: 0.5, release: 0.7, motion: e => ({ cue: 'Ceiling', calm: e * 0.6, turns: {
    head: [-0.4 * e, 0, 0.1 * e], chest: [-0.08 * e, 0, 0], 'left-wing': [0, -0.05 * e, 0], 'right-wing': [0, 0.04 * e, 0] } }) },
  // The light at the opening pulls at him. He turns over his shoulder, and the wings lift before he catches them.
  LookToLight: { duration: 2.6, attack: 0.5, release: 0.8, motion: e => ({ cue: 'Light', turns: {
    head: [-0.18 * e, -0.45 * e, 0], chest: [-0.06 * e, -0.12 * e, 0], 'left-wing': [0, -0.16 * e, 0], 'right-wing': [0, 0.12 * e, 0] } }) },
  Still: { duration: 2.8, attack: 0.3, release: 0.6, motion: e => ({ calm: e }) },
  // He faces a wall switch and lifts the long arm on the viewer's side to it. His head turns from the viewer to his hand. `side` is the side the wall is on.
  // The hand holds at the switch while the tubes strike, then falls as he turns away.
  ReachSwitch: { duration: 1.9, attack: 0.5, release: 0.55, motion: (e, _age, side) => {
    const [shoulder, elbow, hand] = side === 1 ? ['left-shoulder', 'left-elbow', 'left-hand'] as const : ['right-shoulder', 'right-elbow', 'right-hand'] as const
    return { calm: e * 0.5, turns: {
      [shoulder]: [-0.8 * e, 0, 0.92 * e * side], [elbow]: [-0.5 * e, 0, 0], [hand]: [-0.3 * e, 0, 0],
      head: [0.05 * e, 0.75 * e * side, 0], chest: [0.08 * e, 0.1 * e * side, 0] } satisfies Partial<Record<MannerismJoint, Turn>> }
  } },
  // He stands turned to his desk. Both long arms come forward to the keys, the claws tap in turn, and his head drops to the screen.
  // He stops twice to read what he wrote. `keyTaps` gives the moments of his taps, so the sound can follow them.
  TypeKeys: { duration: 6.4, attack: 0.6, release: 0.7, motion: (e, age) => {
    const typing = typingShare(age)
    const tap = (offset: number) => Math.max(0, Math.sin(age * keyTapRate * Math.PI + offset)) * typing
    return { calm: e * 0.4, turns: {
      'left-shoulder': [-0.62 * e, 0, -0.1 * e], 'right-shoulder': [-0.62 * e, 0, 0.1 * e],
      'left-elbow': [(-0.7 - tap(0) * 0.12) * e, 0, 0], 'right-elbow': [(-0.7 - tap(Math.PI) * 0.12) * e, 0, 0],
      'left-hand': [(0.1 + tap(0) * 0.4) * e, 0, 0], 'right-hand': [(0.1 + tap(Math.PI) * 0.4) * e, 0, 0],
      'left-small-elbow': [0, 0, tap(1.3) * 0.2 * e], 'right-small-elbow': [0, 0, -tap(2.6) * 0.2 * e],
      head: [(0.2 - (1 - typing) * 0.26) * e, Math.sin(age * 0.9) * 0.06 * e, 0], chest: [0.16 * e, 0, 0] } }
  } },
  // He stands turned to the jars. The long arm nearer them lifts to one, turns it a little each way, and his head tips to look inside. `side` is the side the jars are on.
  TendJar: { duration: 5.4, attack: 0.7, release: 0.8, motion: (e, age, side) => {
    const [shoulder, elbow, hand] = side === 1 ? ['left-shoulder', 'left-elbow', 'left-hand'] as const : ['right-shoulder', 'right-elbow', 'right-hand'] as const
    const turn = Math.sin(age * 1.7)
    return { cue: 'Eggs', calm: e * 0.5, turns: {
      [shoulder]: [-0.95 * e, 0, 0.18 * e * side], [elbow]: [-0.42 * e, 0, 0], [hand]: [-0.1 * e, turn * 0.35 * e, 0],
      head: [0.12 * e, 0.16 * e * side, (0.14 + turn * 0.08) * e * side], chest: [0.12 * e, 0.06 * e * side, 0] } satisfies Partial<Record<MannerismJoint, Turn>> }
  } },
  // A small hello: his head tips, and the long claw on `side` lifts beside his face and opens twice. The wings give one short buzz.
  Greet: { duration: 1.7, attack: 0.3, release: 0.5, motion: (e, age, side) => {
    const [shoulder, elbow, hand] = side === 1 ? ['right-shoulder', 'right-elbow', 'right-hand'] as const : ['left-shoulder', 'left-elbow', 'left-hand'] as const
    return { buzz: e * Math.max(0, 1 - Math.abs(age - 0.45) / 0.3) * 0.7, turns: {
      [shoulder]: [0, 0, 0.5 * e * side], [elbow]: [-1.3 * e, 0, -0.8 * e * side], [hand]: [0, 0, (0.25 + Math.sin(age * 7.5) * 0.3) * e * side],
      head: [0.05 * e, 0, 0.2 * e * side], chest: [-0.04 * e, 0, 0.03 * e * side] } satisfies Partial<Record<MannerismJoint, Turn>> }
  } },
}

/** His taps in a second while he types. */
export const keyTapRate = 7
// He types in three bursts and reads between them.
const typingBursts: readonly (readonly [from: number, to: number])[] = [[0.7, 2.3], [2.9, 4.2], [4.7, 5.7]]
const typingShare = (age: number) => typingBursts.reduce((share, [from, to]) => Math.max(share, clamp01(Math.min(age - from, to - age) / 0.15)), 0)
/** How many keys he has struck by `age` seconds of the typing habit. The scene plays a click each time the count rises. */
export function keyTaps(age: number) {
  let taps = 0
  for (const [from, to] of typingBursts) taps += Math.floor(Math.max(0, Math.min(age, to) - from) * keyTapRate)
  return taps
}

const smooth = (value: number) => value * value * (3 - 2 * value)
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
/** Rises over `attack`, holds, and settles over `release`. Zero at and beyond both ends. */
const envelope = ({ duration, attack, release }: Shape, age: number) =>
  age <= 0 || age >= duration ? 0 : smooth(clamp01(age / attack)) * smooth(clamp01((duration - age) / release))

export const beatMannerism = (beat: string): Mannerism => {
  const tag = beatMannerisms[beat]
  return tag ? { _tag: tag } : { _tag: 'None' }
}
export const mannerismDuration = (mannerism: Mannerism) => mannerism._tag === 'None' ? 0 : shapes[mannerism._tag].duration

/** Sums every layer into one pose. The strongest eye cue wins. */
export function poseMannerisms(layers: readonly MannerismLayer[]): MannerismPose {
  const pose: MannerismPose = { turns: {}, eyes: undefined, buzz: 0, rub: 0, jaw: 0, blink: 0, calm: 0 }
  for (const { mannerism, age, weight = 1, side = 1 } of layers) {
    if (mannerism._tag === 'None') continue
    const shape = shapes[mannerism._tag]
    const strength = envelope(shape, age) * clamp01(weight)
    if (strength <= 0) continue
    const motion = shape.motion(strength, age, side)
    for (const [name, turn] of Object.entries(motion.turns ?? {}) as [MannerismJoint, Turn][]) {
      const total = pose.turns[name] ?? [0, 0, 0]
      pose.turns[name] = [total[0] + turn[0], total[1] + turn[1], total[2] + turn[2]]
    }
    if (motion.cue && strength > (pose.eyes?.weight ?? 0)) pose.eyes = { cue: motion.cue, weight: strength }
    pose.buzz = Math.max(pose.buzz, motion.buzz ?? 0)
    pose.rub = Math.max(pose.rub, motion.rub ?? 0)
    pose.jaw = Math.max(pose.jaw, motion.jaw ?? 0)
    pose.blink = Math.max(pose.blink, motion.blink ?? 0)
    pose.calm = Math.max(pose.calm, motion.calm ?? 0)
  }
  return pose
}

// He settles before a habit begins. A habit too long for its pause speeds up, so it ends before he walks on.
const settle = 0.3
const lastStep = 0.15
/** The habit he performs at the current walk pause, chosen by waypoint. */
export function pauseMannerism(stroll: Stroll, habits: readonly MannerismTag[]): MannerismLayer | undefined {
  if (stroll.activity._tag !== 'Pausing' || habits.length === 0) return undefined
  const { waypoint, duration, age } = stroll.activity
  const mannerism: Mannerism = { _tag: habits[waypoint % habits.length]! }
  const rate = Math.max(1, mannerismDuration(mannerism) / Math.max(0.1, duration - settle - lastStep))
  return { mannerism, age: (age - settle) * rate }
}
