import { AdditiveBlending, BufferGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, NearestFilter, Object3D, PlaneGeometry, SRGBColorSpace, TextureLoader, TorusGeometry, Vector3 } from 'three'
import { specimenGeometry } from './office-specimens'
import { creatures, critical, specimenCount, voteTotals, warning } from '#shared/office-experiment'
import type { Creature, Run } from '#shared/office-experiment'

export const board = new Vector3(-1.73, .80, -4.372)
export const printHeight = 1.43
const printWidth = printHeight * 592 / 690
// Front centre and aperture of the glass in build_monitor. Clear its convex centre by 2 mm.
export const computer = new Vector3(-1.6, -.4, -3.363)
export const screenWidth = .56
export const screenHeight = .41
const spout = new Vector3(-2.42, -.55, -3.22)
const mug = new Vector3(-.81, -.68, -3.28)
const noise = (id: number, salt: number) => {
  const value = Math.sin(id * 48.913 + salt * 17.23) * 43758.5453
  return value - Math.floor(value)
}
type Body = { kind: Creature, slot: number, at: number, x: number, y: number, z: number, flight: number, lift: number, hop: number, size: number, yaw: number, spin: number }
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
  // The paper sits just ahead of the enamel face. Its free corners lift from the board.
  const paper = new PlaneGeometry(printWidth, printHeight, 10, 12)
  const positions = paper.attributes.position!
  for (let i = 0; i < positions.count; i++) {
    const u = positions.getX(i) / printWidth + .5
    const v = .5 - positions.getY(i) / printHeight
    positions.setZ(i, .001 + .022 * v ** 4 * (u ** 5 + (1 - u) ** 7))
  }
  paper.computeVertexNormals()
  const boardSheet = new Mesh(paper, new MeshStandardMaterial({
    map: texture('whiteboard-join'), roughness: 1, metalness: 0, envMapIntensity: .08,
  }))
  boardSheet.position.copy(board)
  boardSheet.rotation.z = -.039
  group.add(boardSheet)

  const shade = document.createElement('canvas')
  shade.width = shade.height = 128
  const brush = shade.getContext('2d')!
  brush.shadowColor = '#000'
  brush.shadowBlur = 2
  brush.fillRect(3, 3, 122, 122)
  const shadowMap = new CanvasTexture(shade)
  const shadow = new Mesh(quad, new MeshBasicMaterial({
    map: shadowMap, color: 0x29271e, opacity: .3, transparent: true, depthWrite: false,
  }))
  shadow.position.copy(board).add(new Vector3(.008, -.009, -.003))
  shadow.scale.set(printWidth * 1.045, printHeight * 1.045, 1)
  shadow.rotation.z = boardSheet.rotation.z
  group.add(shadow)

  const magnet = new Mesh(new CylinderGeometry(.033, .037, .021, 14), new MeshStandardMaterial({ color: 0x694434, roughness: .65 }))
  magnet.position.set(-.18, printHeight / 2 - .035, .013)
  magnet.rotation.x = Math.PI / 2
  boardSheet.add(magnet)
  const raster = document.createElement('canvas')
  raster.width = 224
  raster.height = 164
  const phosphor = raster.getContext('2d')!
  const display = new CanvasTexture(raster)
  display.colorSpace = SRGBColorSpace
  const tube = new Mesh(quad, new MeshBasicMaterial({ map: display, toneMapped: false }))
  tube.position.copy(computer)
  tube.scale.set(screenWidth, screenHeight, 1)
  group.add(tube)
  let displayed = -1
  let displayedPresence = ''
  function drawCounter(run: Run, presence: string) {
    const count = specimenCount(run)
    if (displayed === count && displayedPresence === presence) return
    displayedPresence = presence
    displayed = count
    phosphor.fillStyle = '#10251e'
    phosphor.fillRect(0, 0, raster.width, raster.height)
    phosphor.fillStyle = '#a9dcb3'
    phosphor.font = 'bold 16px monospace'
    phosphor.fillText('Specimen counter', 12, 29)
    phosphor.font = 'bold 56px monospace'
    phosphor.fillText(String(count), 11, 91)
    phosphor.fillStyle = '#a0b7a1'
    phosphor.font = '14px monospace'
    phosphor.fillText('/ ' + critical, 144, 88)
    phosphor.fillStyle = '#345648'
    phosphor.fillRect(12, 108, 200, 8)
    phosphor.fillStyle = count >= warning ? '#ecc579' : '#9ddaa5'
    phosphor.fillRect(12, 108, count / critical * 200, 8)
    phosphor.font = '11px monospace'
    phosphor.fillText('Warning ' + warning, 12, 130)
    phosphor.fillText(presence, 124, 130)
    const votes = voteTotals(run)
    for (const [index, kind] of (Object.keys(creatures) as Creature[]).entries())
      phosphor.fillText(creatures[kind] + ' ' + votes[kind], 12 + 52 * index, 151)
    display.needsUpdate = true
  }
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
  const layers = new Map<Creature, InstancedMesh<BufferGeometry, MeshStandardMaterial>>()
  for (const kind of Object.keys(creatures) as Creature[]) {
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: kind === 'beetle' ? .28 : .68, metalness: kind === 'beetle' ? .24 : .04 })
    const layer = new InstancedMesh(specimenGeometry(kind, false), material, critical)
    layer.count = 0
    layer.frustumCulled = false
    group.add(layer)
    layers.set(kind, layer)
  }
  const keepsake = new Group()
  const ceramic = new MeshStandardMaterial({ color: 0xab6651, roughness: .6, side: DoubleSide })
  const cup = new Mesh(new CylinderGeometry(.115, .10, .25, 8, 1, true), ceramic)
  const handle = new Mesh(new TorusGeometry(.066, .014, 4, 8), ceramic)
  handle.position.x = .118
  const snail = layers.get('snail')!
  const survivor = new Mesh(specimenGeometry('snail'), snail.material)
  survivor.scale.setScalar(.2)
  survivor.position.set(.05, .128, .06)
  survivor.rotation.y = -.3
  keepsake.add(cup, handle, survivor)
  keepsake.position.set(-2.05, -2.07, 2.42)
  const bodies: Body[] = []
  const pile = new Map<string, number>()
  const pose = new Object3D()
  let id = ''
  let processed = 0
  function update(run: Run, now: number, still: boolean, presence: string) {
    drawCounter(run, presence)
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
        bodies.push({ kind, slot: layer.count++, at: drop.at + i * 40, x, z, y: index === 1 ? mug.y : surface + height,
          flight: .62 + noise(index, 3) * .32, lift: kind === 'fly' ? 1.65 : kind === 'snail' ? .65 : 1.05,
          hop: kind === 'cricket' ? .44 : kind === 'beetle' ? .24 : .09, size: index === 1 ? .38 : .26, yaw: index === 1 ? -.25 : noise(index, 4) * Math.PI * 2, spin: (noise(index, 5) - .5) * 7 })
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
      pose.rotation.set(Math.sin(t * Math.PI) * b.spin, b.yaw + (1 - t) * b.spin, Math.sin(t * Math.PI * 2) * .55)
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
      if (child instanceof InstancedMesh) { child.geometry.dispose(); child.dispose() }
    }
    magnet.geometry.dispose(); magnet.material.dispose(); paper.dispose()
    survivor.geometry.dispose(); cup.geometry.dispose(); handle.geometry.dispose(); ceramic.dispose(); keepsake.removeFromParent()
    quad.dispose(); glass.geometry.dispose(); group.removeFromParent()
  }
  return { group, stations: [boardSheet, tube], keepsake, update, dispose }
}
