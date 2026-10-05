import assert from 'node:assert/strict'
import test from 'node:test'
import { Box3, DataTexture, Mesh, MeshPhysicalMaterial, Raycaster, Texture, Vector3 } from 'three'
import { createFaceModel } from '../layers/brand/shared/face.ts'

const surface = (root: ReturnType<typeof createFaceModel>['root'], x: number, y: number) =>
  new Raycaster(new Vector3(x, y, 2), new Vector3(0, 0, -1)).intersectObject(root, true)[0]?.point.z
function projectedFace(notch = false, bristle = false) {
  const width = 120, height = 160
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const opaque = (Math.pow((x / width - 0.5) / 0.45, 2) + Math.pow((y / height - 0.5) / 0.49, 2) < 1
      && !(notch && x / width < 0.35 && y / height > 0.35 && y / height < 0.65))
      || (bristle && x <= 10 && (y === 79 || y === 80))
    data.set([100, 80, 60, opaque ? 255 : 0], (y * width + x) * 4)
  }
  return createFaceModel(undefined, { texture: new Texture(), raster: { width, height, data } })
}

test('the sculpt has side depth and speech moves the visible jaw surface', () => {
  const face = projectedFace()
  const size = new Box3().setFromObject(face.root).getSize(new Vector3())
  assert.ok(size.z > 0.45, 'The head must remain volumetric from a side view.')
  face.update({ time: 0, speaking: 0, blink: 0 })
  const closed = surface(face.root, 0.09, -0.28)
  face.update({ time: 0, speaking: 1, blink: 0 })
  const open = surface(face.root, 0.09, -0.28)
  assert.ok(closed !== undefined && open !== undefined && Math.abs(closed - open) > 0.015,
    'The visible jaw surface must move when the voice opens the mouth.')
  face.update({ time: 0, speaking: 0, blink: 0 })
  assert.equal(surface(face.root, 0.09, -0.28), closed, 'The jaw must return to its closed pose.')
  face.dispose()
})

test('the skull follows the mapped silhouette and closes its side seam', () => {
  const face = projectedFace(true)
  assert.equal(surface(face.root, -0.25, 0), undefined, 'A backing ball must not protrude beyond the mapped silhouette.')
  const side = new Raycaster(new Vector3(-2, 0, 0.14), new Vector3(1, 0, 0)).intersectObject(face.root, true)[0]?.point
  assert.ok(side && side.x > -0.15 && side.x < 0,
    'The mapped front edge must connect directly to its backing, without an exposed separate skull.')
  face.dispose()
})

test('fine mapped bristles remain thin instead of becoming skull slabs', () => {
  const face = projectedFace(false, true)
  const x = 3.5 / 113 * 0.67 - 0.335
  const front = surface(face.root, x, 0)
  const rear = new Raycaster(new Vector3(x, 0, -2), new Vector3(0, 0, 1)).intersectObject(face.root, true)[0]?.point.z
  assert.ok(front !== undefined && rear !== undefined, 'The mapped bristle must retain a closed surface.')
  assert.ok(front - rear < 0.025, 'A thin bristle must not inherit the full skull thickness.')
  face.dispose()
})

test('independent solid eyelids close over both eyes and reopen without holes', () => {
  const face = projectedFace()
  const points = [[-0.13, 0.075], [0.17, 0.025]] as const
  const open = points.map(([x, y]) => surface(face.root, x, y))
  face.update({ time: 0, speaking: 0, blink: 1 })
  const closed = points.map(([x, y]) => surface(face.root, x, y))
  points.forEach((_, index) => assert.ok(open[index] !== undefined && closed[index] !== undefined
    && Math.abs(open[index]! - closed[index]!) > 0.002, 'Each solid lid must cover its eye.'))
  face.update({ time: 0, speaking: 0, blink: 0 })
  points.forEach(([x, y], index) => assert.equal(surface(face.root, x, y), open[index]))
  face.dispose()
})

test('the skull backing rounds raster contour changes instead of forming depth terraces', () => {
  const width = 80, height = 100
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 10; y < 90; y++) for (let x = 12 + Math.floor((y - 10) / 4); x <= 65; x++)
    data.set([100, 80, 60, 255], (y * width + x) * 4)
  const texture = new Texture()
  const face = createFaceModel(undefined, {texture, raster: {width, height, data}})
  const x = (23 - 12) / (65 - 12) * 0.67 - 0.335
  const depths = Array.from({length: 16}, (_, row) => {
    const y = 0.43 - (35 + row - 10) / (89 - 10) * 0.86
    return new Raycaster(new Vector3(x, y, -2), new Vector3(0, 0, 1)).intersectObject(face.root, true)[0]?.point.z
  })
  assert.ok(depths.every(value => value !== undefined), 'Backing samples must retain a solid surface.')
  const curvature = Math.max(...depths.slice(2).map((value, index) => Math.abs(value! - 2 * depths[index + 1]! + depths[index]!)))
  assert.ok(curvature < 0.018, `Rounded backing must not contain abrupt terrace corners, measured ${curvature}.`)
  face.dispose(); texture.dispose()
})

test('backing skin covers rounded depth without stretching texture into contour rows', () => {
  const face = projectedFace()
  const hit = (x: number) => new Raycaster(new Vector3(x, 0, -2), new Vector3(0, 0, 1)).intersectObject(face.root, true)[0]
  const first = hit(-0.315), second = hit(-0.285)
  assert.ok(first?.uv && second?.uv, 'The backing must provide textured visible surfaces.')
  const stretch = first.point.distanceTo(second.point) / first.uv.distanceTo(second.uv)
  assert.ok(stretch < 2.5, `Skin UVs must follow the rounded backing depth, measured stretch ${stretch}.`)
  face.dispose()
})

test('blinking lids sample skin instead of painting duplicate pupils', () => {
  const width = 100, height = 100
  const data = new Uint8ClampedArray(width * height * 4)
  const eyes = [{x: 39.34, y: 44.17, rx: 0.078, ry: 0.074, rz: 0.061}, {x: 69.16, y: 48.26, rx: 0.054, ry: 0.044, rz: 0.045}]
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const pupil = eyes.some(eye => Math.pow((x - eye.x) / (eye.rx / 0.67 * 99), 2)
      + Math.pow((y - eye.y) / (eye.ry / 0.86 * 99), 2) < 1)
    data.set(pupil ? [5, 5, 5, 255] : [160, 80, 60, 255], (y * width + x) * 4)
  }
  const texture = new DataTexture(data, width, height)
  const skin = new Uint8Array(data.length)
  for (let index = 0; index < width * height; index++) skin.set([160, 80, 60, 255], index * 4)
  const skinTexture = new DataTexture(skin, width, height)
  const face = createFaceModel(skinTexture, {texture, raster: {width, height, data}})
  let sampledLids = 0
  for (const blink of [0, 0.5, 1]) {
    face.update({time: 0, speaking: 0, blink})
    for (const eye of eyes) for (const offset of [-0.5, 0, 0.5]) {
      const hit = new Raycaster(new Vector3(eye.x / 99 * 0.67 - 0.335,
        0.43 - eye.y / 99 * 0.86 + offset * eye.ry, 2), new Vector3(0, 0, -1)).intersectObject(face.root, true)[0]
      if (hit?.object.parent?.type !== 'Bone' || !hit.uv) continue
      sampledLids++
      const x = Math.max(0, Math.min(99, Math.round(hit.uv.x * 99)))
      const y = Math.max(0, Math.min(99, Math.round((1 - hit.uv.y) * 99)))
      assert.ok(hit.object instanceof Mesh && hit.object.material instanceof MeshPhysicalMaterial)
      assert.equal(hit.object.material.map, skinTexture, 'Lids must use the skin tile, without baked eye features.')
      assert.ok(skin[(y * width + x) * 4]! > 100, 'Visible eyelids must sample skin.')
    }
    if (blink === 1) {
      const lids: typeof face.root.children = []
      face.root.traverse(object => { if (object.type === 'Mesh' && object.parent?.type === 'Bone') lids.push(object) })
      for (const eye of eyes) {
        const rear = new Raycaster(new Vector3(eye.x / 99 * 0.67 - 0.335, 0.43 - eye.y / 99 * 0.86, -2), new Vector3(0, 0, 1))
        assert.ok(rear.intersectObjects(lids, false).length, 'Fully closed lid shells must meet behind the eye without a gap.')
        const x = eye.x / 99 * 0.67 - 0.335, y = 0.43 - eye.y / 99 * 0.86
        const z = 0.028 + Math.sqrt(Math.max(0, 1 - (x / 0.35) ** 2 * 0.82 - (y / 0.44) ** 2 * 0.75)) * 0.23 - eye.rz * 0.3
        for (const angle of [-Math.PI / 4, 0, Math.PI / 4]) {
          const direction = new Vector3(Math.sin(angle), 0, -Math.cos(angle))
          const origin = new Vector3(x, y, z).addScaledVector(direction, -2)
          const visible = new Raycaster(origin, direction).intersectObject(face.root, true)[0]
          assert.ok(visible?.object instanceof Mesh && visible.uv, 'The closed eye must remain covered.')
          const material = Array.isArray(visible.object.material) ? visible.object.material[visible.face!.materialIndex] : visible.object.material
          if (material.map === texture) {
            const sx = Math.max(0, Math.min(99, Math.round(visible.uv.x * 99)))
            const sy = Math.max(0, Math.min(99, Math.round((1 - visible.uv.y) * 99)))
            assert.ok(data[(sy * width + sx) * 4]! > 100, `Closed lids must hide the cornea at angle ${angle}, eye ${eye.x}.`)
          } else assert.equal(material.map, skinTexture, 'Oblique closed eyes must show skin.')
        }
      }
    }
  }
  assert.ok(sampledLids >= 2, 'Both blinking eyes must expose testable lid tissue.')
  face.dispose(); texture.dispose(); skinTexture.dispose()
})
