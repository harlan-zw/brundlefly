import assert from 'node:assert/strict'
import { test } from 'node:test'
import { advanceEntrance, entranceAct, entranceDarkLimit, entranceLight, entranceTimes, startEntrance } from '../layers/brand/shared/office-entrance.ts'
import type { Entrance, EntranceInput, EntranceStart } from '../layers/brand/shared/office-entrance.ts'
import { mannerismDuration, poseMannerisms } from '../layers/brand/shared/mannerism.ts'
import type { MannerismPose } from '../layers/brand/shared/mannerism.ts'
import { mascotInLight } from '../layers/brand/shared/scene-set.ts'
import type { SetMascot } from '../layers/brand/shared/scene-set.ts'

const firstLoad: EntranceStart = { offered: true, arrival: 'Load', seen: false, still: false, walks: true }
const dark: Entrance = { _tag: 'Dark', age: 0 }
type Sample = { time: number, entrance: Entrance, light: number }
/** Runs an entrance frame by frame. `input` gives the frame's inputs from the time and the state before it. */
function run(seconds: number, delta: number, input: (time: number, entrance: Entrance) => Partial<EntranceInput> = () => ({})): Sample[] {
  let entrance = dark
  const samples: Sample[] = [{ time: 0, entrance, light: entranceLight(entrance) }]
  for (let frame = 1; frame * delta <= seconds + 1e-9; frame++) {
    entrance = advanceEntrance(entrance, { delta, arrived: false, skip: false, still: false, ...input((frame - 1) * delta, entrance) })
    samples.push({ time: frame * delta, entrance, light: entranceLight(entrance) })
  }
  return samples
}
const firstAt = (samples: readonly Sample[], test: (sample: Sample) => boolean) => samples.find(test)?.time
const atRest = (pose: MannerismPose) => Object.values(pose.turns).every(turn => turn.every(value => Math.abs(value) < 1e-9)) && pose.buzz === 0 && pose.calm === 0

test('the room is dark only for the first load of a set with an entrance, for a mascot that can walk', () => {
  assert.deepEqual(startEntrance(firstLoad), { _tag: 'Dark', age: 0 })
  assert.equal(entranceLight(startEntrance(firstLoad)), 0)
  // A later load in the same browser session, a journey from the cave, reduced motion, a mascot that cannot walk, and a set with no switch.
  for (const lit of [{ seen: true }, { arrival: 'Travel' as const }, { still: true }, { walks: false }, { offered: false }]) {
    const entrance = startEntrance({ ...firstLoad, ...lit })
    assert.deepEqual(entrance, { _tag: 'Lit' }, JSON.stringify(lit))
    assert.equal(entranceLight(entrance), 1)
  }
})

test('he holds in the dark, walks, reaches, and the tubes strike: each phase in its order and its time', () => {
  // He stands at the switch 2.6 seconds after he starts to walk.
  const samples = run(12, 1 / 60, (_time, entrance) => ({ arrived: entrance._tag === 'Walking' && entrance.age >= 2.6 }))
  const phases = samples.map(sample => sample.entrance._tag).filter((tag, index, all) => tag !== all[index - 1])
  assert.deepEqual(phases, ['Dark', 'Walking', 'Reaching', 'Striking', 'Greeting', 'Lit'])
  const starts = Object.fromEntries(phases.map(tag => [tag, firstAt(samples, sample => sample.entrance._tag === tag)!]))
  assert.ok(Math.abs(starts.Walking! - entranceTimes.hold) < 0.02, 'He holds for about a second.')
  assert.ok(Math.abs(starts.Reaching! - starts.Walking! - 2.6) < 0.04)
  assert.ok(Math.abs(starts.Striking! - starts.Reaching! - entranceTimes.reach) < 0.02)
  // The room stays dark until his hand is on the switch, and the tubes hold within a second of it.
  assert.ok(samples.filter(sample => sample.time < starts.Striking! - 1e-9).every(sample => sample.light === 0))
  const full = firstAt(samples, sample => sample.light === 1)!
  assert.ok(full - starts.Striking! > 0.3 && full - starts.Striking! <= 1, `The strike took ${full - starts.Striking!} seconds.`)
  assert.ok(full <= 6, `Full light came at ${full} seconds.`)
  // Once the tubes hold, the light never falls again.
  assert.ok(samples.filter(sample => sample.time >= full).every(sample => sample.light === 1))
})

test('the room is fully lit within six seconds, even when he never reaches the switch, at every frame rate', () => {
  assert.ok(entranceDarkLimit <= 6)
  for (const delta of [1 / 144, 1 / 60, 1 / 30, 0.05]) {
    const samples = run(9, delta)
    const full = firstAt(samples, sample => sample.light === 1)!
    assert.ok(full <= entranceDarkLimit + delta + 1e-9, `At ${Math.round(1 / delta)} frames a second, full light came at ${full}.`)
    assert.equal(samples.at(-1)!.entrance._tag, 'Lit')
  }
})

test('a visitor who asks for him ends the entrance at once, from every phase, with no jump of the light', () => {
  for (const skipAt of [0, 0.5, 1.8, 3.8, 4.25, 4.3, 4.6, 5.2]) {
    const samples = run(9, 1 / 60, (time, entrance) => ({ arrived: entrance._tag === 'Walking' && entrance.age >= 2.6, skip: time >= skipAt }))
    const before = samples.findLast(sample => sample.time <= skipAt + 1e-9)!
    const after = samples.filter(sample => sample.time > skipAt + 1e-9)
    // The frame of the request changes nothing the visitor can see. The light then only rises.
    assert.equal(after[0]!.light, before.light, `Asked at ${skipAt}.`)
    for (const [index, sample] of after.entries()) if (index > 0) assert.ok(sample.light >= after[index - 1]!.light, `The light fell after a request at ${skipAt}.`)
    const full = firstAt(after, sample => sample.light === 1)!
    assert.ok(full - skipAt <= entranceTimes.hurry + 2 / 60 + 1e-9, `Asked at ${skipAt}, full light at ${full}.`)
    // He is free at once: nothing holds him at the switch while the visitor waits.
    assert.equal(entranceAct(after[0]!.entrance).held, false)
    assert.equal(firstAt(after, sample => sample.entrance._tag === 'Lit')! - skipAt <= entranceTimes.hurry + 2 / 60 + 1e-9, true)
    assert.ok(after.every(sample => sample.entrance._tag === 'Hurrying' || sample.entrance._tag === 'Lit'))
  }
})

test('reduced motion or Motion off in the middle of the entrance lights the room in that frame', () => {
  for (const stillAt of [0.4, 2, 4.4]) {
    const samples = run(6, 1 / 60, time => ({ still: time >= stillAt }))
    const after = samples.find(sample => sample.time > stillAt + 1e-9)!
    assert.deepEqual(after.entrance, { _tag: 'Lit' })
    assert.equal(after.light, 1)
  }
})

test('a lit room stays lit: no input starts an entrance again', () => {
  let entrance: Entrance = { _tag: 'Lit' }
  for (const input of [{ arrived: true }, { skip: true }, { still: true }, {}]) {
    entrance = advanceEntrance(entrance, { delta: 0.5, arrived: false, skip: false, still: false, ...input })
    assert.deepEqual(entrance, { _tag: 'Lit' })
  }
})

test('the strike is an uneven flicker that never flashes more than three times in a second', () => {
  // A flash is a rise and a fall. Six changes of level in one second are three flashes.
  const samples = run(8, 0.005, (_time, entrance) => ({ arrived: entrance._tag === 'Walking' && entrance.age >= 2.6 }))
  const levels = samples.map(sample => sample.light)
  assert.ok(levels.every(level => level >= 0 && level <= 1))
  const strike = samples.filter(sample => sample.entrance._tag === 'Striking')
  const shown = [...new Set(strike.map(sample => sample.light))]
  assert.ok(shown.length >= 4, 'The strike shows several levels.')
  assert.ok(strike.some((sample, index) => index > 0 && sample.light < strike[index - 1]!.light), 'The light falls back before it holds.')
  for (let start = 0; start + 200 < levels.length; start += 5) {
    let changes = 0
    for (let index = start + 1; index <= start + 200; index++) if (levels[index] !== levels[index - 1]) changes++
    assert.ok(changes <= 6, `${changes} changes in the second from ${start * 0.005}.`)
  }
})

test('he is held from the dark to the end of his greeting, faces the switch until the tubes hold, and watches the visitor in the dark and in the greeting', () => {
  const samples = run(12, 1 / 60, (_time, entrance) => ({ arrived: entrance._tag === 'Walking' && entrance.age >= 2.6 }))
  for (const { entrance } of samples) {
    const act = entranceAct(entrance)
    assert.equal(act.held, entrance._tag !== 'Lit', entrance._tag)
    assert.equal(act.facesSwitch, ['Walking', 'Reaching', 'Striking'].includes(entrance._tag), entrance._tag)
    assert.equal(act.watches, entrance._tag === 'Dark' || entrance._tag === 'Greeting', entrance._tag)
    assert.equal(act.reach !== undefined, ['Reaching', 'Striking', 'Greeting'].includes(entrance._tag), entrance._tag)
  }
})

test('his hand is up for the whole strike, and both gestures are at rest before he is free', () => {
  const samples = run(12, 1 / 120, (_time, entrance) => ({ arrived: entrance._tag === 'Walking' && entrance.age >= 2.6 }))
  const pose = (entrance: Entrance) => {
    const act = entranceAct(entrance)
    return { reach: act.reach === undefined ? undefined : poseMannerisms([{ mannerism: { _tag: 'ReachSwitch' }, age: act.reach }]),
      greet: act.greet === undefined ? undefined : poseMannerisms([{ mannerism: { _tag: 'Greet' }, age: act.greet }]) }
  }
  // The reach has one clock from his first move to the end, so the arm never starts again at a change of phase.
  const reaches = samples.map(sample => entranceAct(sample.entrance).reach).filter(age => age !== undefined)
  for (const [index, age] of reaches.entries()) if (index > 0) assert.ok(age > reaches[index - 1]! && age - reaches[index - 1]! < 0.02)
  const full = poseMannerisms([{ mannerism: { _tag: 'ReachSwitch' }, age: mannerismDuration({ _tag: 'ReachSwitch' }) / 2 }]).turns['left-shoulder']![0]
  for (const sample of samples.filter(sample => sample.entrance._tag === 'Striking')) {
    assert.ok(Math.abs(pose(sample.entrance).reach!.turns['left-shoulder']![0] / full) > 0.97, 'His arm must be at the switch while the tubes strike.')
  }
  // The last frame of the greeting is the last frame that poses either gesture. Both must have settled, or he would snap to rest.
  const last = samples.findLast(sample => sample.entrance._tag === 'Greeting')!
  assert.ok(atRest(pose(last.entrance).reach!) && atRest(pose(last.entrance).greet!))
  // The greeting waits for his turn to the visitor, and then it shows.
  const greeting = samples.filter(sample => sample.entrance._tag === 'Greeting')
  assert.ok(atRest(pose(greeting[0]!.entrance).greet!))
  assert.ok(greeting.some(sample => !atRest(pose(sample.entrance).greet!)))
})

test('he reaches with the arm on the viewer\'s side, whichever side the wall is on', () => {
  const right = poseMannerisms([{ mannerism: { _tag: 'ReachSwitch' }, age: 0.9, side: 1 }])
  const left = poseMannerisms([{ mannerism: { _tag: 'ReachSwitch' }, age: 0.9, side: -1 }])
  assert.ok(right.turns['left-shoulder'] && !right.turns['right-shoulder'])
  assert.ok(left.turns['right-shoulder'] && !left.turns['left-shoulder'])
  // The two poses mirror each other: the same lift, and the opposite swing and head turn.
  assert.equal(left.turns['right-shoulder']![0], right.turns['left-shoulder']![0])
  assert.equal(left.turns['right-shoulder']![2], -right.turns['left-shoulder']![2])
  assert.equal(left.turns.head![1], -right.turns.head![1])
})

test('with the lamps out he has no stage light and no shadow, and the lit room keeps its look', () => {
  // The office's look: white tubes from above and clear shadows on a bright floor.
  const look: SetMascot = { shading: { tint: [0.8, 0.8, 0.79], occlusion: 1.3, untinted: [] }, key: { colour: '#E9F0E4', rest: 2.5, talk: 9 },
    rim: { colour: '#9CC8C4', rest: 0, talk: 2 }, shadow: { body: 0.62, foot: 0.86 }, vignette: 'Light' }
  assert.equal(mascotInLight(look, 1), look)
  assert.equal(mascotInLight(look, 3), look)
  const out = mascotInLight(look, 0)
  assert.deepEqual([out.key.rest, out.key.talk, out.rim.rest, out.rim.talk, out.shadow.body, out.shadow.foot], [0, 0, 0, 0, 0, 0])
  assert.equal(out.vignette, 'Heavy')
  assert.deepEqual(mascotInLight(look, -2), out)
  // His tint is his skin, not his light, so it stays. The colours of his lamps stay too.
  assert.equal(out.shading, look.shading)
  assert.equal(out.key.colour, look.key.colour)
  const half = mascotInLight(look, 0.6)
  assert.ok(Math.abs(half.key.rest - look.key.rest * 0.6) < 1e-12 && Math.abs(half.shadow.foot - look.shadow.foot * 0.6) < 1e-12)
  assert.equal(half.vignette, look.vignette)
})
