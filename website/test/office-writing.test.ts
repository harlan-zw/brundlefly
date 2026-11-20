import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { CanvasTexture, Group, Mesh, ShaderMaterial, Texture, Vector2, Vector3 } from 'three'
import { createOffice } from '../layers/brand/shared/office.ts'
import { defaultSceneSettings } from '../layers/brand/shared/scene-settings.ts'
import { createMeshMascot } from '../layers/brand/shared/mascot-mesh.ts'
import { poseMannerisms, markerStrokes } from '../layers/brand/shared/mannerism.ts'
import { loadMascotModel } from './mascot-model.ts'

test('each of four marker squeaks leaves fresh board ink while the hand holds a marker', async () => {
  const pixels = new Map<string, string>()
  const painter = { fillStyle: '', clearRect() { pixels.clear() }, fillRect(x: number, y: number, w: number, h: number) {
    for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) pixels.set(`${i},${j}`, this.fillStyle)
  } }
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => painter }) } })
  const texture = new Texture()
  const { scene: model } = await loadMascotModel(new URL('../../assets/3d/office/office.glb', import.meta.url))
  const office = createOffice({ model, lightMax: 1, atlas: texture, floor: texture, wall: texture, ceiling: texture, concrete: texture, light: texture })
  let board: CanvasTexture | undefined
  office.root.traverse(object => {
    if (object instanceof Mesh && object.material instanceof ShaderMaterial && object.material.uniforms.map?.value instanceof CanvasTexture)
      board = object.material.uniforms.map.value
  })
  const result = createMeshMascot(await loadMascotModel())
  assert.equal(result._tag, 'Ok')
  if (result._tag !== 'Ok') return
  const writer = new Group()
  writer.scale.setScalar(1.25)
  writer.add(result.mascot.root)
  const update = (age: number) => {
    writer.position.set(-0.9, -2.2, -0.95)
    result.mascot.pose!({ time: age, pressure: 0, pointer: new Vector2(), transform: 'squeeze', mannerism: poseMannerisms([{ mannerism: { _tag: 'WriteBoard' }, age, side: -1 }]) }, undefined, -2.35)
    office.update({ time: age, light: 1, settings: defaultSceneSettings, writing: { age, writer, side: -1 } })
  }
  const picture = () => createHash('sha256').update(JSON.stringify([...pixels])).digest('hex')
  try {
    let before = picture()
    for (const age of [0.9, 2.01, 3.11, 4.21]) {
      update(age - 0.02)
      before = picture()
      const uploaded = board!.version
      update(age)
      const after = picture()
      assert.ok(after !== before, `squeak ${markerStrokes(age)} must leave new ink`)
      assert.ok(board!.version > uploaded, 'the rendered board must receive the fresh ink')
      before = after
      const marker = office.root.getObjectByName('whiteboard-marker')!
      assert.ok(marker?.visible, 'the writing hand must hold a visible marker')
      const hand = writer.getObjectByName('right-hand')!.getWorldPosition(new Vector3())
      assert.ok(hand.distanceTo(marker.getWorldPosition(new Vector3())) < 0.35, 'the marker must stay in the hand')
      assert.ok(Math.abs(marker.getWorldPosition(new Vector3()).z + 4.2) < 0.2, 'the marker must reach the board')
    }
    update(5.3)
    before = picture()
    office.update({ time: 8, light: 1, settings: defaultSceneSettings })
    assert.equal(picture(), before, 'the ink must remain after he leaves')
    assert.equal(office.root.getObjectByName('whiteboard-marker')!.visible, false)
  }
  finally {
    office.dispose(); result.mascot.dispose(); texture.dispose()
    if (previous) Object.defineProperty(globalThis, 'document', previous)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})
