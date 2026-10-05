import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { Raycaster, Texture, Vector2, Vector3 } from 'three'
import { createMascotModel } from '../layers/brand/shared/mascot.ts'

function canonicalRaster() {
  const png = readFileSync(new URL('../../assets/brand/character.png', import.meta.url))
  const sourceWidth = png.readUInt32BE(16)
  const sourceHeight = png.readUInt32BE(20)
  if (png[24] !== 8 || png[25] !== 2 || png[28] !== 0) throw new Error('Fixture reader requires an RGB PNG.')
  const chunks: Buffer[] = []
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  const packed = inflateSync(Buffer.concat(chunks))
  const stride = sourceWidth * 3
  const rgb = new Uint8Array(sourceHeight * stride)
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < sourceHeight; y++) for (let x = 0; x < stride; x++) {
    const filter = packed[y * (stride + 1)]!
    const index = y * stride + x
    const a = x >= 3 ? rgb[index - 3]! : 0
    const b = y > 0 ? rgb[index - stride]! : 0
    const c = x >= 3 && y > 0 ? rgb[index - stride - 3]! : 0
    const predictor = filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? paeth(a, b, c) : 0
    rgb[index] = (packed[y * (stride + 1) + x + 1]! + predictor) & 255
  }
  const width = 180
  const height = Math.round(width * sourceHeight / sourceWidth)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const source = (Math.floor(y / height * sourceHeight) * sourceWidth + Math.floor(x / width * sourceWidth)) * 3
    data.set([rgb[source]!, rgb[source + 1]!, rgb[source + 2]!, 255], (y * width + x) * 4)
  }
  return { width, height, data }
}

test('pressure moves a weighted arm vertex and release restores its pose', () => {
  const width = 48
  const height = 48
  const texture = new Texture()
  const data = new Uint8ClampedArray(width * height * 4).fill(180)
  const model = createMascotModel(texture, { width, height, data })
  const vertex = Math.round(height * 0.45) * width + Math.round(width * 0.13)
  const rest = new Vector3().fromBufferAttribute(model.mesh.geometry.getAttribute('position'), vertex)
  const pose = (pressure: number) => {
    model.update({ time: 0, pressure, pointer: new Vector2(), transform: 'squeeze' })
    return model.mesh.applyBoneTransform(vertex, rest.clone())
  }
  const before = pose(0)
  const pressed = pose(1)
  assert.ok(before.distanceTo(pressed) > 0.02, 'Arm skin must follow its moving joints.')
  assert.ok(before.distanceTo(pose(0)) < 0.000001, 'Release must restore the weighted pose.')
  model.dispose()
  texture.dispose()
})

test('dark eye sockets keep their face surface while finger and wing gaps remain open', () => {
  const width = 80
  const height = 100
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 3; i < data.length; i += 4) data[i] = 255
  const paint = (left: number, top: number, right: number, bottom: number, shade: number, alpha = 255) => {
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const offset = (y * width + x) * 4
      data.set([shade, shade, shade, alpha], offset)
    }
  }
  paint(38, 17, 55, 36, 180)
  paint(43, 24, 46, 27, 4) // The eye is dark opaque artwork, not empty space.
  paint(51, 24, 53, 27, 0, 0) // An explicit alpha hole must stay empty.
  paint(9, 7, 22, 17, 180)
  paint(14, 11, 16, 13, 0) // A small enclosed wing gap must stay open.
  paint(7, 48, 19, 66, 180)
  paint(12, 54, 15, 66, 0) // A gap between fingers connects to the exterior.
  const texture = new Texture()
  const model = createMascotModel(texture, { width, height, data })
  const surfaceAt = (x: number, y: number, target = model) => {
    const origin = new Vector3((x / (width - 1) - 0.5) * 2.3, (0.5 - y / (height - 1)) * 2.6, 2)
    return new Raycaster(origin, new Vector3(0, 0, -1)).intersectObject(target.mesh)
  }
  assert.ok(surfaceAt(44.5, 25.5).some(hit => hit.face?.materialIndex === 0), 'Dark eye pixels must render as face tissue.')
  assert.equal(surfaceAt(52, 25.5).length, 0, 'Explicit transparency must remain empty.')
  assert.equal(surfaceAt(15, 12).length, 0, 'Enclosed wing gaps must remain empty.')
  assert.equal(surfaceAt(13.5, 60).length, 0, 'Finger gaps must remain empty.')
  assert.equal(surfaceAt(30, 45).length, 0, 'The outside background must remain empty.')
  paint(38, 25, 42, 25, 0) // A narrow crease joins the dark socket to the backdrop.
  const connected = createMascotModel(texture, { width, height, data })
  assert.ok(surfaceAt(44.5, 25.5, connected).some(hit => hit.face?.materialIndex === 0), 'A socket with a narrow exterior crease must retain its face surface.')
  assert.equal(surfaceAt(30, 25, connected).length, 0, 'Socket repair must not grow the exterior silhouette.')
  connected.dispose()
  model.dispose()
  texture.dispose()
})

test('canonical right eye keeps opaque skin around its outer and lower socket rim', () => {
  const texture = new Texture()
  const model = createMascotModel(texture, canonicalRaster())
  for (const [x, y] of [[0.775, 0.224], [0.788, 0.23], [0.778, 0.244]]) {
    const origin = new Vector3((x! - 0.5) * 2.3, (0.5 - y!) * 2.6, 2)
    const hits = new Raycaster(origin, new Vector3(0, 0, -1)).intersectObject(model.mesh)
    assert.ok(hits.some(hit => hit.face?.materialIndex === 0), `Right socket rim at ${x},${y} must remain opaque.`)
  }
  model.dispose()
  texture.dispose()
})
