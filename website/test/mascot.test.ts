import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { AnimationMixer, Raycaster, Texture, Vector2, Vector3 } from 'three'
import { createMascotModel } from '../layers/brand/shared/mascot.ts'

function canonicalRaster() {
  return imageRaster('../../assets/brand/character.png')
}
function imageRaster(relativePath: string) {
  const png = readFileSync(new URL(relativePath, import.meta.url))
  const sourceWidth = png.readUInt32BE(16)
  const sourceHeight = png.readUInt32BE(20)
  if (png[24] !== 8 || ![2, 6].includes(png[25]!) || png[28] !== 0) throw new Error('Fixture reader requires an RGB or RGBA PNG.')
  const channels = png[25] === 6 ? 4 : 3
  const chunks: Buffer[] = []
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  const packed = inflateSync(Buffer.concat(chunks))
  const stride = sourceWidth * channels
  const rgb = new Uint8Array(sourceHeight * stride)
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < sourceHeight; y++) for (let x = 0; x < stride; x++) {
    const filter = packed[y * (stride + 1)]!
    const index = y * stride + x
    const a = x >= channels ? rgb[index - channels]! : 0
    const b = y > 0 ? rgb[index - stride]! : 0
    const c = x >= channels && y > 0 ? rgb[index - stride - channels]! : 0
    const predictor = filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? paeth(a, b, c) : 0
    rgb[index] = (packed[y * (stride + 1) + x + 1]! + predictor) & 255
  }
  const width = 180
  const height = Math.round(width * sourceHeight / sourceWidth)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const source = (Math.floor(y / height * sourceHeight) * sourceWidth + Math.floor(x / width * sourceWidth)) * channels
    data.set([rgb[source]!, rgb[source + 1]!, rgb[source + 2]!, channels === 4 ? rgb[source + 3]! : 255], (y * width + x) * 4)
  }
  return { width, height, data }
}
const headRaster = imageRaster('../../assets/brand/kit/lair/head-projection.png')
function projectedMascot(texture: Texture, raster: ReturnType<typeof imageRaster>) {
  return createMascotModel(texture, raster, undefined, { texture, raster: headRaster })
}

test('pressure moves a weighted arm vertex and release restores its pose', () => {
  const width = 48
  const height = 48
  const texture = new Texture()
  const data = new Uint8ClampedArray(width * height * 4).fill(180)
  const model = projectedMascot(texture, { width, height, data })
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

test('the sculpted head stays opaque while raster finger and wing gaps remain open', () => {
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
  const model = projectedMascot(texture, { width, height, data })
  const surfaceAt = (x: number, y: number, target = model) => {
    const origin = new Vector3((x / (width - 1) - 0.5) * 2.3, (0.5 - y / (height - 1)) * 2.6, 2)
    return new Raycaster(origin, new Vector3(0, 0, -1)).intersectObject(target.root, true)
  }
  assert.ok(surfaceAt(44.5, 25.5).some(hit => hit.face?.materialIndex === 0), 'Dark eye pixels must render as face tissue.')
  assert.ok(surfaceAt(52, 25.5).length > 0, 'The volumetric head must cover old raster eye holes.')
  assert.equal(surfaceAt(15, 12).length, 0, 'Enclosed wing gaps must remain empty.')
  assert.equal(surfaceAt(13.5, 60).length, 0, 'Finger gaps must remain empty.')
  assert.equal(surfaceAt(30, 45).length, 0, 'The outside background must remain empty.')
  paint(38, 25, 42, 25, 0) // A narrow crease joins the dark socket to the backdrop.
  const connected = projectedMascot(texture, { width, height, data })
  assert.ok(surfaceAt(44.5, 25.5, connected).some(hit => hit.face?.materialIndex === 0), 'A socket with a narrow exterior crease must retain its face surface.')
  assert.equal(surfaceAt(30, 25, connected).length, 0, 'Socket repair must not grow the exterior silhouette.')
  connected.dispose()
  model.dispose()
  texture.dispose()
})

test('the mapped right eye keeps opaque skin around its outer and lower socket rim', () => {
  const texture = new Texture()
  const model = projectedMascot(texture, canonicalRaster())
  const opaque = Array.from({length: headRaster.width * headRaster.height}, (_, index) => index)
    .filter(index => headRaster.data[index * 4 + 3]! > 24)
  const xs = opaque.map(index => index % headRaster.width), ys = opaque.map(index => Math.floor(index / headRaster.width))
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  for (const [x, y] of [[1180, 510], [1160, 590], [1110, 610]]) {
    const sourceX = x! / 1536 * headRaster.width, sourceY = y! / 1024 * headRaster.height
    const origin = new Vector3(0.3289 + (sourceX - minX) / (maxX - minX) * 0.67 - 0.335,
      0.6812 + 0.43 - (sourceY - minY) / (maxY - minY) * 0.86, 2)
    const hits = new Raycaster(origin, new Vector3(0, 0, -1)).intersectObject(model.root, true)
    assert.ok(hits.some(hit => hit.face?.materialIndex === 0), `Right socket rim at ${x},${y} must remain opaque.`)
  }
  model.dispose()
  texture.dispose()
})

test('the canonical sprite comparison keeps both eye rims opaque', () => {
  const texture = new Texture()
  const model = createMascotModel(texture, canonicalRaster())
  for (const [x, y] of [[0.632, 0.214], [0.775, 0.224], [0.788, 0.23], [0.778, 0.244]]) {
    const origin = new Vector3((x! - 0.5) * 2.3, (0.5 - y!) * 2.6, 2)
    assert.ok(new Raycaster(origin, new Vector3(0, 0, -1)).intersectObject(model.root, true).length > 0,
      'The comparison sprite must retain opaque eye tissue.')
  }
  model.dispose()
  texture.dispose()
})

test('speech moves the sculpted mouth locally and release restores the quiet face', () => {
  const width = 100
  const height = 100
  const texture = new Texture()
  const model = projectedMascot(texture, { width, height, data: new Uint8ClampedArray(width * height * 4).fill(180) })
  const vertexAt = (x: number, y: number) => Math.round(y * (height - 1)) * width + Math.round(x * (width - 1))
  const foot = vertexAt(0.28, 0.92)
  const pose = (speaking: number) => {
    model.update({ time: 0, pressure: 0, pointer: new Vector2(), transform: 'squeeze', speaking, blink: 0 })
    return new Raycaster(new Vector3(0.4465, 0.422, 2), new Vector3(0, 0, -1)).intersectObject(model.root, true)[0]?.point.z
  }
  const footPosition = () => model.mesh.applyBoneTransform(foot, new Vector3().fromBufferAttribute(model.mesh.geometry.getAttribute('position'), foot))
  const quiet = pose(0)
  const standingFoot = footPosition()
  const talking = pose(1)
  assert.ok(quiet !== undefined && talking !== undefined && Math.abs(quiet - talking) > 0.015, 'Voice must visibly open sculpted mouth tissue.')
  assert.ok(standingFoot.distanceTo(footPosition()) < 0.000001, 'Speech must not stretch body limbs.')
  assert.equal(pose(0), quiet, 'The mouth must return to its quiet pose.')
  model.dispose()
  texture.dispose()
})

test('the speaking clip opens mouth skin, blinks, and closes without a pose jump', () => {
  const width = 100
  const height = 100
  const texture = new Texture()
  const model = projectedMascot(texture, { width, height, data: new Uint8ClampedArray(width * height * 4).fill(180) })
  const clip = model.speakingAnimation()
  const mixer = new AnimationMixer(model.root)
  mixer.clipAction(clip).play()
  const poseAt = (time: number, x: number, y: number) => {
    mixer.setTime(time)
    model.root.updateMatrixWorld(true)
    model.skeleton.update()
    return new Raycaster(new Vector3(x, y, 2), new Vector3(0, 0, -1)).intersectObject(model.root, true)[0]?.point.z
  }
  const mouthRest = poseAt(0, 0.4465, 0.422)
  const mouthTalking = poseAt(0.32, 0.4465, 0.422)
  assert.ok(mouthRest !== undefined && mouthTalking !== undefined && Math.abs(mouthRest - mouthTalking) > 0.008, 'The speaking clip must open the sculpted mouth.')
  const eyeOpen = poseAt(0, 0.2265, 0.777)
  const eyeClosed = poseAt(2.45, 0.2265, 0.777)
  assert.ok(eyeOpen !== undefined && eyeClosed !== undefined && Math.abs(eyeOpen - eyeClosed) > 0.002, 'The speaking clip must articulate the solid eyelid.')
  assert.equal(poseAt(clip.duration, 0.4465, 0.422), mouthRest, 'Speech must loop without a mouth jump.')
  mixer.stopAllAction()
  mixer.uncacheRoot(model.root)
  model.dispose()
  texture.dispose()
})

test('material animation leaves a cached speaking pose unchanged', () => {
  const texture = new Texture()
  const model = projectedMascot(texture, { width: 100, height: 100, data: new Uint8ClampedArray(100 * 100 * 4).fill(180) })
  const mixer = new AnimationMixer(model.root)
  mixer.clipAction(model.speakingAnimation()).play()
  mixer.setTime(0.32)
  model.root.updateMatrixWorld(true)
  const surface = (x: number, y: number) => new Raycaster(new Vector3(x, y, 2), new Vector3(0, 0, -1))
    .intersectObject(model.root, true)[0]?.point.clone()
  const mouthBefore = surface(0.4465, 0.422)
  const bodyBefore = surface(-0.598, 0.338)
  assert.ok(mouthBefore && bodyBefore, 'Both head and body must have rendered surfaces.')
  model.updateMaterials(17.25)
  mixer.setTime(0.32) // Cached tracks need no rewrite when their pose value has not changed.
  model.root.updateMatrixWorld(true)
  assert.deepEqual(surface(0.4465, 0.422), mouthBefore, 'Material time must not reset the speaking jaw.')
  assert.deepEqual(surface(-0.598, 0.338), bodyBefore, 'Material time must not move body skin.')
  mixer.stopAllAction()
  mixer.uncacheRoot(model.root)
  model.dispose()
  texture.dispose()
})

test('mapped body skin stays rounded instead of extruding artwork rows into ridges', () => {
  const width = 48, height = 96
  const data = new Uint8ClampedArray(width * height * 4)
  const artwork = new Uint8ClampedArray(data.length)
  for (let y = 24; y < 84; y++) for (let x = 9; x < 20; x++) {
    const offset = (y * width + x) * 4
    data.set([180, 180, 180, 255], offset)
    const shade = y % 2 ? 235 : 35
    artwork.set([shade, shade, shade, 255], offset)
  }
  for (let y = 46; y <= 50; y++) for (let x = 12; x <= 16; x++) data.set([0, 0, 0, 255], (y * width + x) * 4)
  const texture = new Texture()
  const model = createMascotModel(texture, {width, height, data}, undefined, undefined,
    {texture, raster: {width, height, data: artwork}})
  const surface = (x: number, y: number) => new Raycaster(new Vector3((x / (width - 1) - 0.5) * 2.3,
    (0.5 - y / (height - 1)) * 2.6, 2), new Vector3(0, 0, -1)).intersectObject(model.root, true)[0]?.point.z
  const depths = Array.from({length: 16}, (_, i) => surface(14, 40 + i))
  assert.ok(depths.every(value => value !== undefined), 'The mapped alpha must keep tissue solid, including dark folds.')
  const ridge = Math.max(...depths.slice(1).map((value, i) => Math.abs(value! - depths[i]!)))
  assert.ok(ridge < 0.004, `Fine artwork rows must not create body ridges, measured ${ridge}.`)
  assert.ok(surface(14, 48)! > surface(10, 48)!, 'The limb must remain rounded toward its center.')
  assert.equal(surface(7, 48), undefined, 'Depth smoothing must not fill a silhouette gap.')
  model.dispose(); texture.dispose()
})

test('mapped limb sides soften raster stair corners without closing gaps', () => {
  const width = 48, height = 96
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 24; y < 72; y++) {
    const left = 9 + Math.floor((y - 24) / 4)
    for (let x = left; x < left + 10; x++) data.set([180, 180, 180, 255], (y * width + x) * 4)
  }
  const texture = new Texture()
  const raster = {width, height, data}
  const model = createMascotModel(texture, raster, undefined, undefined, {texture, raster})
  const edge = (y: number) => new Raycaster(new Vector3(-2, (0.5 - y / (height - 1)) * 2.6, 0), new Vector3(1, 0, 0))
    .intersectObject(model.root, true)[0]?.point.x
  const beforeCorner = edge(38.8), afterCorner = edge(39.2)
  assert.ok(beforeCorner !== undefined && afterCorner !== undefined, 'Both sides of the contour corner must remain solid.')
  assert.ok(Math.abs(afterCorner - beforeCorner) < 0.03, 'Adjacent side samples must follow a softened contour instead of a full raster step.')
  assert.equal(new Raycaster(new Vector3(-0.9, 0, 2), new Vector3(0, 0, -1)).intersectObject(model.root, true).length, 0,
    'Smoothing must keep exterior gaps open.')
  model.dispose(); texture.dispose()
})

test('the mapped face keeps existing neck tissue beneath its left attachment edge', () => {
  const width = 100, height = 100
  const data = new Uint8ClampedArray(width * height * 4).fill(180)
  const texture = new Texture()
  const raster = {width, height, data}
  const model = createMascotModel(texture, raster, undefined, {texture, raster: headRaster}, {texture, raster})
  for (const [x, y] of [[0.56, 0.19], [0.58, 0.23], [0.59, 0.28]]) {
    const origin = new Vector3((x! - 0.5) * 2.3, (0.5 - y!) * 2.6, 2)
    assert.ok(new Raycaster(origin, new Vector3(0, 0, -1)).intersectObject(model.mesh, false).length,
      'The head replacement must retain neck tissue along the left attachment seam.')
  }
  model.dispose(); texture.dispose()
})

test('actual mapped neck stays solid beneath the face while walking and speaking', () => {
  const texture = new Texture()
  const model = createMascotModel(texture, canonicalRaster(), undefined, {texture, raster: headRaster},
    {texture, raster: imageRaster('../../assets/brand/kit/lair/body-projection.png')})
  for (const [walking, speaking] of [[false, 0], [true, 0], [false, 1]] as const) {
    model.update({time: 0, pressure: 0, pointer: new Vector2(), transform: 'squeeze', walking, walkPhase: Math.PI / 2, speaking, blink: 0})
    const origin = new Vector3((0.61 - 0.5) * 2.3, (0.5 - 0.23) * 2.6, 2)
    assert.ok(new Raycaster(origin, new Vector3(0, 0, -1)).intersectObject(model.mesh, false).length,
      'The real mapped neck join must remain solid in quiet, walking, and speaking poses.')
  }
  model.dispose(); texture.dispose()
})

test('the actual head overlaps its curled neck instead of exposing the upper attachment gap', () => {
  const texture = new Texture()
  const model = createMascotModel(texture, canonicalRaster(), undefined, {texture, raster: headRaster},
    {texture, raster: imageRaster('../../assets/brand/kit/lair/body-projection.png')})
  const ray = new Raycaster(new Vector3(0.115, 0.85, 2), new Vector3(0, 0, -1))
  assert.ok(ray.intersectObject(model.root, true).some(hit => hit.object !== model.mesh),
    'The actual head must overlap the curled neck at its upper attachment.')
  model.dispose(); texture.dispose()
})
