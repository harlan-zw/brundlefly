import { AdditiveBlending, CanvasTexture, Group, Mesh, MeshBasicMaterial, NearestFilter, PlaneGeometry, PointLight, SRGBColorSpace, Vector3 } from 'three'
import type { Ray } from 'three'
import { officePlan } from '@brundlefly/brand/shared/office-layout'
import type { OfficePlan } from '@brundlefly/brand/shared/office-layout'
import type { SetMarks } from '@brundlefly/brand/shared/scene-set'
import { paintExperimentBoard } from '#shared/office-board'
import { creatureKinds, creatures, specimenCount } from '#shared/office-experiment'
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
  function drawScreen(experiment: Experiment, connected: number, alarm: boolean) {
    const count = specimenCount(experiment)
    const key = [experiment.run, count, experiment.target, connected, alarm, ...creatureKinds.map(kind => experiment.tally[kind])].join()
    if (key === shownScreen) return
    shownScreen = key
    phosphor.fillStyle = alarm ? '#2A1512' : '#10251E'
    phosphor.fillRect(0, 0, raster.width, raster.height)
    phosphor.fillStyle = alarm ? '#F0B59C' : '#A9DCB3'
    phosphor.font = 'bold 15px monospace'
    phosphor.textAlign = 'left'
    phosphor.fillText(alarm ? 'CRITICAL' : 'SPECIMENS', 12, 26)
    phosphor.font = '11px monospace'
    phosphor.textAlign = 'right'
    phosphor.fillText(`${connected} IN`, 212, 26)
    phosphor.textAlign = 'left'
    phosphor.font = 'bold 54px monospace'
    phosphor.fillText(String(count), 10, 86)
    phosphor.font = '13px monospace'
    phosphor.fillStyle = alarm ? '#C98C78' : '#A0B7A1'
    phosphor.textAlign = 'right'
    phosphor.fillText(`/ ${experiment.target}`, 212, 84)
    phosphor.textAlign = 'left'
    phosphor.fillStyle = alarm ? '#5A2A22' : '#345648'
    phosphor.fillRect(12, 100, 200, 8)
    phosphor.fillStyle = alarm ? '#F0B59C' : count >= experiment.target * 0.9 ? '#ECC579' : '#9DDAA5'
    phosphor.fillRect(12, 100, Math.round(200 * Math.min(1, count / experiment.target)), 8)
    phosphor.font = '12px monospace'
    creatureKinds.forEach((kind, index) => phosphor.fillText(`${creatures[kind]} ${experiment.tally[kind]}`, 12 + 52 * index, 138))
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
      // The alarm on the screen blinks once a second, and holds under reduced motion.
      drawScreen(experiment, connected, critical !== undefined && (still || critical.pull % 0.2 < 0.12 || critical.pull >= 1))
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
