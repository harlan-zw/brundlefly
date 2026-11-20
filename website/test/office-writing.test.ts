import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { CanvasTexture, Group, Mesh, ShaderMaterial, Texture, Vector2, Vector3 } from 'three'
import { createOffice } from '../layers/brand/shared/office.ts'
import { defaultSceneSettings } from '../layers/brand/shared/scene-settings.ts'
import { createMeshMascot } from '../layers/brand/shared/mascot-mesh.ts'
import { poseMannerisms, markerStrokes } from '../layers/brand/shared/mannerism.ts'
import { loadMascotModel } from './mascot-model.ts'
import { createOfficeWriting } from '../layers/brand/shared/office-writing.ts'
import { officePlan } from '../layers/brand/shared/office-layout.ts'
import { advanceTurn, startStroll, startTurn, strollPose } from '../layers/brand/shared/mascot-stroll.ts'
import type { Stroll } from '../layers/brand/shared/mascot-stroll.ts'
import { advanceOfficeVisit } from '../layers/brand/shared/office-visit.ts'
import type { WritingVisit } from '../layers/brand/shared/office-visit.ts'

test('a full writing visit holds planted feet in world space and lifts steps on both trips', async () => {
  const result = createMeshMascot(await loadMascotModel())
  assert.equal(result._tag, 'Ok')
  if (result._tag !== 'Ok') return
  const mascot = result.mascot
  const writer = new Group()
  writer.scale.setScalar(1.25)
  writer.add(mascot.root)
  const office = createOfficeWriting(officePlan)
  const home = officePlan.stops[0]!.position
  let stroll: Stroll = { ...startStroll(home, 1), activity: { _tag: 'Pausing', waypoint: 0, duration: 7.5, remaining: 7.2, age: 0.3 } }
  let visit: WritingVisit | undefined
  let turn = startTurn(-2.35)
  const previous: { place: Vector3, planted: number, slide: number }[] = []
  const lifted = { Approach: [false, false], Return: [false, false] }
  let largestSlide = 0
  let finished = false
  let strokes = 0
  try {
    for (let frame = 0; frame < 60 * 40; frame++) {
      const next = advanceOfficeVisit(stroll, visit, { delta: 1 / 60, route: officePlan.stops.map(stop => stop.position),
        pauses: officePlan.stops.map(stop => stop.pause), walkSpeed: defaultSceneSettings.walkSpeed * 1.5,
        attention: 'free', cadence: Math.PI * 2 / (mascot.strideLength! * writer.scale.x), facing: turn.heading, writes: true })
      stroll = next.stroll
      visit = next.visit
      turn = advanceTurn(turn, stroll, { delta: 1 / 60, walkSpeed: defaultSceneSettings.walkSpeed * 1.5, rest: 0.5, limit: 1.3, attention: 'free', stand: -2.35 })
      const age = next.writingAge
      writer.position.set(stroll.position[0], -2.2, stroll.position[1])
      mascot.pose!({ time: frame / 60, pressure: 0, pointer: new Vector2(), transform: 'squeeze', ...strollPose(stroll),
        stepInPlace: turn.steps, stepPhase: turn.phase,
        mannerism: poseMannerisms(age === undefined ? [] : [{ mannerism: { _tag: 'WriteBoard' }, age, side: -1 }]) }, undefined, turn.heading)
      office.update(age === undefined ? undefined : { age, writer, side: -1 })
      if (age !== undefined) {
        assert.ok(Math.hypot(writer.position.x - home[0] - 0.75, writer.position.z - home[1] + 2.7) < 0.15, 'Writing starts only at the board')
        strokes = Math.max(strokes, markerStrokes(age))
      }
      mascot.footContacts((place, planted, index) => {
        const before = previous[index]
        const slide = planted > 0.99 && before && before.planted > 0.99
          ? before.slide + Math.hypot(place.x - before.place.x, place.z - before.place.z) : 0
        largestSlide = Math.max(largestSlide, slide)
        if (planted < 0.1 && visit && visit.stage._tag !== 'Writing') lifted[visit.stage._tag][index] = true
        previous[index] = { place: place.clone(), planted, slide }
      })
      if (!visit) { finished = true; break }
    }
    assert.ok(largestSlide < 0.04, `A planted foot slid ${largestSlide.toFixed(3)} world units`)
    assert.ok(lifted.Approach.every(Boolean), 'Both feet must lift during the approach')
    assert.ok(lifted.Return.every(Boolean), 'Both feet must lift during the return')
    assert.equal(strokes, 4, 'The full writing visit must finish all four strokes')
    assert.ok(finished && Math.hypot(stroll.position[0] - home[0], stroll.position[1] - home[1]) < 0.15, 'The visit must return to the round')
  }
  finally { office.dispose(); mascot.dispose() }
})

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
    writer.position.set(-0.15, -2.2, -3.65)
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
