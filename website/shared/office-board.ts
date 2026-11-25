import { markInk as ink, paintOfficeMarks } from '../layers/brand/shared/office-marks.ts'
import type { MarkPainter } from '../layers/brand/shared/office-marks.ts'
import { creatureKinds, specimenCount } from './office-experiment.ts'
import type { Creature, Experiment } from './office-experiment.ts'

/**
 * The whiteboard during the office experiment. He keeps the count on it: a band across the top that fills to the target,
 * and one bar for each creature. It is drawn on the room's own sheet, in whole pixels, with no letter and no number, as the rest of the sheet is.
 * A run with no specimens shows the board as the room has it.
 */
// One bar reaches the top of the graph at this share of the target. Four creatures share the count, so a bar seldom needs more.
const barShare = 0.4
const band = { left: 6, top: 4, width: 180, height: 7 }
const graph = { left: 10, top: 22, base: 97, bar: 12, step: 17 }

// Each creature as a few pixels, under its bar: left, top, width, height from the bar's left edge and the base line.
const glyphs: Record<Creature, readonly (readonly [x: number, y: number, width: number, height: number])[]> = {
  snail: [[1, 5, 9, 2], [2, 2, 5, 3], [3, 1, 3, 1], [9, 3, 1, 2]],
  beetle: [[2, 2, 7, 4], [9, 3, 2, 2], [1, 6, 1, 1], [5, 6, 1, 1], [9, 6, 1, 1], [5, 2, 1, 4]],
  fly: [[4, 3, 4, 3], [1, 2, 3, 2], [8, 2, 3, 2], [5, 6, 2, 1]],
  cricket: [[2, 3, 7, 2], [9, 2, 2, 2], [1, 1, 2, 2], [0, 5, 4, 1], [6, 5, 1, 2]],
}

/** Draws the whole sheet: the room's marks, and over the whiteboard the count of a run that has one. */
export function paintExperimentBoard(painter: MarkPainter, experiment: Experiment | null) {
  paintOfficeMarks(painter)
  if (!experiment) return
  const count = specimenCount(experiment)
  if (count === 0) return
  const rect = (x: number, y: number, width: number, height: number, colour: string) => { painter.fillStyle = colour; painter.fillRect(x, y, width, height) }
  // He wiped the notes and the old graph for the count. The diagram of the experiment stays.
  rect(2, 2, 86, 104, ink.board)
  rect(88, 2, 102, 10, ink.board)
  rect(14, 30, 40, 7, ink.smudge); rect(46, 70, 30, 9, ink.smudge)
  const share = Math.min(1, count / experiment.target)
  // The band fills to the rust mark at its end: the target.
  rect(band.left, band.top, band.width, 1, ink.chitin); rect(band.left, band.top + band.height - 1, band.width, 1, ink.chitin)
  rect(band.left, band.top, 1, band.height, ink.chitin)
  rect(band.left + 1, band.top + 1, Math.round((band.width - 2) * share), band.height - 2, share >= 0.9 ? ink.rust : ink.teal)
  rect(band.left + band.width - 1, band.top - 2, 2, band.height + 4, ink.rust)
  rect(graph.left, graph.top, 1, graph.base - graph.top + 1, ink.chitin); rect(graph.left, graph.base + 1, 74, 1, ink.chitin)
  creatureKinds.forEach((kind, index) => {
    const left = graph.left + 5 + index * graph.step
    const height = Math.round((graph.base - graph.top - 2) * Math.min(1, experiment.tally[kind] / (experiment.target * barShare)))
    // A creature with one specimen already shows one row.
    const shown = experiment.tally[kind] > 0 ? Math.max(1, height) : 0
    rect(left, graph.base + 1 - shown, graph.bar, shown, ink.teal)
    for (const [x, y, width, tall] of glyphs[kind]) rect(left + x, graph.base + 2 + y, width, tall, ink.chitin)
  })
}
