/**
 * The drawn surfaces of the office on one small sheet: the whiteboard, the clock face, the door sign, the mug's label, and the keyboard's keys.
 * Each has its own region of the sheet and its own flat face in the room. Text can come later as a new drawing in a region, or as an image with the same regions.
 * Nothing on the sheet is a letter, a number, or a word.
 */
export const marksSize = 256
// Each region in sheet pixels: left, top, width, height.
const regions = {
  whiteboard: [0, 0, 192, 108],
  clock: [200, 0, 48, 48],
  sign: [0, 116, 64, 24],
  label: [72, 116, 32, 16],
  keys: [112, 116, 96, 36],
} as const
export type MarkName = keyof typeof regions
export type UvRect = readonly [u0: number, v0: number, u1: number, v1: number]

/** Where a region lies on the sheet, for a face that shows it. The sheet's top row is the top of the face. */
export const markRegion = (name: MarkName): UvRect => {
  const [left, top, width, height] = regions[name]
  return [left / marksSize, 1 - (top + height) / marksSize, (left + width) / marksSize, 1 - top / marksSize]
}

const ink = { board: '#D8DACB', smudge: '#C6CABA', chitin: '#343C3B', rust: '#AA604B', teal: '#418B90', cream: '#E8D4A6', olive: '#777648', bruise: '#69404B', night: '#080B08', wing: '#A4B5A0' }
/** The drawing calls the sheet needs. A 2D canvas context has them. */
export type MarkPainter = Pick<CanvasRenderingContext2D, 'fillRect' | 'clearRect'> & { fillStyle: string | CanvasGradient | CanvasPattern }

/** Draws the whole sheet with whole pixels only, so every edge stays hard. */
export function paintOfficeMarks(painter: MarkPainter) {
  const rect = (x: number, y: number, width: number, height: number, colour: string) => { painter.fillStyle = colour; painter.fillRect(x, y, width, height) }
  const line = (x0: number, y0: number, x1: number, y1: number, colour: string) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let step = 0; step <= steps; step++) rect(Math.round(x0 + (x1 - x0) * step / steps), Math.round(y0 + (y1 - y0) * step / steps), 1, 1, colour)
  }
  const ring = (x: number, y: number, radius: number, colour: string) => {
    for (let step = 0; step < 64; step++) rect(Math.round(x + Math.cos(step / 64 * Math.PI * 2) * radius), Math.round(y + Math.sin(step / 64 * Math.PI * 2) * radius), 1, 1, colour)
  }
  const outline = (x: number, y: number, width: number, height: number, colour: string) => {
    rect(x, y, width, 1, colour); rect(x, y + height - 1, width, 1, colour); rect(x, y, 1, height, colour); rect(x + width - 1, y, 1, height, colour)
  }
  const person = (x: number, y: number, colour: string) => {
    rect(x + 2, y, 3, 3, colour); line(x + 3, y + 3, x + 3, y + 9, colour); line(x, y + 5, x + 6, y + 5, colour)
    line(x + 3, y + 9, x + 1, y + 14, colour); line(x + 3, y + 9, x + 5, y + 14, colour)
  }
  const fly = (x: number, y: number) => {
    rect(x + 2, y + 3, 3, 3, ink.chitin); outline(x - 1, y, 3, 3, ink.chitin); outline(x + 5, y, 3, 3, ink.chitin)
  }
  painter.clearRect(0, 0, marksSize, marksSize)

  // The whiteboard: wiped notes, a graph, and the experiment as a diagram.
  rect(0, 0, 192, 108, ink.board)
  for (const [x, y, width, height] of [[20, 40, 50, 9], [118, 6, 40, 5], [80, 84, 36, 12], [150, 90, 30, 8]] as const) rect(x, y, width, height, ink.smudge)
  for (let row = 0; row < 4; row++) {
    // Each note is a wavy scribble that breaks where a hand would lift.
    for (let x = 8; x < 66 - row * 9; x += 2) if ((x + row * 5) % 17 > 2) line(x, 10 + row * 8 + (x / 2 % 2 ? 2 : 0), x + 2, 10 + row * 8 + (x / 2 % 2 ? 0 : 2), ink.chitin)
  }
  line(10, 54, 10, 98, ink.chitin); line(10, 98, 76, 98, ink.chitin)
  for (let bar = 0; bar < 6; bar++) rect(16 + bar * 10, 97 - [6, 9, 8, 14, 22, 37][bar]!, 6, [6, 9, 8, 14, 22, 37][bar]!, ink.teal)
  for (let x = 0; x < 60; x++) rect(14 + x, Math.round(94 - Math.pow(x / 59, 3) * 36), 1, 2, ink.rust)
  outline(92, 12, 26, 30, ink.chitin); person(101, 20, ink.chitin)
  outline(92, 62, 26, 30, ink.chitin); fly(101, 73)
  line(120, 30, 138, 46, ink.chitin); line(120, 74, 138, 60, ink.chitin)
  line(138, 46, 133, 45, ink.chitin); line(138, 46, 137, 41, ink.chitin); line(138, 60, 133, 61, ink.chitin); line(138, 60, 137, 65, ink.chitin)
  ring(161, 53, 20, ink.rust); ring(162, 54, 21, ink.rust)
  person(158, 46, ink.chitin); line(158, 51, 152, 44, ink.chitin); line(164, 51, 170, 44, ink.chitin); line(158, 53, 153, 56, ink.chitin); line(164, 53, 169, 56, ink.chitin)
  for (let group = 0; group < 2; group++) {
    for (let mark = 0; mark < 4; mark++) line(130 + group * 22 + mark * 4, 88, 130 + group * 22 + mark * 4, 100, ink.bruise)
    line(128 + group * 22, 99, 144 + group * 22, 89, ink.bruise)
  }

  // The clock face: a disc with twelve ticks. The corners stay clear, so only the disc shows.
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if (Math.hypot(x - 23.5, y - 23.5) < 23.5) rect(200 + x, y, 1, 1, Math.hypot(x - 23.5, y - 23.5) > 21 ? ink.chitin : ink.cream)
  for (let tick = 0; tick < 12; tick++) {
    const angle = tick / 12 * Math.PI * 2
    rect(Math.round(223 + Math.sin(angle) * 17.5), Math.round(23 - Math.cos(angle) * 17.5), 2, 2, tick % 3 === 0 ? ink.rust : ink.chitin)
  }

  // The door sign: a plate with a block and two bars where a room name would go.
  rect(0, 116, 64, 24, ink.chitin); rect(2, 118, 60, 20, ink.cream)
  rect(6, 122, 12, 12, ink.teal); rect(24, 123, 32, 4, ink.chitin); rect(24, 130, 20, 3, ink.bruise)

  // The mug's label: a plain band with one stripe.
  rect(72, 116, 32, 16, ink.cream); rect(72, 121, 32, 3, ink.rust); rect(72, 127, 32, 1, ink.chitin)

  // The keyboard: four rows of blank keys and a long bar.
  rect(112, 116, 96, 36, ink.chitin)
  for (let row = 0; row < 4; row++) for (let key = 0; key < 13; key++) rect(115 + key * 7 + row % 2, 119 + row * 7, 5, 5, key === 12 ? ink.wing : ink.cream)
  rect(138, 147, 40, 4, ink.cream)
}
