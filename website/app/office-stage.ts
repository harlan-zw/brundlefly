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
  // The colours of the dashboard on the screen: its dark ground, its panels, and one colour for each creature.
  const palette = { ground: '#0A100E', panel: '#101A16', rule: '#24382F', text: '#CFE3D2', dim: '#7D9584', green: '#7EE787', amber: '#E3B341', cyan: '#56D4DD', rose: '#FF8B7E', fault: '#050706' }
  const tints: Record<Creature, string> = { snail: palette.amber, beetle: palette.green, fly: palette.cyan, cricket: palette.rose }
  function drawScreen(experiment: Experiment, connected: number, crashed: boolean) {
    const count = specimenCount(experiment)
    const key = [experiment.run, count, experiment.target, connected, crashed, ...creatureKinds.map(kind => experiment.tally[kind])].join()
    if (key === shownScreen) return
    shownScreen = key
    const fill = (x: number, y: number, width: number, height: number, colour: string) => { phosphor.fillStyle = colour; phosphor.fillRect(x, y, width, height) }
    const panel = (x: number, y: number, width: number, height: number) => { fill(x, y, width, height, palette.rule); fill(x + 1, y + 1, width - 2, height - 2, palette.panel) }
    phosphor.textAlign = 'left'
    if (crashed) {
      // The run went critical, and the computer failed as a home server fails.
      fill(0, 0, raster.width, raster.height, palette.fault)
      phosphor.font = '8px monospace'
      const lines: [string, string][] = [[palette.text, 'chamber: load reached target'], [palette.rose, 'Kernel panic - not syncing:'], [palette.rose, 'All specimens will be loaded at once.'], [palette.text, '* Hold still.'], [palette.text, ''], [palette.text, 'Loading everything _']]
      lines.forEach(([colour, text], index) => { phosphor.fillStyle = colour; phosphor.fillText(text, 12, 46 + index * 14) })
      display.needsUpdate = true
      return
    }
    fill(0, 0, raster.width, raster.height, palette.ground)
    fill(10, 12, 5, 5, palette.green)
    phosphor.font = 'bold 10px monospace'
    phosphor.fillStyle = palette.green
    phosphor.fillText('chamber-01', 20, 18)
    phosphor.font = '9px monospace'
    phosphor.fillStyle = palette.cyan
    phosphor.textAlign = 'right'
    phosphor.fillText(`${connected} in the office`, 214, 18)
    phosphor.textAlign = 'left'
    panel(8, 26, 208, 62)
    const percent = loadedPercent(experiment)
    const level = percent >= 90 ? palette.rose : percent >= 75 ? palette.amber : palette.green
    phosphor.fillStyle = palette.green
    phosphor.font = 'bold 34px monospace'
    phosphor.fillText(`${percent}%`, 15, 62)
    phosphor.font = '9px monospace'
    phosphor.fillStyle = palette.dim
    phosphor.textAlign = 'right'
    phosphor.fillText('of specimens loaded', 209, 46)
    phosphor.fillStyle = palette.text
    phosphor.fillText(`${count} / ${experiment.target}`, 209, 60)
    phosphor.textAlign = 'left'
    // The load bar is cut into cells.
    const cells = Math.min(40, Math.floor(40 * count / experiment.target))
    for (let cell = 0; cell < 40; cell++) fill(15 + cell * 4.9, 72, 4, 8, cell < cells ? level : '#18261F')
    // One bar for each creature, against the leader.
    const lead = Math.max(1, ...creatureKinds.map(kind => experiment.tally[kind]))
    creatureKinds.forEach((kind, index) => {
      const left = 8 + index * 53
      panel(left, 96, 49, 44)
      phosphor.font = '12px sans-serif'
      phosphor.fillStyle = palette.text
      phosphor.fillText(creatures[kind], left + 5, 113)
      phosphor.font = '9px monospace'
      phosphor.textAlign = 'right'
      phosphor.fillText(String(experiment.tally[kind]), left + 44, 112)
      phosphor.textAlign = 'left'
      fill(left + 5, 126, 39, 6, '#18261F')
      fill(left + 5, 126, Math.round(39 * experiment.tally[kind] / lead), 6, tints[kind])
    })
    phosphor.font = '8px monospace'
    phosphor.fillStyle = palette.dim
    phosphor.fillText('$ tail -f chamber.log', 10, 156)
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
