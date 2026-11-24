import assert from 'node:assert/strict'
import { test } from 'node:test'
import { arcCount, arcGlow, arcSeconds, crashSeconds, criticalAct, criticalAddressAt, criticalArc, criticalDarkAt, criticalFrame, criticalRushAt, criticalSpurtAt, criticalStruckAt, criticalTimes } from '../shared/office-critical.ts'
import type { CriticalFrame } from '../shared/office-critical.ts'
import { criticalSceneSeconds } from '../shared/office-experiment.ts'

const step = 0.005
type Sample = { age: number, frame: CriticalFrame }
/** Samples the scene every 5 ms. Each age is computed from its index, so no error builds up. */
const sample = (still: boolean, from = 0, to = criticalSceneSeconds): Sample[] => {
  const samples: Sample[] = []
  for (let index = Math.round(from / step); index * step <= to + 1e-9; index++) samples.push({ age: index * step, frame: criticalFrame(index * step, still) })
  return samples
}
const changes = (levels: readonly number[]) => levels.filter((level, index) => index > 0 && level !== levels[index - 1]).length

test('the phases fill the whole scene, and the picture is dark before the scene ends', () => {
  const { surge, pull, lull, spurt, strike, flash, dark } = criticalTimes
  assert.ok(Math.abs(surge + pull + lull + spurt + strike + flash + dark - criticalSceneSeconds) < 1e-9)
  // The scene changes the set behind the dark. It needs dark time to do that.
  assert.ok(criticalDarkAt < criticalSceneSeconds)
  assert.ok(Math.abs(criticalSceneSeconds - criticalDarkAt - dark) < 1e-9)
})

test('the tubes never change level more than six times in any one second, so they never flash more than three times a second', () => {
  const levels = sample(false).map(({ frame }) => frame.light)
  // The tubes do stutter: the test must not pass on a steady light.
  assert.ok(changes(levels) >= 6)
  const window = Math.round(1 / step)
  for (let start = 0; start + window < levels.length; start++) {
    const count = changes(levels.slice(start, start + window + 1))
    assert.ok(count <= 6, `${count} changes in the second from ${(start * step).toFixed(3)} s.`)
  }
})

test('the picture is fully dark from the dark time to the end, with the tubes out and no flash', () => {
  for (const still of [false, true]) {
    for (const { age, frame } of [{ age: criticalDarkAt, frame: criticalFrame(criticalDarkAt, still) }, ...sample(still, criticalDarkAt)]) {
      assert.equal(frame.shade, 1, `Shade ${frame.shade} at ${age} s, still: ${still}.`)
      assert.equal(frame.light, 0, `Light ${frame.light} at ${age} s, still: ${still}.`)
      assert.equal(frame.flash, 0, `Flash ${frame.flash} at ${age} s, still: ${still}.`)
    }
  }
})

test('the flash comes only after the tubes go out, and covers the whole picture at its peak', () => {
  const samples = sample(false)
  const out = samples.find(({ frame }) => frame.light === 0)!
  assert.ok(out.age < criticalDarkAt)
  for (const { age, frame } of samples.filter(({ age }) => age < out.age)) assert.equal(frame.flash, 0, `Flash ${frame.flash} at ${age} s, before the tubes went out.`)
  assert.equal(Math.max(...samples.map(({ frame }) => frame.flash)), 1)
  // The camera stops shaking when the light takes the picture.
  for (const { age, frame } of samples.filter(({ frame }) => frame.flash > 0)) assert.equal(frame.shake, 0, `Shake ${frame.shake} at ${age} s, in the flash.`)
})

test('the chamber draws the specimens in from none to all, never lets one go, and is done before the flash', () => {
  for (const still of [false, true]) {
    const samples = sample(still)
    assert.equal(samples[0]!.frame.pull, 0)
    assert.equal(samples.at(-1)!.frame.pull, 1)
    for (const [index, { age, frame }] of samples.entries()) if (index > 0) assert.ok(frame.pull >= samples[index - 1]!.frame.pull, `The pull fell at ${age} s, still: ${still}.`)
  }
  // The specimens are gone before the light takes the picture.
  const samples = sample(false)
  const flashStart = samples.find(({ frame }) => frame.flash > 0)!
  const pulled = samples.find(({ frame }) => frame.pull === 1)!
  assert.ok(pulled.age < flashStart.age, `The pull ended at ${pulled.age} s, the flash started at ${flashStart.age} s.`)
})

test('with reduced motion the room goes dark once: no stutter, no shake, and no flash', () => {
  const samples = sample(true)
  for (const { age, frame } of samples) {
    assert.equal(frame.shake, 0, `Shake at ${age} s.`)
    assert.equal(frame.flash, 0, `Flash at ${age} s.`)
  }
  const levels = samples.map(({ frame }) => frame.light)
  assert.equal(changes(levels), 1)
  assert.equal(levels[0], 1)
  assert.equal(levels.at(-1), 0)
  assert.equal(criticalFrame(criticalDarkAt, true).shade, 1)
})

test('every value of every frame stays between 0 and 1, also for a clock that runs early or late', () => {
  for (const still of [false, true]) {
    for (const { age, frame } of sample(still, -1, criticalSceneSeconds + 2)) {
      for (const [name, value] of Object.entries(frame)) assert.ok(value >= 0 && value <= 1, `${name} is ${value} at ${age} s, still: ${still}.`)
    }
  }
})

test('a visitor at the computer is back in the room before the chamber draws the specimens in', () => {
  assert.ok(crashSeconds > 0.8, 'The failed screen stays long enough to read its first line')
  assert.ok(crashSeconds <= criticalTimes.surge)
  assert.equal(criticalFrame(crashSeconds, false).pull, 0)
})

test('the chamber spits its snails only after it has taken every specimen, and before the tubes go out', () => {
  let last = 0
  for (let age = 0; age <= criticalSceneSeconds; age += 0.01) {
    const { pull, spurt } = criticalFrame(age, false)
    // No snail leaves while a specimen is still on its way in.
    if (spurt > 0) assert.equal(pull, 1, `a snail is out at ${age.toFixed(2)} s while the chamber still pulls`)
    assert.ok(spurt >= last - 1e-12, 'The snails never go back in')
    last = spurt
  }
  assert.equal(criticalFrame(criticalSpurtAt, false).spurt, 0)
  assert.ok(criticalFrame(criticalSpurtAt + 0.5, false).spurt > 0)
  // The room sees all of them land in the light.
  assert.equal(criticalFrame(criticalStruckAt - criticalTimes.strike, false).spurt, 1)
  assert.ok(criticalFrame(criticalSpurtAt + criticalTimes.spurt / 2, false).light > 0.3)
})

test('without motion the specimens go and the snails come at once, each at its moment', () => {
  assert.equal(criticalFrame(criticalSpurtAt - 0.01, true).spurt, 0)
  assert.equal(criticalFrame(criticalSpurtAt, true).spurt, 1)
  assert.equal(criticalFrame(criticalTimes.surge, true).pull, 1)
})

test('green arcs strike through the scene, faster toward its end, and never more than three times a second', () => {
  // The start of each arc, found by stepping through the scene.
  const starts: number[] = []
  let last = -1
  for (let age = 0; age <= criticalSceneSeconds; age += 0.005) {
    const arc = criticalArc(age, false)
    if (arc && arc.index !== last) { starts.push(age); last = arc.index }
    if (arc) assert.ok(arc.life >= 0 && arc.life < 1)
  }
  assert.equal(starts.length, arcCount)
  assert.ok(arcCount >= 12, 'The scene has enough arcs to read as a storm')
  for (let index = 1; index < starts.length; index++) assert.ok(starts[index]! - starts[index - 1]! >= 0.39, 'Two arcs come too close together')
  // The gaps shrink: the storm builds.
  assert.ok(starts[1]! - starts[0]! > starts.at(-1)! - starts.at(-2)!)
  // No arc burns after the tubes are out: the light of the chamber has the picture then.
  assert.ok(starts.at(-1)! <= criticalStruckAt + 0.01)
  assert.equal(criticalArc(criticalStruckAt + arcSeconds, false), undefined)
  assert.equal(criticalArc(criticalSceneSeconds, false), undefined)
})

test('an arc flares, dips, flares again, and dies, and reduced motion has no arcs', () => {
  assert.equal(arcGlow(0), 1)
  assert.ok(arcGlow(0.2) < 0.5)
  assert.equal(arcGlow(0.45), 1)
  assert.ok(arcGlow(0.95) < 0.2)
  assert.equal(arcGlow(1), 0)
  for (let life = 0; life <= 1; life += 0.01) assert.ok(arcGlow(life) >= 0 && arcGlow(life) <= 1)
  for (let age = 0; age <= criticalSceneSeconds; age += 0.05) assert.equal(criticalArc(age, true), undefined)
})

test('he has work for every moment of the scene: he peers, flinches, types, and then speaks to the visitor', () => {
  const works = sample(false).map(({ age }) => criticalAct(age).work)
  // Each act comes once, in order, and none returns.
  assert.deepEqual(works.filter((work, index) => work !== works[index - 1]), ['Peer', 'Flinch', 'Type', 'Address'])
  // A clock that runs early or late still gives him work.
  assert.equal(criticalAct(-3).work, 'Peer')
  assert.equal(criticalAct(criticalSceneSeconds + 60).work, 'Address')
})

test('he stays at the chamber until it spits snails at him, and only then runs to the computer', () => {
  for (const { age, frame } of sample(false)) {
    const { place, work } = criticalAct(age)
    assert.equal(place, work === 'Peer' || work === 'Flinch' ? 'Chamber' : 'Computer')
    // He flinches only while snails come out.
    if (work === 'Flinch') assert.ok(age >= criticalSpurtAt && frame.spurt >= 0)
    if (place === 'Computer') assert.ok(frame.spurt > 0, `He left at ${age} s, before a snail came out.`)
  }
  // He has time to flinch before he runs, and time at the keys before he gives up.
  assert.ok(criticalRushAt - criticalSpurtAt >= 1)
  assert.ok(criticalAddressAt - criticalRushAt >= 4)
})

test('he turns to the visitor while the room is still lit, before the last strike takes the tubes', () => {
  assert.ok(criticalAddressAt < criticalStruckAt)
  assert.ok(criticalStruckAt - criticalAddressAt >= 1.5, 'He needs time to turn and be seen.')
  assert.ok(criticalFrame(criticalAddressAt, false).shade < 0.5)
})
