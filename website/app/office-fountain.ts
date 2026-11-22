import { AdditiveBlending, CanvasTexture, CylinderGeometry, DoubleSide, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, NearestFilter, Object3D, PlaneGeometry, SRGBColorSpace, TextureLoader, TorusGeometry, Vector3 } from 'three'
import { creatures, critical } from '#shared/office-experiment'
import type { Creature, Run } from '#shared/office-experiment'

export const board = new Vector3(-1.9, .78, -4.32)
export const computer = new Vector3(-1.6, -.52, -3.32)
const spout = new Vector3(-2.42, -.55, -3.22)
const mug = new Vector3(-.81, -.68, -3.28)
const noise = (id: number, salt: number) => {
  const value = Math.sin(id * 48.913 + salt * 17.23) * 43758.5453
  return value - Math.floor(value)
}
type Body = { kind: Creature, slot: number, at: number, x: number, y: number, z: number, flight: number, lift: number, hop: number, size: number }
export function createFountain() {
  const group = new Group()
  const quad = new PlaneGeometry(1, 1)
  const loader = new TextureLoader()
  const texture = (file: string) => {
    const map = loader.load('/brand/office/experiment/' + file + '.png')
    map.colorSpace = SRGBColorSpace
    map.magFilter = NearestFilter
    return map
  }
  const panel = (name: string, w: number, h: number, position: Vector3) => {
    const mesh = new Mesh(quad, new MeshBasicMaterial({ map: texture(name), toneMapped: false }))
    mesh.position.copy(position)
    mesh.scale.set(w, h, 1)
    group.add(mesh)
    return mesh
  }
  // A square sheet keeps the QR modules square on the wide existing board.
  const boardSheet = panel('whiteboard-join', 1.54, 1.54, board)
  panel('crt-glass', .62, .47, computer)
  const trail = panel('snail-trail', 1.3, .45, new Vector3(-1.6, -.941, -3.36))
  trail.rotation.x = -Math.PI / 2
  trail.material.transparent = true
  trail.material.depthWrite = false
  const arc = panel('green-arc', 2.7, 1.8, new Vector3(-1.55, -.81, -3.02))
  arc.material.blending = AdditiveBlending
  arc.material.transparent = true
  arc.material.depthWrite = false
  const glass = new Mesh(new CylinderGeometry(.19, .15, .38, 16, 1, true), new MeshBasicMaterial({
    color: 0xa4c9ba, transparent: true, opacity: .35, side: DoubleSide, depthWrite: false,
  }))
  glass.position.set(spout.x, spout.y - .19, spout.z)
  group.add(glass)
  const layers = new Map<Creature, InstancedMesh<PlaneGeometry, MeshBasicMaterial>>()
  for (const [name, emoji] of Object.entries(creatures)) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 96
    const ctx = canvas.getContext('2d')!
    ctx.font = '76px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(emoji, 48, 49)
    const map = new CanvasTexture(canvas)
    map.colorSpace = SRGBColorSpace
    const layer = new InstancedMesh(quad, new MeshBasicMaterial({ map, alphaTest: .22, side: DoubleSide, toneMapped: false }), critical)
    layer.count = 0
    layer.frustumCulled = false
    group.add(layer)
    layers.set(name as Creature, layer)
  }
  const keepsake = new Group()
  const ceramic = new MeshStandardMaterial({ color: 0xab6651, roughness: .6, side: DoubleSide })
  const cup = new Mesh(new CylinderGeometry(.115, .10, .25, 8, 1, true), ceramic)
  const handle = new Mesh(new TorusGeometry(.066, .014, 4, 8), ceramic)
  handle.position.x = .118
  const survivor = new Mesh(quad, layers.get('snail')!.material)
  survivor.scale.setScalar(.2)
  survivor.position.set(.05, .16, .06)
  keepsake.add(cup, handle, survivor)
  keepsake.position.set(-2.05, -2.07, 2.42)
  const bodies: Body[] = []
  const pile = new Map<string, number>()
  const pose = new Object3D()
  let id = ''
  let processed = 0
  function update(run: Run, now: number, still: boolean) {
    if (id !== run.id) {
      id = run.id; processed = 0; bodies.length = 0; pile.clear()
      for (const layer of layers.values()) layer.count = 0
    }
    for (; processed < run.drops.length; processed++) {
      const drop = run.drops[processed]!
      for (let i = 0; i < drop.size; i++) {
        const index = drop.first + i
        const kind = i === 0 ? drop.kind : 'snail'
        const layer = layers.get(kind)!
        const x = index === 1 ? mug.x : spout.x + (noise(index, 1) - .3) * 3
        const z = index === 1 ? mug.z : spout.z + noise(index, 2) * 2.6
        const cell = Math.floor(x * 4) + '/' + Math.floor(z * 4)
        const height = pile.get(cell) ?? 0
        pile.set(cell, height + .047)
        const surface = z < -3 && x < -.55 && x > -3.6 ? -.95 : -2.2
        bodies.push({ kind, slot: layer.count++, at: drop.at + i * 40, x, z, y: index === 1 ? mug.y : surface + .09 + height,
          flight: .62 + noise(index, 3) * .32, lift: kind === 'fly' ? 1.65 : kind === 'snail' ? .65 : 1.05,
          hop: kind === 'cricket' ? .44 : kind === 'beetle' ? .24 : .09, size: index === 1 ? .29 : .21 })
      }
    }
    // Resting specimens keep their last GPU matrix. Only airborne specimens need frames.
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i]!
      const age = still ? 10 : (now - b.at) / 1000
      const t = Math.max(0, Math.min(1, age / b.flight))
      const after = Math.max(0, Math.min(1, (age - b.flight) / .36))
      pose.position.set(spout.x + (b.x - spout.x) * t, spout.y + (b.y - spout.y) * t
        + 4 * b.lift * t * (1 - t) + 4 * b.hop * after * (1 - after), spout.z + (b.z - spout.z) * t)
      pose.scale.setScalar(age < 0 ? 0 : b.size)
      pose.rotation.z = Math.sin(t * Math.PI * 2) * .4
      pose.updateMatrix()
      const layer = layers.get(b.kind)!
      layer.setMatrixAt(b.slot, pose.matrix)
      layer.instanceMatrix.needsUpdate = true
      if (after >= 1) bodies.splice(i, 1)
    }
    trail.visible = run.drops.length > 0
    const end = run.drops.at(-1)
    const elapsed = end ? now - end.at : 0
    arc.visible = !!end && end.first + end.size - 1 === critical && elapsed < 4500 && !still
    arc.rotation.z = elapsed > 2200 ? -.6 : .15
  }
  function dispose() {
    for (const child of group.children) {
      if (!(child instanceof Mesh)) continue
      child.material.map?.dispose()
      child.material.dispose()
      if (child instanceof InstancedMesh) child.dispose()
    }
    cup.geometry.dispose(); handle.geometry.dispose(); ceramic.dispose(); keepsake.removeFromParent()
    quad.dispose(); glass.geometry.dispose(); group.removeFromParent()
  }
  return { group, boardSheet, keepsake, update, dispose }
}
