import assert from 'node:assert/strict'
import { test } from 'node:test'
import { caveLines, countingLine, criticalLines, leadingCreature, leadShiftLine, lineSeconds } from '../shared/office-script.ts'
import { criticalAct, criticalAddressAt, criticalDarkAt, criticalSpurtAt, criticalTimes } from '../shared/office-critical.ts'
import { beatMannerism } from '../layers/brand/shared/mannerism.ts'
import { creatureKinds, criticalSceneSeconds, emptyExperiment } from '../shared/office-experiment.ts'
import type { Creature, Experiment, Tally } from '../shared/office-experiment.ts'

const experiment = (counts: Partial<Tally>): Experiment => ({ ...emptyExperiment(1), tally: { snail: 0, beetle: 0, fly: 0, cricket: 0, ...counts } })
type Spoken = { count: number, line: string, beat: string }
/** Counts from zero to the target in batches of the given sizes, in turn, and keeps every line he says. */
function walk(target: number, batches: readonly number[] = [1]): Spoken[] {
  const spoken: Spoken[] = []
  for (let count = 0, turn = 0; count < target; turn++) {
    const after = Math.min(target, count + batches[turn % batches.length]!)
    const line = countingLine(count, after, target)
    if (line !== undefined) spoken.push({ count: after, line: line.text, beat: line.beat })
    count = after
  }
  return spoken
}

test('he speaks at the first specimen, at 15%, at each quarter of the target, and near the end, once each', () => {
  assert.deepEqual(walk(3000).map(({ count }) => count), [1, 450, 750, 1500, 2250, 2700])
  // At a small target the milestones fall between two counts. He speaks at the first count past each one.
  assert.deepEqual(walk(50).map(({ count }) => count), [1, 8, 13, 25, 38, 45])
  for (const target of [50, 3000, 20000]) {
    const lines = walk(target).map(({ line }) => line)
    assert.equal(new Set(lines).size, lines.length, `He repeated a line at a target of ${target}.`)
  }
})

test('his first line and milestones react to the leading creature, and mid-run lead shifts trigger an aside', () => {
  for (const kind of creatureKinds) {
    const one = countingLine(0, 1, 800, kind)!
    const many = countingLine(0, 5, 800, kind)!
    assert.match(one.text, new RegExp(`^One ${kind}\\.`, 'i'))
    assert.match(many.text, /^5\./)
    assert.notEqual(one.text, many.text)
    // 25%, 50%, 75%, and 90% adapt to what leads.
    assert.notEqual(countingLine(199, 200, 800, kind)!.text, countingLine(199, 200, 800, kind === 'fly' ? 'snail' : 'fly')!.text)
    assert.notEqual(countingLine(399, 400, 800, kind)!.text, countingLine(399, 400, 800, kind === 'fly' ? 'snail' : 'fly')!.text)
    assert.notEqual(countingLine(599, 600, 800, kind)!.text, countingLine(599, 600, 800, kind === 'fly' ? 'snail' : 'fly')!.text)
    const shifted = leadShiftLine(kind === 'fly' ? 'snail' : 'fly', kind, 0.35)!
    assert.ok(shifted && beatMannerism(shifted.beat)._tag !== 'None')
  }
  assert.equal(leadShiftLine('fly', 'fly', 0.35), undefined)
  assert.equal(leadShiftLine('fly', 'snail', 0.05), undefined)
  assert.equal(leadShiftLine('fly', 'snail', 0.9), undefined)
})

test('taps in batches give the same lines as single taps, each said once at the first batch past its milestone', () => {
  const single = walk(3000)
  // Uneven batches, up to the most taps one visitor can send in a second.
  const batched = walk(3000, [7, 20, 3, 13, 1, 19])
  assert.equal(batched.length, single.length)
  assert.equal(batched[0]!.count, 7, 'He speaks at the first batch.')
  // A milestone line can name the count, which differs between the two walks.
  const words = (spoken: readonly Spoken[]) => spoken.slice(1).map(({ line }) => line.replace(/[\d,]+/g, '#'))
  assert.deepEqual(words(batched), words(single))
  for (const [index, { count }] of batched.entries()) assert.ok(count >= single[index]!.count && count < single[index]!.count + 20)
})

test('he says nothing between milestones, when the count does not rise, or at the target', () => {
  assert.equal(countingLine(751, 760, 3000), undefined)
  assert.equal(countingLine(1, 2, 3000), undefined)
  assert.equal(countingLine(5, 5, 3000), undefined)
  // A new run drops the count. That is no milestone.
  assert.equal(countingLine(2800, 0, 3000), undefined)
  assert.equal(countingLine(2800, 10, 3000), undefined)
  // The critical scene speaks at the target, so the count says nothing there, even when the batch crosses a milestone.
  assert.equal(countingLine(2999, 3000, 3000), undefined)
  assert.equal(countingLine(2600, 3000, 3000), undefined)
  assert.equal(countingLine(0, 3000, 3000), undefined)
  assert.equal(countingLine(2999, 3500, 3000), undefined)
})

test('when one batch crosses two milestones he says the later one', () => {
  const half = countingLine(1499, 1500, 3000)!
  const nearly = countingLine(2699, 2700, 3000)!
  assert.deepEqual(countingLine(700, 1600, 3000), half)
  assert.deepEqual(countingLine(0, 1600, 3000), half, 'The milestone wins over the first line.')
  assert.deepEqual(countingLine(0, 2999, 3000), nearly)
  assert.notEqual(half.text, nearly.text)
})

test('a line names the count as people read it, with no placeholder left', () => {
  for (const target of [50, 3000, 20000]) {
    for (const { line } of walk(target)) assert.doesNotMatch(line, /[{}]/, `At a target of ${target}: ${line}`)
  }
  assert.match(countingLine(749, 750, 3000)!.text, /\b750\b/)
  assert.match(countingLine(4999, 5000, 20000)!.text, /\b5,000\b/)
  // The first state of a run can hold several specimens. His first line names the count he has.
  assert.match(countingLine(0, 7, 3000)!.text, /\b7\b/)
})

test('his critical lines come in order, inside the scene, before the picture goes black', () => {
  assert.ok(criticalLines.length > 0)
  for (const [index, { at }] of criticalLines.entries()) {
    assert.ok(at >= 0 && at < criticalSceneSeconds)
    // A line said into a black picture is lost.
    assert.ok(at < criticalDarkAt, `A line starts at ${at} s, the dark is full at ${criticalDarkAt} s.`)
    if (index > 0) assert.ok(at > criticalLines[index - 1]!.at)
  }
})

test('the creature with the most specimens leads, and a tie goes to the first creature in key order', () => {
  assert.equal(leadingCreature(experiment({ snail: 3, beetle: 9, fly: 8, cricket: 1 })), 'beetle')
  assert.equal(leadingCreature(experiment({ cricket: 1 })), 'cricket')
  for (const [index, first] of creatureKinds.entries()) {
    for (const second of creatureKinds.slice(index + 1)) {
      assert.equal(leadingCreature(experiment({ [first]: 5, [second]: 5 })), first, `${first} and ${second} tie.`)
    }
  }
})

test('his last cave line names the real count, and says snails came out whatever led', () => {
  for (const [index, kind] of creatureKinds.entries()) {
    const counts: Partial<Tally> = Object.fromEntries(creatureKinds.map(other => [other, other === kind ? 1200 + index : 1]))
    const last = caveLines(experiment(counts)).at(-1)!.text
    assert.match(last, new RegExp(`\\b1,${203 + index} specimens went in\\b`), last)
    assert.match(last, /\bSnails came out\b/, last)
    // The creature that led has no part in what came out.
    for (const other of ['beetles', 'flies', 'crickets']) assert.doesNotMatch(last, new RegExp(`\\b${other}\\b`), last)
  }
})

test('a run with one specimen or none still gets a cave line that reads right', () => {
  assert.match(caveLines(experiment({ fly: 1 })).at(-1)!.text, /^One specimen went in\. Snails came out\./)
  const empty = caveLines(experiment({})).at(-1)!.text
  assert.doesNotMatch(empty, /specimen/)
  assert.match(empty, /^Snails came out\./)
})

test('he says that something is wrong while the chamber spits snails, not before', () => {
  const wrong = criticalLines.find(line => /not right/.test(line.text))
  assert.ok(wrong, 'He has a line for the fault')
  assert.ok(wrong.at > criticalSpurtAt && wrong.at < criticalSpurtAt + criticalTimes.spurt / 2)
})

test('every beat of his lines is a gesture he can perform, and each counting line has one', () => {
  const counted = walk(3000)
  // A counting line comes while he does his rounds. Without a gesture he would say it with still hands.
  for (const { line, beat } of counted) assert.notEqual(beatMannerism(beat)._tag, 'None', `No gesture for: ${line}`)
  assert.equal(new Set(counted.map(({ beat }) => beat)).size, counted.length, 'Two counting lines share a gesture.')
  for (const { text, beat } of caveLines(experiment({ fly: 40 }))) if (beat) assert.notEqual(beatMannerism(beat)._tag, 'None', `No gesture for: ${text}`)
  // The critical scene moves him itself. A beat on one of its lines would add a second gesture to the one he performs.
  for (const { text, beat } of criticalLines) assert.equal(beat, '', text)
})

test('each critical line falls in the act it belongs to: the count, the fault, the keys, and the visitor', () => {
  const works = criticalLines.map(({ at }) => criticalAct(at).work)
  assert.deepEqual(works, ['Peer', 'Flinch', 'Type', 'Address'])
  // His last line starts as he turns, so the visitor sees his face for all of it that the light allows.
  const last = criticalLines.at(-1)!
  assert.ok(last.at >= criticalAddressAt && last.at < criticalAddressAt + 0.5)
})

test('a longer line stays longer, between a floor for short lines and a ceiling for long ones', () => {
  const seconds = (length: number) => lineSeconds('a'.repeat(length))
  for (let length = 1; length <= 300; length++) assert.ok(seconds(length) >= seconds(length - 1))
  assert.ok(seconds(70) > seconds(50))
  // A short line still stays long enough to see, and a very long one does not hold the screen for ever.
  assert.ok(seconds(0) > 0)
  assert.equal(seconds(1), seconds(0))
  assert.equal(seconds(10_000), seconds(1000))
  // Every line he says stays long enough to read at 15 characters a second.
  const lines = [...walk(20000), ...walk(50)].map(({ line }) => line)
    .concat(criticalLines.map(({ text }) => text), caveLines(experiment({ fly: 19_999 })).map(({ text }) => text))
  for (const line of lines) assert.ok(lineSeconds(line) >= line.length / 15, `${lineSeconds(line)} s for: ${line}`)
})
