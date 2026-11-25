import { Group, InstancedMesh, MeshStandardMaterial, Object3D } from 'three'
import { sceneLayout } from '../layers/brand/shared/scene-layout.ts'
import type { SetLayout } from '../layers/brand/shared/scene-set.ts'
import { defaultSceneSettings } from '../layers/brand/shared/scene-settings.ts'
import { floorHeight, gatherSnails, phoneAspect, restingView, snailGround, stepHerd, wideAspect } from '../shared/cave-snails.ts'
import type { HerdStep } from '../shared/cave-snails.ts'
import { specimenGeometry } from './office-specimens.ts'

/**
 * The snails of the office experiment, in the cave after it. The machine made only snails, and they came along.
 * They stand in a crowd round his start point, where a phone at the default zoom sees most of them, and dance with him.
 * After the celebration they hurry out of the places he walks, then crawl slowly in front of them, head first, clear of the eggs.
 * The imports are relative files, so a Node test can build this module without the Nuxt aliases.
 */

export type CaveSnailsInput = {
  /** Seconds since the last frame. */
  delta: number
  /** Reduced motion: the snails keep their places and their shapes. */
  still: boolean
  /** Where he stands, as x and z. The snails turn away from him. */
  avoid: readonly [x: number, z: number]
  /** The beats of the music since its chorus hit, while the cave celebrates. The snails stop and dance: they bob once a beat and rock over two. */
  dance?: number
}

// The same snail as in the office, with its raised shell coil, and the same material.
const lift = 0.004
// How much a snail's body stretches along its length as it crawls, as a share of its length.
const stretchShare = 0.04

/**
 * `count` is the number of snails, and `seed` picks their places in the crowd. `clearance` is the least distance between him and a free snail.
 * A snail's `rotation.y` is its heading, so its head, on the model's +x, points along (cos heading, -sin heading) in x and z. It crawls that way.
 */
export function createCaveSnails(layout: SetLayout, { count = 14, seed = 11, clearance = 0.9 }: { count?: number, seed?: number, clearance?: number } = {}) {
  const group = new Group()
  group.name = 'Cave snails'
  const ground = snailGround(layout, sceneLayout.eggs, clearance)
  // The crowd is placed for the pictures at the default zoom, before the visitor turns the view.
  const herd = gatherSnails(ground, { count, seed,
    phone: restingView(layout.camera, phoneAspect, defaultSceneSettings.zoom), wide: restingView(layout.camera, wideAspect, defaultSceneSettings.zoom) })
  const snails = herd.snails
  const mesh = new InstancedMesh(specimenGeometry('snail', true), new MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0.04 }), count)
  // They spread over the floor, so the mesh is always in view.
  mesh.frustumCulled = false
  group.add(mesh)
  const pose = new Object3D()
  pose.rotation.order = 'YXZ'

  // How far a dancing snail rises on the beat, and how far it rocks, as shares of its size and in radians.
  const hop = 0.22, rock = 0.26
  let beats: number | undefined
  function place(index: number) {
    const snail = snails[index]!
    const ahead = Math.cos(snail.heading), aside = Math.sin(snail.heading)
    // The floor under its head and its tail sets its pitch. The floor under its sides sets its roll.
    const half = snail.size * 0.55, flank = snail.size * 0.2
    const front = floorHeight(snail.x + ahead * half, snail.z - aside * half)
    const back = floorHeight(snail.x - ahead * half, snail.z + aside * half)
    const left = floorHeight(snail.x + aside * flank, snail.z + ahead * flank)
    const right = floorHeight(snail.x - aside * flank, snail.z - ahead * flank)
    // Each snail dances a little out of step with the next, so they are a crowd and not a machine.
    const turn = beats === undefined ? 0 : (beats + (index % 4) * 0.5) * Math.PI
    const rise = beats === undefined ? 0 : Math.abs(Math.sin(turn))
    pose.position.set(snail.x, Math.max(floorHeight(snail.x, snail.z), (front + back) / 2) + lift + rise * hop * snail.size, snail.z)
    pose.rotation.set(-Math.atan2(left - right, flank * 2) + Math.sin(turn) * rock * (beats === undefined ? 0 : 1), snail.heading, Math.atan2(front - back, half * 2))
    const stretch = beats === undefined ? Math.sin(snail.wave) * stretchShare : -rise * 0.12
    pose.scale.set(snail.size * (1 + stretch), snail.size * (1 - stretch * 0.4), snail.size * (1 - stretch * 0.5))
    pose.updateMatrix()
    mesh.setMatrixAt(index, pose.matrix)
  }
  function draw() {
    for (let index = 0; index < snails.length; index++) place(index)
    mesh.instanceMatrix.needsUpdate = true
  }
  // The snails stand in their places from the first frame, also when the first update is still.
  draw()

  // One step object for every frame, so a frame allocates nothing.
  const step: HerdStep = { delta: 0, avoid: layout.mascot, dance: undefined }
  /** Moves the snails one frame. A still frame leaves every snail as it is. A dancing snail stays where it is. */
  function update({ delta, still, avoid, dance }: CaveSnailsInput) {
    if (still) return
    beats = dance
    step.delta = delta
    step.avoid = avoid
    step.dance = dance
    stepHerd(herd, ground, step)
    draw()
  }
  function dispose() {
    mesh.geometry.dispose()
    mesh.material.dispose()
    mesh.dispose()
    group.removeFromParent()
  }
  return { group, update, dispose }
}
