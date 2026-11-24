import { CanvasTexture, Color, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, Path, PlaneGeometry, Shape, ShapeGeometry, SRGBColorSpace, Vector3 } from 'three'
import { officePlan } from '@brundlefly/brand/shared/office-layout'
import type { OfficePlan } from '@brundlefly/brand/shared/office-layout'
import { joinAddress, joinCode, quietZone } from '#shared/join-code'
import { specimenGeometry } from './office-specimens'

/**
 * The join code. A lamp comes on behind the glass of the test chamber, and beetles crawl onto the glass.
 * Each beetle stops on one dark module of the QR symbol for the join address, so a phone camera reads the swarm as that address.
 * The marks a scanner finds the symbol by are dense masses of beetles, with no gap in them.
 */
// Seconds for the swarm to gather. It leaves faster.
const gatherTime = 2.8
// The width of a beetle's shell on its module: neighbours touch. In a mark the beetles lie deep, and the mass under them fills each module to its edge.
const shell = 1
const massed = 1
const massColour = 0x161D19
// How much of a mark's half width its corners round off, from 0 for a square to 1 for a circle.
const roundness = 0.62
// The lit glass. It is pale and flat, so the dark shells keep their contrast on a projector.
const glassColour = '#E6EDD6'
const shellTint = 0x4a5650

const smooth = (value: number) => { const share = Math.max(0, Math.min(1, value)); return share * share * (3 - 2 * share) }
const chance = (index: number, salt: number) => { const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453; return value - Math.floor(value) }

/**
 * How the code reads against the glass. `glass` is how solid the ground on the pane is, from 0, clear glass, to 1.
 * `bugs` is how bright the beetles are, from 0, dark shells on a pale ground, to 1, shells that glow on smoked glass. The ground darkens as they brighten.
 * A scanner needs one of the two to carry the contrast. The balance is the owner's to find on a real phone.
 */
export type CodeLook = { glass: number, bugs: number }
// The owner found this balance with a phone: glass that is almost clear, and beetles that glow.
export const defaultCodeLook: CodeLook = { glass: 0.3, bugs: 1 }
// A beetle at full glow, and the ink of the address at each end.
const glowColour = new Color('#DFFFC8')
const darkInk = '#1C2620'
const smokeColour = new Color('#060D0A')

export function createJoinSwarm(plan: OfficePlan = officePlan, look: CodeLook = defaultCodeLook) {
  let { glass, bugs } = look
  const group = new Group()
  group.name = 'Join code'
  group.visible = false
  const windowProp = plan.props.find(prop => prop._tag === 'ChamberWindow')!
  const [wx, wy, wz] = windowProp.position
  // The lit part of the glass: the symbol with its quiet zone, and a strip under it for the address in letters.
  const code = joinCode()
  const side = Math.min(windowProp.size[1] - 0.52, 1.36)
  const strip = 0.17
  const module = side / (code.size + quietZone * 2)
  const centre = new Vector3(wx, wy, wz + windowProp.size[2] / 2 + 0.012)
  const lit = { width: side + 0.12, height: side + strip + 0.06 }
  const symbolY = centre.y + strip / 2
  // The pane of the window, inside its frame. The ground of the code covers all of it, as thin as the look says, so the chamber still shows through.
  const glassSize = { width: windowProp.size[0] - 0.4, height: windowProp.size[1] - 0.36 }
  const sheet = document.createElement('canvas')
  sheet.width = 1024
  sheet.height = Math.round(1024 * glassSize.height / glassSize.width)
  const lamp = new CanvasTexture(sheet)
  lamp.colorSpace = SRGBColorSpace
  function paint() {
    const brush = sheet.getContext('2d')!
    const { width, height } = sheet
    const scale = width / glassSize.width
    brush.clearRect(0, 0, width, height)
    // The ground behind the symbol is as solid as `glass` says. It is pale under dark beetles, and turns to smoked glass as the beetles brighten:
    // glowing beetles need a dark, plain ground, and the chamber behind clear glass is neither.
    const ground = `#${new Color(glassColour).lerp(smokeColour, bugs).getHexString()}`
    // The whole pane takes the ground, from frame to frame. A square of it behind the symbol alone read as a patch stuck on the glass.
    brush.globalAlpha = glass
    brush.fillStyle = ground
    brush.fillRect(0, 0, width, height)
    // The address is dark on the light, and light on clear glass.
    brush.globalAlpha = 1
    brush.fillStyle = bugs > 0.5 ? `#${glowColour.getHexString()}` : darkInk
    brush.font = `600 ${Math.round(strip * scale * 0.52)}px "IBM Plex Mono", ui-monospace, monospace`
    brush.textAlign = 'center'
    brush.textBaseline = 'middle'
    brush.fillText(joinAddress, width / 2, height / 2 + (lit.height / 2 - strip * 0.6) * scale)
    lamp.needsUpdate = true
  }
  const panelGeometry = new PlaneGeometry(glassSize.width, glassSize.height)
  const panel = new Mesh(panelGeometry, new MeshBasicMaterial({ map: lamp, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }))
  panel.position.copy(centre)
  panel.renderOrder = 2
  group.add(panel)

  // The specimen beetle, seen from above: shorter, so its shell is nearly round, and turned to stand on the glass.
  const geometry = specimenGeometry('beetle', false)
  // The model's shell is 0.94 long and 0.46 wide. The squeeze leaves it 0.5 long.
  // Its legs reach far past the shell and would speckle the pale modules beside it, so they draw in to less than half their reach.
  const points = geometry.getAttribute('position')
  for (let index = 0; index < points.count; index++) {
    const side = points.getZ(index)
    if (Math.abs(side) > 0.24) points.setZ(index, Math.sign(side) * (0.24 + (Math.abs(side) - 0.24) * 0.4))
  }
  geometry.scale(0.54, 1, 1).rotateX(Math.PI / 2)
  // One unit of the model is two shell widths.
  const unit = 2
  const material = new MeshBasicMaterial({ vertexColors: true, color: shellTint, toneMapped: false })
  // The shells take their own dark colours at `bugs` 0, and move to one glowing colour as it rises.
  const glow = { value: bugs }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = glow
    shader.uniforms.uGlowColour = { value: glowColour }
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb = mix(diffuseColor.rgb, uGlowColour, uGlow);')
      .replace('void main() {', 'uniform float uGlow;\nuniform vec3 uGlowColour;\nvoid main() {')
  }
  const swarm = new InstancedMesh(geometry, material, code.cells.length)
  swarm.frustumCulled = false
  swarm.renderOrder = 4
  const half = (code.size - 1) / 2
  const placeOf = (x: number, y: number) => [centre.x + (x - half) * module, symbolY - (y - half) * module] as const
  // A mark is a round-cornered ring and a round-cornered middle, not the hard squares of a printed code.
  // A scanner reads a mark by the widths across its middle, and those are the same. The mass under its beetles is solid, so the ring has no gap.
  const rounded = <T extends Path>(path: T, reach: number): T => {
    const corner = reach * roundness
    path.moveTo(-reach + corner, -reach)
    path.lineTo(reach - corner, -reach); path.quadraticCurveTo(reach, -reach, reach, -reach + corner)
    path.lineTo(reach, reach - corner); path.quadraticCurveTo(reach, reach, reach - corner, reach)
    path.lineTo(-reach + corner, reach); path.quadraticCurveTo(-reach, reach, -reach, reach - corner)
    path.lineTo(-reach, -reach + corner); path.quadraticCurveTo(-reach, -reach, -reach + corner, -reach)
    return path
  }
  const massMaterial = new MeshBasicMaterial({ color: massColour, toneMapped: false })
  const masses = code.marks.flatMap((mark) => {
    const [x, y] = placeOf(mark.x, mark.y)
    const ring = rounded(new Shape(), mark.reach * module)
    ring.holes.push(rounded(new Path(), (mark.reach - 1) * module))
    return [new ShapeGeometry(ring, 8), new ShapeGeometry(rounded(new Shape(), (mark.reach - 2) * module), 8)].map((shape) => {
      const mesh = new Mesh(shape, massMaterial)
      mesh.position.set(x, y, centre.z + 0.002)
      mesh.renderOrder = 3
      return mesh
    })
  })
  group.add(...masses, swarm)
  const reach = { x: windowProp.size[0] / 2 - 0.2, y: windowProp.size[1] / 2 - 0.2 }
  const beetles = code.cells.map((cell, index) => {
    // A beetle of a mark stands on its ring or on its disc.
    const mark = cell.mark ? code.marks.find(found => Math.max(Math.abs(cell.x - found.x), Math.abs(cell.y - found.y)) < found.reach) : undefined
    // The beetles at the corners of a mark draw in, onto its round corners.
    const cornered = mark && Math.abs(cell.x - mark.x) === Math.abs(cell.y - mark.y) && cell.x !== mark.x
    const pull = cornered ? 1 - roundness * 0.3 : 1
    const [homeX, homeY] = mark ? placeOf(mark.x + (cell.x - mark.x) * pull, mark.y + (cell.y - mark.y) * pull) : placeOf(cell.x, cell.y)
    // It comes in from the frame of the window, on the side nearest its module.
    const edge = chance(index, 1)
    const fromSide = Math.abs(homeX - centre.x) / reach.x > Math.abs(homeY - centre.y) / reach.y
    const fromX = fromSide ? centre.x + Math.sign(homeX - centre.x || 1) * reach.x * 1.02 : centre.x + (edge * 2 - 1) * reach.x
    const fromY = fromSide ? centre.y + (edge * 2 - 1) * reach.y : centre.y + Math.sign(homeY - centre.y || 1) * reach.y * 1.02
    return { homeX, homeY, fromX, fromY, wait: chance(index, 2) * 0.45, sway: (chance(index, 3) - 0.5) * 0.5, heading: chance(index, 4) * Math.PI * 2,
      scale: module * unit * (cell.mark ? massed : shell) }
  })
  const pose = new Object3D()
  let gathered = 0
  let drawn = -1

  /** `shown` asks for the code. The swarm gathers while it is true and leaves when it is false. */
  function update(shown: boolean, delta: number, still: boolean) {
    gathered = still ? Number(shown) : Math.max(0, Math.min(1, gathered + (shown ? delta / gatherTime : -delta / gatherTime * 1.8)))
    group.visible = gathered > 0
    if (gathered === drawn) return false
    if (drawn <= 0) paint()
    drawn = gathered
    // The lamp comes on first, then they come to the light.
    panel.material.opacity = smooth(gathered * 3.5)
    massMaterial.color.set(massColour).lerp(glowColour, bugs)
    // The mass grows under the beetles of a mark as the last of them stop.
    for (const mesh of masses) mesh.scale.setScalar(smooth((gathered - 0.8) / 0.2))
    beetles.forEach((beetle, index) => {
      const share = smooth((gathered - 0.22 - beetle.wait * 0.6) / (0.78 - 0.45 * 0.6))
      const bend = Math.sin(share * Math.PI) * beetle.sway
      const x = beetle.fromX + (beetle.homeX - beetle.fromX) * share - (beetle.homeY - beetle.fromY) * bend
      const y = beetle.fromY + (beetle.homeY - beetle.fromY) * share + (beetle.homeX - beetle.fromX) * bend
      pose.position.set(x, y, centre.z + 0.004)
      // It walks head first, and turns a little as it stops.
      const course = Math.atan2(beetle.homeY - beetle.fromY, beetle.homeX - beetle.fromX)
      pose.rotation.set(0, 0, course + (beetle.heading - course) * smooth((share - 0.8) / 0.2) + Math.sin(share * 40 + index) * 0.12 * (1 - share))
      pose.scale.setScalar(share > 0 ? beetle.scale : 0)
      pose.updateMatrix()
      swarm.setMatrixAt(index, pose.matrix)
    })
    swarm.instanceMatrix.needsUpdate = true
    return gathered > 0 && gathered < 1
  }
  function dispose() {
    lamp.dispose(); panelGeometry.dispose(); panel.material.dispose()
    geometry.dispose(); material.dispose(); swarm.dispose()
    masses.forEach(mesh => mesh.geometry.dispose()); massMaterial.dispose()
    group.removeFromParent()
  }
  /** The window as a click target, and the lit glass as the camera frames it. */
  /** Changes the look while the code shows, so the balance can be found by eye and by phone. */
  function setLook(next: CodeLook) {
    glass = Math.max(0, Math.min(1, next.glass))
    bugs = Math.max(0, Math.min(1, next.bugs))
    glow.value = bugs
    paint()
    drawn = -1
  }
  return { group, update, dispose, setLook, look: () => ({ glass, bugs }), window: { centre: new Vector3(wx, wy, centre.z), width: windowProp.size[0], height: windowProp.size[1] }, lit: { centre, ...lit } }
}
