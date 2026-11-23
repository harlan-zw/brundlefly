import assert from 'node:assert/strict'
import { test } from 'node:test'
import jsqr from 'jsqr'
import { joinAddress, joinCode, joinUrl, quietZone } from '../shared/join-code.ts'
import type { JoinCode } from '../shared/join-code.ts'

// jsqr is a CommonJS package. TypeScript gives its module object as the default import, so the reader is on `default`.
const jsQR = jsqr.default

const scale = 8
/** Draws the code as a scanner sees it: black squares on white, with the quiet zone round them. */
function picture(code: JoinCode) {
  const side = (code.size + quietZone * 2) * scale
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255)
  for (const { x, y } of code.cells) {
    for (let row = 0; row < scale; row++) {
      const start = (((y + quietZone) * scale + row) * side + (x + quietZone) * scale) * 4
      for (let index = start; index < start + scale * 4; index += 4) pixels.fill(0, index, index + 3)
    }
  }
  return { pixels, side }
}
const scan = (code: JoinCode) => {
  const { pixels, side } = picture(code)
  return { read: jsQR(pixels, side, side, { inversionAttempts: 'dontInvert' }), side }
}
const darkSet = (code: JoinCode) => new Set(code.cells.map(({ x, y }) => `${x},${y}`))

test('a scanner reads the join code as the join address', () => {
  assert.equal(scan(joinCode()).read?.data, joinUrl)
})

test('a scanner reads a code for another address as that address', () => {
  for (const url of ['https://example.com/a', 'https://example.com/office/join?run=42&from=presenter']) assert.equal(scan(joinCode(url)).read?.data, url)
})

test('the code is the right way round: top left is top left, and it is not mirrored', () => {
  for (const url of [joinUrl, 'https://example.com/a', 'https://example.com/office/join?run=42&from=presenter']) {
    const code = joinCode(url)
    const { read, side } = scan(code)
    const finders = read!.location
    const near = (point: { x: number, y: number }, x: number, y: number) => Math.abs(point.x - x) < side / 4 && Math.abs(point.y - y) < side / 4
    assert.ok(near(finders.topLeftFinderPattern, 0, 0) && near(finders.topRightFinderPattern, side, 0) && near(finders.bottomLeftFinderPattern, 0, side), url)
    // The corners do not show a symbol turned about its diagonal. The one dark module the standard fixes does:
    // it sits at column 8, eight modules from the bottom.
    assert.ok(darkSet(code).has(`8,${code.size - 8}`), url)
  }
})

test('each mark sits on a target of the symbol, and only the modules of the marks are flagged', () => {
  // A corner target is a dark ring, a light ring, and a dark core of three by three. The alignment target is a dark ring, a light ring, and a dark middle.
  const corner = [true, true, false, true]
  const alignment = [true, false, true]
  for (const [url, alignments] of [[joinUrl, 1], ['https://example.com/office/join?run=42&from=presenter', 1], ['HTTPS://X.IO', 0]] as const) {
    const code = joinCode(url)
    const dark = darkSet(code)
    const corners = code.marks.filter(mark => mark.reach > 3)
    const small = code.marks.filter(mark => mark.reach <= 3)
    assert.deepEqual(corners.map(({ x, y }) => `${x},${y}`).sort(), ['3,3', `${code.size - 4},3`, `3,${code.size - 4}`].sort(), url)
    assert.equal(small.length, alignments, url)
    for (const mark of code.marks) {
      const rings = mark.reach > 3 ? corner : alignment
      for (let y = mark.y - rings.length + 1; y < mark.y + rings.length; y++) {
        for (let x = mark.x - rings.length + 1; x < mark.x + rings.length; x++) {
          const ring = Math.max(Math.abs(x - mark.x), Math.abs(y - mark.y))
          assert.equal(dark.has(`${x},${y}`), rings[ring], `${url}: module ${x},${y} of the mark at ${mark.x},${mark.y}`)
        }
      }
    }
    // The scene draws each mark as one solid mass, and every other dark module as a creature.
    const inside = (x: number, y: number) => code.marks.some(mark => Math.max(Math.abs(x - mark.x), Math.abs(y - mark.y)) < mark.reach)
    for (const cell of code.cells) assert.equal(cell.mark, inside(cell.x, cell.y), `${url}: module ${cell.x},${cell.y}`)
  }
})

test('the address people read is the join address without its scheme', () => {
  const url = new URL(joinUrl)
  assert.equal(url.protocol, 'https:')
  assert.equal(`${url.host}${url.pathname}`, joinAddress)
  assert.equal(new URL(`https://${joinAddress}`).href, joinUrl)
})
