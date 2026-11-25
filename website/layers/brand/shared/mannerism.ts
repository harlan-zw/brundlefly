import type { Stroll } from './mascot-stroll.ts'

/** Habits he performs on his own or as a dialogue beat. Human habits first, then fly habits. */
export type MannerismTag = 'CheckPalm' | 'HeadTilt' | 'JawCatch' | 'LeanIn' | 'AirWriting' | 'GlanceEggs'
  | 'WingTwitch' | 'WingBuzz' | 'RubHands' | 'WipeEye' | 'ListenCeiling' | 'LookToLight' | 'Still' | 'ReachSwitch' | 'Greet' | 'TypeKeys' | 'TendJar' | 'WriteBoard'
  | 'SmackMachine' | 'TrackFly' | 'Dance'
export type Mannerism = { _tag: 'None' } | { _tag: MannerismTag }
/** `age` counts seconds since the mannerism began. `weight` fades a whole layer in or out. `side` mirrors a directional turn. */
export type MannerismLayer = { mannerism: Mannerism, age: number, weight?: number, side?: 1 | -1 }
/** `Palm` is his long right hand, `Claw` his long left hand. The scene turns each cue into a world point. */
export type EyeCue = 'Palm' | 'Claw' | 'Eggs' | 'Light' | 'Ceiling'
export type MannerismJoint = 'chest' | 'head' | 'left-shoulder' | 'left-elbow' | 'left-hand' | 'right-shoulder' | 'right-elbow' | 'right-hand'
  | 'left-small-elbow' | 'right-small-elbow' | 'left-wing' | 'right-wing'
type Turn = [x: number, y: number, z: number]
/** Rotations add to the walking and idle pose. Scalars override idle habits; `calm` damps idle motion. */
/**
 * How one long hand closes. `curl` closes every finger, from 0, the open hand of the model, to 1, a fist.
 * `taps` adds to single fingers, in the order of the model's finger joints, so a hand can strike keys one finger at a time.
 * `holds` names a thing in the hand. The model shows it while the hand holds it.
 */
export type HandPose = { curl: number, taps?: readonly number[], holds?: 'Marker' }
export type HandPoses = { left?: HandPose, right?: HandPose }
export type MannerismPose = {
  turns: Partial<Record<MannerismJoint, Turn>>
  hands: HandPoses
  eyes: { cue: EyeCue, weight: number } | undefined
  buzz: number, rub: number, jaw: number, blink: number, calm: number
}
type Motion = { turns?: Partial<Record<MannerismJoint, Turn>>, hands?: HandPoses, cue?: EyeCue, buzz?: number, rub?: number, jaw?: number, blink?: number, calm?: number }
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
    // Each finger strikes in its own turn, so the hands play over the keys and do not flap as one.
    const strikes = (offset: number) => Array.from({ length: 5 }, (_, finger) => tap(offset + finger * 1.3) * 0.55 * e)
    return { calm: e * 0.4, hands: { left: { curl: 0.25 * e, taps: strikes(0) }, right: { curl: 0.25 * e, taps: strikes(Math.PI) } }, turns: {
      'left-shoulder': [-0.62 * e, 0, -0.1 * e], 'right-shoulder': [-0.62 * e, 0, 0.1 * e],
      'left-elbow': [(-0.7 - tap(0) * 0.12) * e, 0, 0], 'right-elbow': [(-0.7 - tap(Math.PI) * 0.12) * e, 0, 0],
      'left-hand': [(0.1 + tap(0) * 0.4) * e, 0, 0], 'right-hand': [(0.1 + tap(Math.PI) * 0.4) * e, 0, 0],
      'left-small-elbow': [0, 0, tap(1.3) * 0.2 * e], 'right-small-elbow': [0, 0, -tap(2.6) * 0.2 * e],
      head: [(0.2 - (1 - typing) * 0.26) * e, Math.sin(age * 0.9) * 0.06 * e, 0], chest: [0.16 * e, 0, 0] } }
  } },
  // He stands turned to the jars. The long arm nearer them lifts to one, turns it a little each way, and his head tips to look inside. `side` is the side the jars are on.
  // The jar stays on the shelf. A jar in his hand never looked held: his fingers went through it.
  TendJar: { duration: 5.4, attack: 0.7, release: 0.8, motion: (e, age, side) => {
    const [shoulder, elbow, hand] = side === 1 ? ['left-shoulder', 'left-elbow', 'left-hand'] as const : ['right-shoulder', 'right-elbow', 'right-hand'] as const
    const turn = Math.sin(age * 1.7)
    return { cue: 'Eggs', calm: e * 0.5, hands: { [side === 1 ? 'left' : 'right']: { curl: 0.5 * e } }, turns: {
      [shoulder]: [-0.5 * e, 0, 0.08 * e * side], [elbow]: [-0.95 * e, 0, 0], [hand]: [-0.15 * e, turn * 0.3 * e, 0],
      head: [0.26 * e, 0.1 * e * side, turn * 0.05 * e * side], chest: [0.14 * e, 0.04 * e * side, 0] } satisfies Partial<Record<MannerismJoint, Turn>> }
  } },
  // He stands turned to the whiteboard. The long arm on `side` lifts high and writes four short lines, each a little lower, and his head follows the hand.
  // `markerStrokes` gives the count of lines, so the marker's squeak can follow them.
  WriteBoard: { duration: 6.2, attack: 0.7, release: 0.8, motion: (e, age, side) => {
    const [shoulder, elbow, hand] = side === 1 ? ['left-shoulder', 'left-elbow', 'left-hand'] as const : ['right-shoulder', 'right-elbow', 'right-hand'] as const
    const line = clamp01((age - strokeStart) / strokeTime / strokeCount) * strokeCount
    const along = Math.sin((line % 1) * Math.PI * 2 - Math.PI / 2)
    const writing = age > strokeStart && line < strokeCount ? 1 : 0
    // His fingers close on the marker for as long as the arm is up.
    return { cue: side === 1 ? 'Claw' : 'Palm', calm: e * 0.5, hands: { [side === 1 ? 'left' : 'right']: { curl: 0.85 * e, holds: e > 0.35 ? 'Marker' as const : undefined } }, turns: {
      [shoulder]: [(-1.05 + Math.floor(line) * 0.05) * e, 0, (0.04 + along * 0.1 * writing) * e * side], [elbow]: [-0.85 * e, 0, along * 0.08 * writing * e * side],
      [hand]: [-0.1 * e, 0, along * 0.2 * writing * e * side],
      head: [-0.12 * e, 0.1 * e * side, 0.04 * e * side], chest: [-0.03 * e, 0.04 * e * side, 0] } satisfies Partial<Record<MannerismJoint, Turn>> }
  } },
  // The vending machine keeps what he paid for. He stands turned to it, draws the long arm on the viewer's side back, and smacks its front twice, the second time harder.
  // Then he leans in to look at the slot, and his head tips: nothing. `side` is the side the machine is on. `machineSmacks` gives the moments of the blows, so the sound can follow them.
  SmackMachine: { duration: 6.4, attack: 0.5, release: 0.8, motion: (e, age, side) => {
    const [shoulder, elbow, hand] = side === 1 ? ['left-shoulder', 'left-elbow', 'left-hand'] as const : ['right-shoulder', 'right-elbow', 'right-hand'] as const
    // `drawn` is how far the arm is pulled back for a blow. `struck` is how far it is out against the machine.
    const blow = smackTimes.reduce((sum, time, index) => {
      const drawn = smooth(clamp01((age - time + 0.45) / 0.4)) * (1 - clamp01((age - time) / 0.07))
      const struck = clamp01((age - time) / 0.07) * (1 - 0.45 * smooth(clamp01((age - time - 0.07) / 0.5))) * (age < time + 0.85 ? 1 : 1 - smooth(clamp01((age - time - 0.85) / 0.3)))
      return { drawn: Math.max(sum.drawn, drawn), struck: Math.max(sum.struck, struck * (0.8 + index * 0.2)) }
    }, { drawn: 0, struck: 0 })
    const peer = smooth(clamp01((age - 3.3) / 0.5)) * (1 - smooth(clamp01((age - 4.7) / 0.4)))
    const doubt = smooth(clamp01((age - 4.6) / 0.35)) * (1 - smooth(clamp01((age - 5.7) / 0.4)))
    return { calm: e * 0.4, hands: { [side === 1 ? 'left' : 'right']: { curl: 0.2 * e } }, turns: {
      [shoulder]: [(-0.55 - 0.3 * blow.struck + 0.35 * blow.drawn) * e, 0, (0.3 + 0.62 * blow.struck - 0.25 * blow.drawn) * e * side],
      [elbow]: [(-0.9 + 0.4 * blow.struck - 0.5 * blow.drawn) * e, 0, 0], [hand]: [(-0.1 - 0.25 * blow.struck) * e, 0, 0],
      head: [(0.05 + 0.2 * peer + 0.08 * blow.struck) * e, (0.6 - 0.15 * blow.drawn) * e * side, 0.3 * doubt * e * side],
      chest: [(0.06 + 0.18 * peer + 0.1 * blow.struck) * e, (0.1 + 0.08 * blow.struck) * e * side, 0],
      'left-wing': [0, 0.14 * blow.struck * e, 0], 'right-wing': [0, -0.1 * blow.struck * e, 0] } satisfies Partial<Record<MannerismJoint, Turn>> }
  } },
  // A fly crosses the room, or he thinks one does. His head follows it up and round, his small arms twitch, and his jaw snaps at it. He misses, and his small hands rub it off.
  TrackFly: { duration: 5.6, attack: 0.4, release: 0.7, motion: (e, age) => {
    const snap = Math.max(0, 1 - Math.abs(age - snapTime) / 0.14)
    const after = smooth(clamp01((age - snapTime - 0.2) / 0.3))
    const follow = 1 - after
    return { jaw: snap * 0.85 * e, rub: after * e, turns: {
      head: [(-0.2 + Math.sin(age * 2.7 + 1) * 0.18) * follow * e + snap * 0.22 * e, (Math.sin(age * 1.9) * 0.5 + Math.sin(age * 4.3) * 0.16) * follow * e, Math.sin(age * 3.1) * 0.08 * follow * e],
      chest: [-0.05 * follow * e, Math.sin(age * 1.9) * 0.14 * follow * e, 0],
      'left-small-elbow': [0, 0, Math.sin(age * 11) * 0.18 * follow * e], 'right-small-elbow': [0, 0, -Math.sin(age * 9 + 1) * 0.18 * follow * e],
      'left-wing': [0, Math.sin(age * 6) * 0.06 * follow * e, 0] } }
  } },
  // He dances. `age` counts beats of the music here, not seconds, so the dance keeps any tempo. He bounces once a beat and sways over two.
  // His long arms go up in turn over four beats, his small arms pump on every beat, and his wings lift with each bounce.
  Dance: { duration: 100000, attack: 1.5, release: 2, motion: (e, age) => {
    const turn = age * Math.PI
    const bounce = Math.abs(Math.sin(turn))
    const sway = Math.sin(turn)
    const phrase = Math.sin(turn / 2)
    return { turns: {
      chest: [0.1 * bounce * e, 0.16 * sway * e, 0.07 * sway * e], head: [(-0.12 + 0.2 * bounce) * e, -0.1 * sway * e, 0.16 * sway * e],
      'left-shoulder': [(-0.5 - 0.4 * Math.max(0, phrase)) * e, 0, (0.25 + 0.3 * Math.max(0, sway)) * e], 'right-shoulder': [(-0.5 - 0.4 * Math.max(0, -phrase)) * e, 0, (-0.25 - 0.3 * Math.max(0, -sway)) * e],
      'left-elbow': [(-0.9 + 0.3 * bounce) * e, 0, 0], 'right-elbow': [(-0.9 + 0.3 * bounce) * e, 0, 0], 'left-hand': [0, 0, 0.3 * sway * e], 'right-hand': [0, 0, 0.3 * sway * e],
      'left-small-elbow': [0, 0, 0.25 * Math.sin(turn * 2) * e], 'right-small-elbow': [0, 0, -0.25 * Math.sin(turn * 2) * e],
      'left-wing': [0, 0.12 * bounce * e, 0], 'right-wing': [0, -0.12 * bounce * e, 0] } }
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

// He smacks the vending machine twice.
const smackTimes = [1.4, 2.5] as const
/** How many blows have landed on the vending machine by `age` seconds of that habit. The scene plays a thump each time the count rises. */
export const machineSmacks = (age: number) => smackTimes.filter(time => age >= time).length

// The moment his jaw snaps at the fly.
const snapTime = 3.7

// He writes four lines on the board, one after the other.
const strokeStart = 0.9, strokeTime = 1.1, strokeCount = 4
/** How many lines he has begun on the whiteboard by `age` seconds of the writing habit. The scene plays a squeak each time the count rises. */
export const markerStrokes = (age: number) => age < strokeStart ? 0 : Math.min(strokeCount, Math.floor((age - strokeStart) / strokeTime) + 1)

/**
 * The habits of his round for this visit to each walk point. `visits` counts his stops at each point so far, this one included.
 * A point with an alternate habit takes it on every second visit.
 */
export const roundHabits = (habits: readonly MannerismTag[], alternates: readonly (MannerismTag | undefined)[] | undefined, visits: readonly number[]): MannerismTag[] =>
  habits.map((habit, point) => (visits[point] ?? 0) % 2 === 0 && (visits[point] ?? 0) > 0 ? alternates?.[point] ?? habit : habit)

/** Every habit by name, for a host that lets a person choose one. */
export const mannerismTags = Object.keys(shapes) as MannerismTag[]

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
  const pose: MannerismPose = { turns: {}, hands: {}, eyes: undefined, buzz: 0, rub: 0, jaw: 0, blink: 0, calm: 0 }
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
    // The tighter grip wins, finger by finger.
    for (const side of ['left', 'right'] as const) {
      const hand = motion.hands?.[side]
      if (!hand) continue
      const held = pose.hands[side]
      const taps = Array.from({ length: Math.max(hand.taps?.length ?? 0, held?.taps?.length ?? 0) }, (_, finger) => Math.max(hand.taps?.[finger] ?? 0, held?.taps?.[finger] ?? 0))
      pose.hands[side] = { curl: Math.max(hand.curl, held?.curl ?? 0), taps, holds: hand.holds ?? held?.holds }
    }
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

/**
 * The habit at a station, where he first turns to his work. It waits until he faces his work, so a lifted arm never crosses his own head on the way round.
 * `readyAge` is the age of the stop at the moment he faced his work, and nothing while he still turns. The habit then plays in the time the stop has left, faster if that is short.
 * `facing` fades it: 1 while he faces his work, down to 0 when a visitor has turned him away.
 */
export function stationMannerism(stroll: Stroll, habits: readonly MannerismTag[], readyAge: number | undefined, facing: number): MannerismLayer | undefined {
  if (stroll.activity._tag !== 'Pausing' || habits.length === 0 || readyAge === undefined) return undefined
  const { waypoint, duration, age } = stroll.activity
  const mannerism: Mannerism = { _tag: habits[waypoint % habits.length]! }
  const rate = Math.max(1, mannerismDuration(mannerism) / Math.max(0.5, duration - readyAge - lastStep))
  return { mannerism, age: (age - readyAge) * rate, weight: clamp01(facing) }
}
