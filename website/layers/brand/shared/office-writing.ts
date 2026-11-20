import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import type { Object3D } from 'three'
import { markerProgress, markerStrokes } from './mannerism.ts'
import type { OfficePlan } from './office-layout.ts'

export type BoardWriting = { age: number, writer: Object3D, side: 1 | -1 }
// Sheet pixels. Keep the four strokes in the board's empty upper-right corner.
export const boardStroke = (line: number, along: number) => [160 + along * 24, 9 + line * 6 + Math.sin(along * Math.PI * 4)] as const

/** The marker and the writing arm share a target on the board's front face. */
export function createOfficeWriting(plan: OfficePlan) {
  const root = new Group()
  const marker = new Group()
  marker.name = 'whiteboard-marker'
  const geometry = new CylinderGeometry(0.045, 0.045, 0.68, 8)
  const material = new MeshStandardMaterial({ color: '#E8D4A6', roughness: 0.7 })
  const barrel = new Mesh(geometry, material)
  barrel.rotation.x = Math.PI / 2
  marker.add(barrel)
  const tipGeometry = new CylinderGeometry(0.025, 0.03, 0.08, 8)
  const tipMaterial = new MeshStandardMaterial({ color: '#343C3B' })
  const tip = new Mesh(tipGeometry, tipMaterial)
  tip.rotation.x = Math.PI / 2
  tip.position.z = -0.38
  marker.rotation.set(0.3, 0.8, 0)
  marker.add(tip)
  marker.visible = false
  root.add(marker)
  const board = plan.props.find(prop => prop._tag === 'Whiteboard')!
  const fingers = new Map<Object3D, Quaternion>()
  const releaseGrip = () => { fingers.forEach((rest, joint) => joint.quaternion.copy(rest)); fingers.clear() }
  return {
    root,
    update(input?: BoardWriting) {
      releaseGrip()
      marker.visible = false
      if (!input || input.age < 0 || input.age >= 6.2) return
      const { age, writer, side } = input
      // The typing stop is too far from the board. Step beside the desk, then return before walking on.
      const weight = Math.min(1, age / 0.7, (6.2 - age) / 0.8)
      writer.position.x += 0.75 * weight
      writer.position.z -= 2.7 * weight
      const prefix = side === -1 ? 'right' : 'left'
      const hand = writer.getObjectByName(`${prefix}-hand`)
      const elbow = writer.getObjectByName(`${prefix}-elbow`)
      const shoulder = writer.getObjectByName(`${prefix}-shoulder`)
      if (!hand || !elbow || !shoulder) return
      const knuckles = hand.children.filter(joint => joint.name.startsWith(prefix + '-finger-'))
      const palm = knuckles.reduce((sum, joint) => sum.add(joint.position), new Vector3()).multiplyScalar(knuckles.length ? 0.65 / knuckles.length : 0)
      let hinges: Record<string, [number, number, number]> | undefined
      writer.traverse(object => { if (object.userData.finger_hinges) hinges = object.userData.finger_hinges })
      hand.traverse(joint => {
        const axis = hinges?.[joint.name]
        if (!axis) return
        fingers.set(joint, joint.quaternion.clone())
        joint.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(...axis).normalize(), 1.3 * weight))
      })
      const line = Math.max(0, markerStrokes(age) - 1)
      const along = Math.min(1, markerProgress(age) - line)
      const [x, y] = boardStroke(line, along)
      const target = new Vector3(board.position[0] - (board.size[0] - 0.12) / 2 + x / 192 * (board.size[0] - 0.12),
        board.position[1] + (board.size[1] - 0.12) / 2 - y / 108 * (board.size[1] - 0.12), board.position[2] + board.size[2] / 2 - 0.03)
      const nib = new Vector3(0, 0, -0.42).applyQuaternion(marker.quaternion)
      target.sub(nib).sub(new Vector3(0, 0, 0.15))
      // CCD in each joint's parent frame, so scaled model files use the same world target.
      for (let pass = 0; pass < 12; pass++) for (const joint of [elbow, shoulder]) {
        writer.updateWorldMatrix(true, true)
        const origin = joint.position.clone()
        const from = joint.parent!.worldToLocal(hand.localToWorld(palm.clone())).sub(origin).normalize()
        const to = joint.parent!.worldToLocal(target.clone()).sub(origin).normalize()
        joint.quaternion.premultiply(new Quaternion().setFromUnitVectors(from, to))
      }
      writer.updateWorldMatrix(true, true)
      marker.position.copy(root.worldToLocal(hand.localToWorld(palm.clone())))
      marker.position.z += 0.15
      marker.visible = age >= 0.7 && age < 5.4
    },
    dispose() { releaseGrip(); geometry.dispose(); material.dispose(); tipGeometry.dispose(); tipMaterial.dispose(); root.clear() },
  }
}
