import { AdditiveBlending, CanvasTexture, Group, Mesh, MeshBasicMaterial, NearestFilter, PlaneGeometry, PointLight, SRGBColorSpace, Vector3 } from 'three'
import type { Ray } from 'three'
import { officePlan } from '@brundlefly/brand/shared/office-layout'
import type { OfficePlan } from '@brundlefly/brand/shared/office-layout'
import type { SetMarks } from '@brundlefly/brand/shared/scene-set'
import { paintExperimentBoard } from '#shared/office-board'
import { creatureKinds, creatures, loadedPercent, specimenCount } from '#shared/office-experiment'
import type { Creature, Experiment } from '#shared/office-experiment'
import type { CriticalFrame } from '#shared/office-critical'
import { createSpecimenRain } from './office-rain'
import { createJoinSwarm } from './office-swarm'

/**
 * Where the visitor looks in the office. `room` is the room's own view. `computer` is the screen of the desk computer, where the counter's keys are.
 * `code` is the window of the test chamber, where the join code gathers.
 */
export type Station = 'room' | 'computer' | 'code'

// The front centre of the monitor's glass and its aperture, from build_monitor in the office build script. The plane clears the glass by 2 mm.
const glass = { centre: new Vector3(-1.6, -0.4, -3.363), width: 0.56, height: 0.41 }

export type StageInput = {
  experiment: Experiment
  connected: number
  station: Station
  /** The critical scene at this moment, or nothing while the run counts. */
  critical: CriticalFrame | undefined
  /** The scene has played to its end and the room is empty. */
  over: boolean
  delta: number
  still: boolean
  mascot: readonly [x: number, z: number]
  /** The room's drawn sheet. The whiteboard on it shows the count. */
  marks: SetMarks | undefined
}

export function createExperimentStage(plan: OfficePlan = officePlan) {
  const group = new Group()
  group.name = 'Office experiment'
  const rain = createSpecimenRain(plan)
  const swarm = createJoinSwarm(plan)
  group.add(rain.group, swarm.group)

  // The computer's screen, as the room shows it. The counter's keys lie over it when the visitor sits at the computer.
  const raster = document.createElement('canvas')
  raster.width = 224
  raster.height = 164
  const phosphor = raster.getContext('2d')!
  const display = new CanvasTexture(raster)
  display.colorSpace = SRGBColorSpace
  display.magFilter = NearestFilter
  const screenGeometry = new PlaneGeometry(glass.width, glass.height)
  const screen = new Mesh(screenGeometry, new MeshBasicMaterial({ map: display, toneMapped: false }))
  screen.position.copy(glass.centre)
  group.add(screen)
  let shownScreen = ''
  // The colours of the desktop on the screen: its teal ground, the grey face of a window, and the navy of a title bar and a load bar.
  const desk = { ground: '#008080', face: '#C0C0C0', light: '#FFFFFF', shade: '#808080', dark: '#0A0A0A', navy: '#000080', fault: '#0000AA' }
  const bars: Record<Creature, string> = { snail: '#808000', beetle: '#008000', fly: '#000080', cricket: '#800000' }
  function drawScreen(experiment: Experiment, connected: number, crashed: boolean) {
    const count = specimenCount(experiment)
    const key = [experiment.run, count, experiment.target, connected, crashed, ...creatureKinds.map(kind => experiment.tally[kind])].join()
    if (key === shownScreen) return
    shownScreen = key
    const fill = (x: number, y: number, width: number, height: number, colour: string) => { phosphor.fillStyle = colour; phosphor.fillRect(x, y, width, height) }
    // A raised face has light on its top and left edges. A sunken well has it on its bottom and right edges.
    const bevel = (x: number, y: number, width: number, height: number, raised: boolean) => {
      fill(x, y, width, height, raised ? desk.face : desk.light)
      fill(x, y, width, 1, raised ? desk.light : desk.shade); fill(x, y, 1, height, raised ? desk.light : desk.shade)
      fill(x, y + height - 1, width, 1, raised ? desk.dark : desk.light); fill(x + width - 1, y, 1, height, raised ? desk.dark : desk.light)
    }
    phosphor.textAlign = 'left'
    if (crashed) {
      // The run went critical, and the computer failed as that desktop failed.
      fill(0, 0, raster.width, raster.height, desk.fault)
      fill(84, 30, 56, 13, '#AAAAAA')
      phosphor.font = 'bold 10px monospace'
      phosphor.fillStyle = desk.fault
      phosphor.fillText('CHAMBER', 91, 40)
      phosphor.fillStyle = desk.light
      phosphor.font = '9px monospace'
      const lines = ['A fatal exception 0E has occurred', 'in VXD CHAMBER(01). All specimens', 'will be loaded at once.', '', '* Hold still.', '', 'Loading everything _']
      lines.forEach((line, index) => phosphor.fillText(line, 16, 64 + index * 12))
      display.needsUpdate = true
      return
    }
    fill(0, 0, raster.width, raster.height, desk.ground)
    bevel(4, 4, 216, 134, true)
    const title = phosphor.createLinearGradient(7, 0, 217, 0)
    title.addColorStop(0, desk.navy)
    title.addColorStop(1, '#1084D0')
    phosphor.fillStyle = title
    phosphor.fillRect(7, 7, 210, 14)
    phosphor.fillStyle = desk.light
    phosphor.font = 'bold 10px sans-serif'
    phosphor.fillText('Specimen Loader', 11, 18)
    phosphor.fillStyle = desk.dark
    phosphor.font = 'bold 30px sans-serif'
    phosphor.fillText(`${loadedPercent(experiment)}%`, 12, 54)
    phosphor.font = '10px sans-serif'
    phosphor.textAlign = 'right'
    phosphor.fillText('of specimens loaded', 212, 42)
    phosphor.fillText(`${count} / ${experiment.target}`, 212, 54)
    phosphor.textAlign = 'left'
    // The load bar fills in whole blocks.
    bevel(12, 62, 200, 14, false)
    const blocks = Math.min(24, Math.floor(24 * count / experiment.target))
    for (let block = 0; block < blocks; block++) fill(15 + block * 8.1, 65, 7, 8, desk.navy)
    // One bar for each creature, against the leader.
    const lead = Math.max(1, ...creatureKinds.map(kind => experiment.tally[kind]))
    creatureKinds.forEach((kind, index) => {
      const left = 12 + index * 51
      phosphor.fillStyle = desk.dark
      phosphor.font = '13px sans-serif'
      phosphor.fillText(creatures[kind], left, 99)
      phosphor.font = '9px sans-serif'
      phosphor.fillText(String(experiment.tally[kind]), left + 20, 97)
      bevel(left, 106, 46, 8, false)
      fill(left + 2, 108, Math.round(42 * experiment.tally[kind] / lead), 4, bars[kind])
    })
    bevel(0, 142, raster.width, 22, true)
    bevel(3, 145, 38, 16, true)
    phosphor.fillStyle = desk.dark
    phosphor.font = 'bold 9px sans-serif'
    phosphor.fillText('Start', 10, 157)
    bevel(148, 145, 73, 16, false)
    fill(149, 146, 71, 14, desk.face)
    phosphor.font = '9px sans-serif'
    phosphor.textAlign = 'right'
    phosphor.fillStyle = desk.dark
    phosphor.fillText(`${connected} in the office`, 217, 157)
    display.needsUpdate = true
  }

  // The chamber's light in the critical scene: a glow on its glass, and a lamp that reaches him and the specimens.
  const glowGeometry = new PlaneGeometry(swarm.window.width, swarm.window.height)
  const glow = new Mesh(glowGeometry, new MeshBasicMaterial({ color: '#BFF3E8', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }))
  glow.position.copy(swarm.window.centre)
  glow.position.z += 0.02
  glow.renderOrder = 4
  const surge = new PointLight('#8FEADF', 0, 14, 1.4)
  surge.position.set(swarm.window.centre.x, swarm.window.centre.y, swarm.window.centre.z + 0.9)
  group.add(glow, surge)

  let board: { marks: SetMarks, key: string } | undefined
  const hitPoint = new Vector3()
  const inRect = (ray: Ray, centre: Vector3, width: number, height: number) => {
    if (ray.direction.z >= 0) return false
    const reach = (centre.z - ray.origin.z) / ray.direction.z
    if (reach <= 0) return false
    ray.at(reach, hitPoint)
    return Math.abs(hitPoint.x - centre.x) <= width / 2 && Math.abs(hitPoint.y - centre.y) <= height / 2
  }

  return {
    group,
    glass,
    /** The station a pointer ray chooses: the monitor, or the chamber window. */
    stationAt(ray: Ray): Station | undefined {
      if (inRect(ray, glass.centre, glass.width + 0.24, glass.height + 0.3)) return 'computer'
      if (inRect(ray, swarm.window.centre, swarm.window.width, swarm.window.height)) return 'code'
    },
    /** The camera's place and target at a station, for a view of this size in pixels and this vertical field of view in degrees. */
    shot(station: 'computer' | 'code', width: number, height: number, fieldOfView: number) {
      const tangent = 2 * Math.tan(fieldOfView * Math.PI / 360)
      // The glass takes most of a phone's width, and no more than 600 pixels of a desk screen.
      const frame = station === 'computer' ? { centre: glass.centre, distance: glass.width * height / (tangent * Math.min(600, width * 0.79, height * 0.7)) }
        : { centre: swarm.lit.centre, distance: Math.max(swarm.lit.height / (0.88 * tangent), swarm.lit.width * height / (0.94 * tangent * width)) }
      return { position: new Vector3(frame.centre.x, frame.centre.y, frame.centre.z + frame.distance), target: frame.centre }
    },
    update({ experiment, connected, station, critical, over, delta, still, mascot, marks }: StageInput): { busy: boolean, landed: Creature | undefined } {
      const key = `${experiment.run} ${experiment.target} ${creatureKinds.map(kind => experiment.tally[kind]).join()}`
      if (marks && (board?.marks !== marks || board.key !== key)) {
        paintExperimentBoard(marks.painter, experiment)
        marks.changed()
        board = { marks, key }
      }
      drawScreen(experiment, connected, critical !== undefined)
      const rained = rain.update({ run: experiment.run, tally: experiment.tally, delta, still, mascot, pull: critical?.pull, gone: over })
      const gathering = swarm.update(station === 'code' && !critical && !over, delta, still)
      glow.material.opacity = (critical?.chamber ?? 0) * 0.85
      surge.intensity = (critical?.chamber ?? 0) * 90
      return { busy: rained.busy || gathering || critical !== undefined, landed: rained.landed }
    },
    dispose() {
      rain.dispose(); swarm.dispose()
      display.dispose(); screenGeometry.dispose(); screen.material.dispose()
      glowGeometry.dispose(); glow.material.dispose(); surge.dispose()
      group.removeFromParent()
    },
  }
}
