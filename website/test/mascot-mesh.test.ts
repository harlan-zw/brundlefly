import assert from 'node:assert/strict'
import test from 'node:test'
import { AnimationClip, Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Object3D, Vector3, VectorKeyframeTrack } from 'three'
import { createMeshMascot } from '../layers/brand/shared/mascot-mesh.ts'

/** A model in millimetres under a scaled root, like a Blender export. Its feet are off the origin. */
function millimetreModel() {
  const scene = new Group()
  const node = new Group()
  node.scale.setScalar(0.001)
  const body = new Mesh(new BoxGeometry(60, 80, 40), new MeshStandardMaterial())
  body.name = 'body'
  body.position.set(5, 52, 0)
  node.add(body)
  scene.add(node)
  return { scene, node, body }
}
function ok(result: ReturnType<typeof createMeshMascot>) {
  assert.equal(result._tag, 'Ok')
  return (result as Extract<typeof result, { _tag: 'Ok' }>).mascot
}
const close = (actual: number, expected: number, message?: string) => assert.ok(Math.abs(actual - expected) < 1e-6, message ?? `${actual} is not ${expected}`)

test('a model in any unit stands on the floor at the requested height and keeps its own origin', () => {
  const { scene } = millimetreModel()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  mascot.root.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(mascot.root, true)
  close(bounds.min.y, 0)
  close(bounds.max.y, 2.5)
  // The body sits 5 mm right of the file origin. The fit keeps that offset at the new scale.
  close((bounds.min.x + bounds.max.x) / 2, 5 * 2.5 / 80)
  close(mascot.extent.left, bounds.min.x)
  close(mascot.extent.right, bounds.max.x)
})

test('a figurine base leaves the scene and does not change the fit', () => {
  const { scene, node } = millimetreModel()
  const base = new Mesh(new BoxGeometry(120, 6, 120), new MeshStandardMaterial())
  base.name = 'Brundlefly-base'
  base.position.y = 9
  node.add(base)
  let released = false
  base.geometry.addEventListener('dispose', () => { released = true })
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  mascot.root.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(mascot.root, true)
  close(bounds.min.y, 0)
  close(bounds.max.y, 2.5)
  assert.equal(mascot.root.getObjectByName('Brundlefly-base'), undefined)
  assert.ok(released, 'The removed base must release its geometry.')
})

test('a file without clips sways about its feet and rests at time zero', () => {
  const { scene, body } = millimetreModel()
  const mascot = ok(createMeshMascot({ scene, animations: [] }, 2.5))
  assert.deepEqual(mascot.motion, { _tag: 'Sway' })
  const head = () => { mascot.root.updateMatrixWorld(true); return body.localToWorld(new Vector3(0, 40, 0)) }
  const feet = () => { mascot.root.updateMatrixWorld(true); return mascot.root.children[0]!.getWorldPosition(new Vector3()) }
  mascot.update(0)
  const rest = head()
  mascot.update(3)
  assert.ok(head().distanceTo(rest) > 0.005, 'The head must move during the sway.')
  assert.ok(feet().length() < 1e-9, 'The sway pivot must stay on the floor origin.')
  mascot.update(0)
  assert.ok(head().distanceTo(rest) < 1e-9, 'Time zero must restore the authored pose.')
})

test('a file with clips plays its idle clip instead of the sway', () => {
  const { scene, body } = millimetreModel()
  const track = (to: number) => new VectorKeyframeTrack('body.position', [0, 2], [5, 52, 0, 5, 52, to])
  const animations = [new AnimationClip('Brundlefly-walk', 2, [track(90)]), new AnimationClip('Brundlefly-idle', 2, [track(30)])]
  const mascot = ok(createMeshMascot({ scene, animations }, 2.5))
  assert.deepEqual(mascot.motion, { _tag: 'Clip', name: 'Brundlefly-idle' })
  mascot.update(1)
  close(body.position.z, 15)
  assert.equal(mascot.root.children[0]!.rotation.y, 0, 'An animated model must not also sway.')
})

test('the face point follows an authored anchor and falls back to the upper front of the body', () => {
  const authored = millimetreModel()
  const anchor = new Object3D()
  anchor.name = 'anchor-face'
  anchor.position.set(5, 80, 20)
  authored.node.add(anchor)
  const withAnchor = ok(createMeshMascot({ scene: authored.scene, animations: [] }, 2.5))
  const scale = 2.5 / 80
  const point = withAnchor.facePoint(new Vector3())
  close(point.x, 5 * scale)
  close(point.y, (80 - 12) * scale)
  close(point.z, 20 * scale)
  const estimated = ok(createMeshMascot({ scene: millimetreModel().scene, animations: [] }, 2.5)).facePoint(new Vector3())
  close(estimated.x, 5 * scale)
  close(estimated.y, 2.5 * 0.8)
  close(estimated.z, 20 * scale)
})

test('a file without geometry is an error value, and disposal releases the model', () => {
  const empty = createMeshMascot({ scene: new Group(), animations: [] })
  assert.equal(empty._tag, 'Err')
  const { scene, body } = millimetreModel()
  const released: string[] = []
  body.geometry.addEventListener('dispose', () => released.push('geometry'))
  ;(body.material as MeshStandardMaterial).addEventListener('dispose', () => released.push('material'))
  ok(createMeshMascot({ scene, animations: [] })).dispose()
  assert.deepEqual(released.sort(), ['geometry', 'material'])
})
