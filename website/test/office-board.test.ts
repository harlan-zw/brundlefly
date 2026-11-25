import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paintExperimentBoard } from '../shared/office-board.ts'
import { creatureKinds, emptyExperiment } from '../shared/office-experiment.ts'
import type { Creature, Experiment, Tally } from '../shared/office-experiment.ts'
import { markInk, markPixels, marksSize, paintOfficeMarks } from '../layers/brand/shared/office-marks.ts'
import type { MarkPainter } from '../layers/brand/shared/office-marks.ts'

type Sheet = readonly string[]
/** Paints on a grid of colours as a canvas would: whole pixels, clipped to the sheet. A clear pixel is an empty string. */
function paint(draw: (painter: MarkPainter) => void): Sheet {
  const pixels = Array<string>(marksSize * marksSize).fill('')
  const fill = (x: number, y: number, width: number, height: number, colour: string) => {
    // A pixel is covered when its middle is inside the rectangle. A rectangle with no width or no height covers nothing.
    const left = Math.max(0, Math.ceil(Math.min(x, x + width) - 0.5)), right = Math.min(marksSize, Math.ceil(Math.max(x, x + width) - 0.5))
    const top = Math.max(0, Math.ceil(Math.min(y, y + height) - 0.5)), bottom = Math.min(marksSize, Math.ceil(Math.max(y, y + height) - 0.5))
    for (let row = top; row < bottom; row++) pixels.fill(colour, row * marksSize + left, row * marksSize + Math.max(left, right))
  }
  const painter: MarkPainter = {
    fillStyle: '#000000',
    fillRect: (x, y, width, height) => fill(x, y, width, height, String(painter.fillStyle)),
    clearRect: (x, y, width, height) => fill(x, y, width, height, ''),
  }
  draw(painter)
  return pixels
}
const at = (sheet: Sheet, x: number, y: number) => sheet[y * marksSize + x]!
const [boardLeft, boardTop, boardWidth, boardHeight] = markPixels('whiteboard')
const onBoard = (x: number, y: number) => x >= boardLeft && x < boardLeft + boardWidth && y >= boardTop && y < boardTop + boardHeight

const target = 3000
const experiment = (counts: Partial<Tally>): Experiment => ({ ...emptyExperiment(1, target), tally: { snail: 0, beetle: 0, fly: 0, cricket: 0, ...counts } })
const board = (counts: Partial<Tally> | null) => paint(painter => paintExperimentBoard(painter, counts && experiment(counts)))
const roomBoard = paint(paintOfficeMarks)
const band = (colour: string) => colour === markInk.teal || colour === markInk.rust

/** The band at the target: the longest run of band ink in a row of the whiteboard. */
const full = (() => {
  const sheet = board({ fly: target })
  let best = { x: 0, y: 0, length: 0 }
  for (let y = boardTop; y < boardTop + boardHeight; y++) {
    for (let x = boardLeft, run = 0; x < boardLeft + boardWidth; x++) {
      run = band(at(sheet, x, y)) ? run + 1 : 0
      if (run > best.length) best = { x: x - run + 1, y, length: run }
    }
  }
  return best
})()
/** How far the band reaches from its start, in its row. */
const fill = (sheet: Sheet) => {
  let length = 0
  while (full.x + length < boardLeft + boardWidth && band(at(sheet, full.x + length, full.y))) length++
  return length
}
/** The colour of the band where it starts. */
const bandColour = (count: number) => at(board({ fly: count }), full.x, full.y)
/** The rows of the band: the rows where band ink starts the band at the target. Each creature's bar stands below them. */
const bandRows = new Set(Array.from({ length: boardHeight }, (_, row) => boardTop + row).filter(y => band(at(board({ fly: target }), full.x, y))))
/** The bar pixels of a sheet: teal on the whiteboard, outside the band. */
const barPixels = (sheet: Sheet) => {
  const pixels = new Set<string>()
  for (let y = boardTop; y < boardTop + boardHeight; y++) {
    if (bandRows.has(y)) continue
    for (let x = boardLeft; x < boardLeft + boardWidth; x++) if (at(sheet, x, y) === markInk.teal) pixels.add(`${x},${y}`)
  }
  return pixels
}
/**
 * The pixels of one creature's bar: teal that goes when its specimens move to another creature.
 * The count stays the same, so the band stays the same.
 */
function bar(counts: Partial<Tally>, kind: Creature) {
  const other = creatureKinds.find(other => other !== kind)!
  const moved = board({ ...counts, [kind]: 0, [other]: (counts[other] ?? 0) + (counts[kind] ?? 0) })
  const sheet = board(counts)
  const after = barPixels(moved)
  return [...barPixels(sheet)].filter(pixel => !after.has(pixel))
}
const rows = (pixels: readonly string[]) => new Set(pixels.map(pixel => pixel.split(',')[1])).size

test('with no run, or a run with no specimens, the sheet is the room\'s own sheet', () => {
  assert.deepEqual(board(null), roomBoard)
  assert.deepEqual(board({}), roomBoard)
})

test('a count changes the whiteboard and nothing else on the sheet', () => {
  const sheet = board({ snail: 40, fly: 3 })
  let changed = 0
  for (let y = 0; y < marksSize; y++) {
    for (let x = 0; x < marksSize; x++) {
      if (onBoard(x, y)) changed += at(sheet, x, y) === at(roomBoard, x, y) ? 0 : 1
      else assert.equal(at(sheet, x, y), at(roomBoard, x, y), `Pixel ${x},${y} is off the whiteboard.`)
    }
  }
  assert.ok(changed > 0)
})

test('the band grows with the count and is full at the target', () => {
  const shares = [0.05, 0.1, 0.25, 0.5, 0.75, 0.89, 0.9, 0.99, 1]
  const lengths = shares.map(share => fill(board({ fly: Math.round(target * share) })))
  for (const [index, length] of lengths.entries()) if (index > 0) assert.ok(length >= lengths[index - 1]!, `The band shrank at ${shares[index]} of the target.`)
  assert.ok(lengths[1]! > 0)
  assert.ok(lengths[3]! > lengths[1]!)
  assert.ok(lengths.at(-1)! > lengths[3]!)
  // At the target the band closes the gap to the rust mark at its end. The mark is the last rust in the band's row while the count is low.
  const low = board({ fly: target / 10 })
  let mark = boardLeft + boardWidth - 1
  while (at(low, mark, full.y) !== markInk.rust) mark--
  assert.ok(mark > full.x + lengths[1]!, 'The mark stands apart from a low band.')
  assert.equal(full.x + fill(board({ fly: target })) - 1, mark)
  // A count past the target draws no more than the target does.
  assert.deepEqual(paint(painter => paintExperimentBoard(painter, { ...experiment({ fly: target * 2 }), criticalAt: 1 })), board({ fly: target }))
})

test('the band turns rust from nine tenths of the target', () => {
  for (const share of [0.1, 0.5, 0.89]) assert.equal(bandColour(Math.round(target * share)), markInk.teal, `At ${share} of the target.`)
  for (const share of [0.9, 0.95, 1]) assert.equal(bandColour(Math.round(target * share)), markInk.rust, `At ${share} of the target.`)
})

test('a creature with more specimens has a taller bar, one specimen shows a row, and none shows nothing', () => {
  const counts: Partial<Tally> = { snail: 300, beetle: 100, fly: 1, cricket: 0 }
  const [snail, beetle, fly] = [bar(counts, 'snail'), bar(counts, 'beetle'), bar(counts, 'fly')]
  assert.ok(rows(snail) > rows(beetle), `Snail ${rows(snail)} rows, beetle ${rows(beetle)} rows.`)
  assert.ok(rows(beetle) > rows(fly))
  assert.ok(rows(fly) >= 1)
  // The cricket has no specimens: every bar pixel on the board belongs to the other three.
  assert.deepEqual([...barPixels(board(counts))].sort(), [...snail, ...beetle, ...fly].sort())
  // A bar stops at the top of the graph: one creature with half the target stands no taller than one with all of it.
  assert.equal(rows(bar({ snail: target / 2 }, 'snail')), rows(bar({ snail: target - 1 }, 'snail')))
})
