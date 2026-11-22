import { BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Quaternion, SphereGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Creature } from '../shared/office-experiment.ts'

type Point = [number, number, number]
type Part = { geometry: BufferGeometry, colour: string }

// Sculpt in local space. Feet rest at y=0 and the head faces +x.
// Each finished specimen has one indexed mesh and one vertex-colour material.
function sculpt(closeUp: boolean) {
  const pieces: Part[] = []
  function oval(centre: Point, size: Point, colour: string, tilt = 0, lean = 0) {
    const shape = new SphereGeometry(1, closeUp ? 8 : 6, closeUp ? 4 : 3)
    shape.scale(...size).rotateZ(tilt).rotateY(lean).translate(...centre)
    pieces.push({ geometry: shape, colour })
  }
  function taper(start: Point, end: Point, base: number, tip: number, colour: string) {
    const a = new Vector3(...start)
    const b = new Vector3(...end)
    const shaft = new CylinderGeometry(tip, base, a.distanceTo(b), 5, 1, true)
    const direction = b.clone().sub(a).normalize()
    shaft.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction))
    const centre = a.lerp(b, .5)
    shaft.translate(centre.x, centre.y, centre.z)
    pieces.push({ geometry: shaft, colour })
  }
  function leg(root: Point, knee: Point, toe: Point, base: number, colour: string) {
    taper(root, knee, base, base * .67, colour)
    taper(knee, toe, base * .67, .005, colour)
  }
  function finish() {
    for (const { geometry, colour } of pieces) {
      geometry.deleteAttribute('uv')
      if (geometry.hasAttribute('color')) continue
      const rgb = new Color(colour)
      const values = new Float32Array(geometry.getAttribute('position').count * 3)
      for (let i = 0; i < values.length; i += 3) rgb.toArray(values, i)
      geometry.setAttribute('color', new Float32BufferAttribute(values, 3))
    }
    const result = mergeGeometries(pieces.map(piece => piece.geometry))!
    pieces.forEach(piece => piece.geometry.dispose())
    result.computeBoundingSphere()
    return result
  }
  return { oval, taper, leg, pieces, finish, closeUp }
}

// A thick outer whorl surrounds an elevated, narrowing spiral on each cheek.
// Its bands follow the shell meridian, so they wrap around it as it turns.
function shell(closeUp: boolean) {
  const vertices: number[] = [], colours: number[] = [], indices: number[] = []
  const sectors = closeUp ? 24 : 14, rings = closeUp ? 12 : 8
  const amber = new Color('#bd7946'), cream = new Color('#e3b780'), umber = new Color('#573523')
  for (let j = 0; j <= rings; j++) {
    const latitude = j / rings * Math.PI
    const reach = Math.sin(latitude)
    for (let i = 0; i <= sectors; i++) {
      const theta = i / sectors * Math.PI * 2
      const wave = Math.cos(2 * latitude + 1.75 * Math.PI * reach - theta)
      const groove = Math.max(0, wave) ** 5
      const radius = reach * (.345 - .045 * groove)
      vertices.push(-.13 + radius * Math.cos(theta), .43 + radius * Math.sin(theta),
        Math.cos(latitude) * (.23 + .028 * groove))
      const stripe = Math.cos(latitude * 15 + .55 * Math.sin(theta))
      const colour = amber.clone().lerp(stripe > 0 ? cream : umber, .2 + .53 * Math.abs(stripe)).lerp(umber, groove * .64)
      colours.push(colour.r, colour.g, colour.b)
      if (i < sectors && j < rings) {
        const a = j * (sectors + 1) + i, b = a + sectors + 1
        indices.push(a, b, a+1, b, b+1, a+1)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setIndex(indices)
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
  geometry.computeVertexNormals()
  return geometry
}

function snail(s: ReturnType<typeof sculpt>) {
  s.oval([-.03,.093,0], [.59,.09,.18], '#a99b70')
  s.oval([.23,.16,0], [.29,.13,.14], '#837c56', .17)
  s.pieces.push({ geometry: shell(s.closeUp), colour: '#bd7946' })
  for (const side of [-1, 1]) {
    const tip: Point = [.56,.42,side*.13]
    s.taper([.37,.23,side*.07], tip,.025,.014,'#9c966d')
    s.oval(tip,[.031,.032,.03],'#392f21')
    s.taper([.41,.14,side*.08],[.55,.18,side*.16],.017,.005,'#aaa177')
    // A raised coil makes the whorl legible on the tiny falling model.
    if (!s.closeUp) continue
    let previous: Point = [-.13,.43,side*.26]
    for(let step=1;step<=14;step++) {
      const t=step/14, angle=t*Math.PI*3.4
      const point: Point=[-.13+.22*t*Math.cos(angle),.43+.22*t*Math.sin(angle),side*(.26-.073*t*t)]
      s.taper(previous,point,.01+.002*t,.01+.002*t,'#73452b')
      previous=point
    }
  }
}
function insectLegs(s: ReturnType<typeof sculpt>, hind = false) {
  for (const side of [-1, 1]) {
    for (const x of [-.21, .01, .23]) {
      if (hind && x < 0) continue
      s.leg([x,.19,side*.08],[x-.07,.16,side*.29],[x+.04,.012,side*.39],.035,'#514d34')
    }
  }
}
function beetle(s: ReturnType<typeof sculpt>) {
  insectLegs(s)
  s.oval([-.12,.205,0],[.35,.16,.225],'#293c34')
  for (const side of [-1,1]) {
    s.oval([-.14,.26,side*.102],[.34,.17,.128],side>0?'#3b7562':'#45735a',.045)
    s.leg([.37,.23,side*.06],[.48,.31,side*.12],[.55,.33,side*.20],.018,'#493f2c')
  }
  s.oval([.20,.26,0],[.16,.15,.216],'#435b4e')
  s.oval([.35,.216,0],[.123,.098,.132],'#303b32')
}
function fly(s: ReturnType<typeof sculpt>) {
  insectLegs(s)
  s.oval([-.19,.245,0],[.295,.12,.13],'#62695a',-.1)
  s.oval([.075,.29,0],[.18,.16,.16],'#47504a')
  s.oval([.29,.29,0],[.118,.116,.141],'#393a2f')
  for (const side of [-1,1]) {
    s.oval([.325,.31,side*.094],[.085,.097,.064],'#a54b34')
    s.oval([-.14,.416,side*.26],[.34,.021,.096],'#b7c9bd',.04,side*.63)
    s.taper([.12,.416,side*.092],[-.35,.427,side*.407],.014,.007,'#788f85')
  }
}
function cricket(s: ReturnType<typeof sculpt>) {
  insectLegs(s,true)
  s.oval([-.09,.27,0],[.375,.123,.128],'#857348',.06)
  s.oval([.235,.3,0],[.154,.142,.157],'#80774b')
  for (const side of [-1,1]) {
    s.oval([-.17,.35,side*.055],[.29,.041,.065],'#968553',.12)
    const knee: Point=[-.39,.46,side*.18]
    s.taper([.055,.23,side*.092],knee,.082,.045,'#a48d53')
    s.leg(knee,[-.15,.035,side*.29],[-.34,.012,side*.34],.029,'#685c39')
    s.oval([.292,.34,side*.127],[.037,.045,.027],'#302d24')
    s.leg([.33,.36,side*.05],[.49,.50,side*.10],[.69,.52,side*.17],.016,'#7a704d')
  }
}
export function specimenGeometry(kind: Creature, closeUp = true): BufferGeometry {
  const shape = sculpt(closeUp)
  const build = { snail, beetle, fly, cricket }
  build[kind](shape)
  return shape.finish()
}
