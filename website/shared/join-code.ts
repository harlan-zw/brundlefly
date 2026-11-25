import { encode } from 'uqr'

/** The address a phone opens to join the office experiment at the computer. */
export const joinUrl = 'https://brundlefly.dev/join'
/** The same address as people read it. */
export const joinAddress = 'brundlefly.dev/join'

/**
 * One dark module of the code. `x` runs right and `y` runs down, from the top left module.
 * `mark` says the module belongs to a mark that a scanner finds the symbol by: a corner target, or the small alignment target.
 */
export type JoinCell = { x: number, y: number, mark: boolean }
/** A mark of the symbol: its middle module, and how far it reaches from the middle of that module to its outer edge, in modules. */
export type JoinMark = { x: number, y: number, reach: number }
/** The join address as a QR symbol. `size` is its side in modules, without the quiet zone. */
export type JoinCode = { size: number, cells: readonly JoinCell[], marks: readonly JoinMark[] }

/** The clear margin a scanner needs around the symbol, in modules. */
export const quietZone = 4

/**
 * The dark modules of the join code. Error correction Q restores a quarter of the symbol,
 * which pays for modules that are creatures and not squares.
 * Decoders need the marks solid: with gaps in them, two of three decoders did not read the symbol. So the scene draws each mark as one mass.
 */
export function joinCode(url = joinUrl): JoinCode {
  const { size, data } = encode(url, { ecc: 'Q', border: 0 })
  // Three corner targets, seven modules wide. Versions 2 to 6 add one alignment target, five modules wide, with its middle seven modules from the far edges.
  const marks: JoinMark[] = [{ x: 3, y: 3, reach: 3.5 }, { x: size - 4, y: 3, reach: 3.5 }, { x: 3, y: size - 4, reach: 3.5 },
    ...(size >= 25 && size <= 41 ? [{ x: size - 7, y: size - 7, reach: 2.5 }] : [])]
  const marked = (x: number, y: number) => marks.some(mark => Math.max(Math.abs(x - mark.x), Math.abs(y - mark.y)) < mark.reach)
  const cells: JoinCell[] = []
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[y]![x]) cells.push({ x, y, mark: marked(x, y) })
  return { size, cells, marks }
}
