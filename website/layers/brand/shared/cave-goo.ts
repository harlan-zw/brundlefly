import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Group, Mesh, SphereGeometry, TubeGeometry, Vector3 } from 'three'
import type { MeshPhysicalMaterial } from 'three'

export type CaveGooAttachment = { start: Vector3, end: Vector3, startNormal: Vector3, endNormal: Vector3, length: number, width: number }
export type CaveGooMotion = { time: number, breath: number, flow: number }

/** Film, neck, and drop share one connected root. The caller owns the wet material. */
export function createCaveGoo(material: MeshPhysicalMaterial, attachments: readonly CaveGooAttachment[]) {
  const root = new Group()
  root.name = 'Attached cave slime'
  const geometries = new Set<BufferGeometry>()
  const drops: { group: Group, neck: Mesh, drop: Mesh, end: Vector3, length: number, phase: number }[] = []
  const droplet = new SphereGeometry(1, 16, 12)
  const dropletPositions = droplet.getAttribute('position')
  for (let index = 0; index < dropletPositions.count; index++) {
    const y = dropletPositions.getY(index), radius = 0.76 - y * 0.43
    dropletPositions.setXYZ(index, dropletPositions.getX(index) * radius, y, dropletPositions.getZ(index) * radius)
  }
  droplet.computeVertexNormals()
  geometries.add(droplet)
  attachments.forEach(({ start, end, startNormal, endNormal, length, width }, index) => {
    const assembly = new Group()
    for (const [point, normal] of [[start, startNormal], [end, endNormal]] as const) {
      const coating = new Mesh(droplet, material)
      coating.position.copy(point).addScaledVector(normal, 0.04)
      coating.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), normal)
      coating.scale.set(0.23, 0.2, 0.2)
      assembly.add(coating)
    }
    const positions: number[] = [], uv: number[] = [], indices: number[] = []
    const segments = 24
    for (let step = 0; step <= segments; step++) {
      const t = step / segments
      const point = start.clone().lerp(end, t)
      point.y -= Math.sin(t * Math.PI) * (0.19 + width * 0.65)
      const spread = width * (0.2 + Math.sin(t * Math.PI) * 0.8)
      for (let cross = 0; cross <= 4; cross++) {
        const s = cross / 4 - 0.5
        positions.push(point.x + s * 0.14 * Math.sin(t * Math.PI), point.y - s * spread,
          point.z + s * spread + Math.cos(s * Math.PI) * Math.sin(t * Math.PI) * 0.04)
        uv.push(t, cross / 4)
        if (step < segments && cross < 4) {
          const a = step * 5 + cross
          indices.push(a, a + 5, a + 1, a + 1, a + 5, a + 6)
        }
      }
    }
    const film = new BufferGeometry()
    film.setAttribute('position', new Float32BufferAttribute(positions, 3))
    film.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    film.setIndex(indices); film.computeVertexNormals(); geometries.add(film)
    assembly.add(new Mesh(film, material))
    const anchor = start.clone().lerp(end, 0.43)
    anchor.y -= Math.sin(0.43 * Math.PI) * (0.19 + width * 0.65)
    const curve = new CatmullRomCurve3([new Vector3(), new Vector3(0.08 * Math.sin(index), -length * 0.3, 0.055),
      new Vector3(-0.055 * Math.cos(index), -length * 0.72, -0.03), new Vector3(0.035 * Math.sin(index * 2), -length, 0.035)])
    const neckGeometry = new TubeGeometry(curve, 28, 0.045, 8, false)
    const neckPositions = neckGeometry.getAttribute('position')
    for (let vertex = 0; vertex < neckPositions.count; vertex++) {
      const t = Math.floor(vertex / 9) / 28, center = curve.getPointAt(t)
      const taper = 0.22 + Math.exp(-t * 13) * 2.4 + Math.exp(-(1 - t) * 20) * 0.45
      neckPositions.setXYZ(vertex, center.x + (neckPositions.getX(vertex) - center.x) * taper,
        center.y + (neckPositions.getY(vertex) - center.y) * taper, center.z + (neckPositions.getZ(vertex) - center.z) * taper)
    }
    neckGeometry.computeVertexNormals(); geometries.add(neckGeometry)
    const neck = new Mesh(neckGeometry, material)
    neck.position.copy(anchor); assembly.add(neck)
    const drop = new Mesh(droplet, material)
    assembly.add(drop)
    drops.push({ group: assembly, neck, drop, end: curve.getPointAt(1).add(anchor), length, phase: index * 0.173 })
    root.add(assembly)
  })
  let previousTime: number | undefined, flowPhase = 0, breathPhase = 0
  const update = ({ time, breath, flow }: CaveGooMotion) => {
    const delta = previousTime === undefined ? 0 : Math.max(0, Math.min(0.1, time - previousTime))
    previousTime = time
    flowPhase += delta * Math.max(0, flow)
    breathPhase += delta * Math.max(0, breath)
    for (const { group, neck, drop, end, length, phase } of drops) {
      const cycle = (flowPhase * 0.12 + phase) % 1
      const growth = Math.min(1, cycle / 0.78), fall = Math.max(0, (cycle - 0.78) / 0.22)
      const stretch = 1 + growth * 0.14 + Math.sin(breathPhase * 0.63 + phase * 7) * 0.018
      group.position.y = Math.sin(breathPhase * 0.46 + phase * 5) * 0.025
      neck.scale.y = stretch
      drop.position.copy(end)
      drop.position.y = neck.position.y - length * stretch - fall * fall * 3.7
      const size = 0.042 + growth * 0.028
      const edge = cycle < 0.08 ? cycle / 0.08 : cycle > 0.94 ? (1 - cycle) / 0.06 : 1
      const life = edge * edge * (3 - 2 * edge)
      drop.scale.set(size * life, size * (1.7 + growth * 1.5 - fall * 0.7) * life, size * 0.88 * life)
      drop.visible = cycle > 0.012 && cycle < 0.985 && life > 0.003
        && drop.position.y > (Math.abs(end.x) < 2.5 ? 1.8 : -2.16)
    }
  }
  update({ time: 0, breath: 0, flow: 0 })
  return { root, update, dispose() { geometries.forEach(geometry => geometry.dispose()); root.clear() } }
}
