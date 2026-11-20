import {
  CatmullRomCurve3, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  SphereGeometry, TubeGeometry, Vector3,
} from 'three'
import type { BufferGeometry, Material, Texture } from 'three'
import { addMembraneRim, createInnerGlowMaterial } from './egg-membrane'
import { eggGlow, eggPulse } from './egg-pulse'
import { createFloorDecalGeometry } from './floor-surface'
import type { FloorSpot } from './floor-surface'
import { createContactShadowMaterial, createFloorGlowMaterial } from './floor-marks'
import { sceneLayout } from './scene-layout'

export type EggSacInput = { time: number, breath: number, wetness: number }

const floor = -2.2

/** Uneven, tapered shell. Its broad lower fold sits in attachment slime. */
function shellGeometry() {
  const geometry = new SphereGeometry(1, 24, 18)
  const positions = geometry.getAttribute('position')
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index)
    const y = positions.getY(index)
    const z = positions.getZ(index)
    const angle = Math.atan2(z, x)
    const taper = 1 - y * 0.34
    const fold = 1 + Math.sin(angle * 5 + y * 4) * 0.05 + Math.cos(angle * 3 - y * 2) * 0.035
    positions.setXYZ(index, x * taper * fold, y, z * taper * fold)
  }
  geometry.computeVertexNormals()
  return geometry
}

/**
 * The growth inside a sac: one thick fold that winds in on itself and thins to a tip.
 * It is a bud, not a creature. It has no head, eyes, limbs, or segments.
 */
function budGeometry() {
  const curve = new CatmullRomCurve3(Array.from({ length: 9 }, (_, index) => {
    const turn = index / 8
    const angle = 0.9 + turn * 3.9
    const reach = 0.3 + turn * 0.42
    return new Vector3(Math.cos(angle) * reach, Math.sin(angle) * reach, Math.sin(turn * 3.4) * 0.16)
  }))
  const rings = 36, sides = 8
  const geometry = new TubeGeometry(curve, rings, 1, sides, false)
  const positions = geometry.getAttribute('position')
  const centre = new Vector3(), vertex = new Vector3()
  for (let index = 0; index < positions.count; index++) {
    const along = Math.floor(index / (sides + 1)) / rings
    curve.getPointAt(along, centre)
    // The inner end swells round and closed. The fold thins along its length and closes at its tip.
    const girth = 0.44 * Math.sqrt(Math.min(1, along / 0.1)) * (1 - 0.74 * Math.max(0, (along - 0.1) / 0.9) ** 0.8)
      * Math.sqrt(Math.min(1, (1 - along) / 0.06))
    vertex.fromBufferAttribute(positions, index).sub(centre).multiplyScalar(girth).add(centre)
    positions.setXYZ(index, vertex.x, vertex.y, vertex.z)
  }
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Floor-edge sacs preserve the central walking corridor and contain no additional characters.
 * `floorTexture` is the floor's colour map. The glow that the sacs cast on the floor reads it.
 */
export function createEggSacs(eggTexture: Texture, chitinTexture: Texture, floorTexture: Texture) {
  const root = new Group()
  root.name = 'Floor egg sacs'
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const geometry = shellGeometry()
  const bud = budGeometry()
  geometries.add(geometry)
  geometries.add(bud)
  // The first membrane glows olive, like slime. The other two glow rust, like the flesh.
  const glowColors = ['#777648', '#AA604B', '#AA604B']
  const shells = ['#989273', '#896361', '#A27560'].map((color, index) => {
    const material = new MeshPhysicalMaterial({ color, map: eggTexture, bumpMap: eggTexture,
      bumpScale: 0.026, transparent: true, opacity: 0.66, roughness: 0.23,
      emissive: glowColors[index]!, emissiveMap: eggTexture, emissiveIntensity: 0.32,
      clearcoat: 1, clearcoatRoughness: 0.09, transmission: 0.04, thickness: 0.09,
      ior: 1.36, depthWrite: false })
    materials.add(material)
    return material
  })
  // Each membrane's edge takes its own glow colour, lifted toward cream.
  const rims = shells.map((material, index) => addMembraneRim(material, new Color(glowColors[index]!).lerp(new Color('#E8D4A6'), 0.4)))
  const innerMaterial = new MeshStandardMaterial({ color: '#343C3B', map: chitinTexture, bumpMap: chitinTexture, bumpScale: 0.02,
    roughness: 0.58, metalness: 0.02, emissive: '#69404B', emissiveIntensity: 0.14 })
  const attachmentMaterial = new MeshPhysicalMaterial({ color: '#777648', map: eggTexture,
    transparent: true, opacity: 0.67, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 })
  const tendonMaterial = new MeshPhysicalMaterial({ color: '#69404B', map: eggTexture,
    roughness: 0.3, clearcoat: 0.8 })
  materials.add(innerMaterial)
  materials.add(attachmentMaterial)
  materials.add(tendonMaterial)

  const animated: { body: Group, core: Group, phase: number, height: number, base: Vector3, turn: number }[] = []
  const shadows: FloorSpot[] = []
  const glows: FloorSpot[] = []
  const clusters = sceneLayout.eggs.map(([x, z], index) => ({ x, z, side: index === 0 ? -1 : 1 }))
  const heights = [1.29, 0.79, 1.06, 0.59]
  const sacCount = clusters.length * heights.length
  // How bright each sac's light is now. The light inside the sac and its spill on the floor both read this.
  const glowLevels = new Float32Array(sacCount).fill(1)
  // One light inside each sac, behind its bud. All of them draw as one mesh, on a membrane copy of their own.
  const innerGeometry = geometry.clone()
  const innerColors = new Float32Array(sacCount * 3)
  innerGeometry.setAttribute('sac', new InstancedBufferAttribute(Float32Array.from({ length: sacCount }, (_, index) => index), 1))
  innerGeometry.setAttribute('sacColor', new InstancedBufferAttribute(innerColors, 3))
  const innerGlowMaterial = createInnerGlowMaterial(glowLevels, eggTexture)
  geometries.add(innerGeometry)
  materials.add(innerGlowMaterial)
  const innerGlow = new InstancedMesh(innerGeometry, innerGlowMaterial, sacCount)
  // The light draws after the buds and before the membranes.
  innerGlow.renderOrder = 3
  root.add(innerGlow)
  const inset = new Matrix4().makeScale(0.88, 0.88, 0.88)
  const placed = new Matrix4()
  for (const [clusterIndex, cluster] of clusters.entries()) {
    for (const [index, height] of heights.entries()) {
      const phase = index * 1.73 + clusterIndex * 2.2
      const radius = 0.23 + height * 0.15
      const body = new Group()
      body.position.set(cluster.x + cluster.side * (index % 2 * 1.3 + Math.floor(index / 2) * 0.44),
        floor + 0.02, cluster.z + (index - 1.5) * 0.8)
      body.scale.setScalar(2)
      body.rotation.y = phase
      root.add(body)
      // The sac is twice its model size. Its shade reaches a little past its widest fold.
      shadows.push({ x: body.position.x, z: body.position.z, radius: radius * 2 * 2.2, data: [1, 0, 0, 0] })
      const membrane = (index + clusterIndex) % shells.length
      // The sac's own colour spills on the floor around it. The fourth number names the sac whose pulse the spill follows.
      const spill = new Color(glowColors[membrane]!).multiplyScalar(0.8)
      glows.push({ x: body.position.x, z: body.position.z, radius: radius * 2 * 3.4, data: [spill.r, spill.g, spill.b, animated.length] })
      const shell = new Mesh(geometry, shells[membrane]!)
      shell.position.set(0, height / 2, 0)
      shell.scale.set(radius, height / 2, radius * (0.88 + index % 2 * 0.13))
      shell.rotation.z = cluster.side * (0.07 + index % 2 * 0.09)
      body.add(shell)
      // The light sits a little inside the membrane, at the sac's rest size.
      body.updateMatrixWorld(true)
      innerGlow.setMatrixAt(animated.length, placed.copy(shell.matrixWorld).multiply(inset))
      new Color(glowColors[membrane]!).multiplyScalar(0.6).toArray(innerColors, animated.length * 3)

      // A dark curled bud grows behind the translucent membrane. It has no creature anatomy.
      const core = new Group()
      core.position.set(0, height * 0.37, 0)
      // The sac's turn is undone, so the curl faces the clearing. Each bud then leans its own way.
      core.rotation.set(0, -phase + Math.sin(phase * 2.3) * 0.5, cluster.side * 0.25 + phase)
      const growth = new Mesh(bud, innerMaterial)
      growth.scale.set(radius * 0.5, radius * 0.6, radius * 0.42)
      core.add(growth)
      body.add(core)

      for (let strand = 0; strand < 3; strand++) {
        const angle = phase + strand * Math.PI * 2 / 3
        const base = new Vector3(Math.cos(angle) * radius * 1.35, 0.015, Math.sin(angle) * radius * 1.35)
        const anchor = new Vector3(Math.cos(angle) * radius * 0.76, height * (0.38 + strand * 0.13), Math.sin(angle) * radius * 0.76)
        const middle = base.clone().lerp(anchor, 0.42)
        middle.y -= height * 0.045
        const strandGeometry = new TubeGeometry(new CatmullRomCurve3([base, middle, anchor]), 9,
          0.009 + strand * 0.002, 5, false)
        geometries.add(strandGeometry)
        body.add(new Mesh(strandGeometry, strand === 1 ? tendonMaterial : attachmentMaterial))
      }
      animated.push({ body, core, phase, height, base: core.position.clone(), turn: core.rotation.y })
    }
  }

  // Each sac's glow reaches the floor as a painted mark, not a lamp. A lamp would cost every material in the room.
  const glowGeometry = createFloorDecalGeometry(glows)
  const glowMaterial = createFloorGlowMaterial(glowLevels, floorTexture)
  geometries.add(glowGeometry)
  materials.add(glowMaterial)
  const floorGlow = new Mesh(glowGeometry, glowMaterial)
  floorGlow.renderOrder = 1
  root.add(floorGlow)
  // Soft shade under each sac seats it on the floor. No shadow map is involved.
  // It draws after the glow, so the sac blocks its own light where it touches the floor.
  const shadowGeometry = createFloorDecalGeometry(shadows)
  const shadowMaterial = createContactShadowMaterial()
  geometries.add(shadowGeometry)
  materials.add(shadowMaterial)
  const shade = new Mesh(shadowGeometry, shadowMaterial)
  shade.renderOrder = 2
  root.add(shade)

  return {
    root,
    update({ time, breath, wetness }: EggSacInput) {
      const response = Math.min(1, Math.max(0, breath))
      const wet = Math.min(1, Math.max(0, wetness))
      for (let index = 0; index < animated.length; index++) {
        const { body, core, phase, height, base, turn } = animated[index]!
        const pulse = eggPulse(time, phase)
        // The floor light swells and wavers with the sac that casts it.
        glowLevels[index] = eggGlow(time, phase, breath)
        body.scale.set(2 * (1 + pulse * 0.018 * response), 2 * (1 + pulse * 0.032 * response), 2 * (1 + pulse * 0.014 * response))
        core.position.set(base.x + Math.sin(time * 0.31 + phase) * 0.008 * response,
          base.y + Math.sin(time * 0.4 + phase) * height * 0.008 * response, base.z)
        core.rotation.y = turn + Math.sin(time * 0.24 + phase) * 0.06 * response
      }
      shells.forEach((material, index) => {
        material.roughness = 0.42 - wet * 0.23
        // A low tissue glow reveals the membrane in floor shadow without making it a lamp.
        material.emissiveIntensity = 0.32 + Math.sin(time * 0.55 + index * 1.73) * 0.025 * response
        // The bright edge breathes with the same swell.
        rims[index]!.value = 0.2 + Math.sin(time * 0.55 + index * 1.73) * 0.04 * response
      })
      attachmentMaterial.roughness = 0.34 - wet * 0.23
    },
    dispose() {
      geometries.forEach(value => value.dispose())
      materials.forEach(value => value.dispose())
      innerGlow.dispose()
      // Texture lifetime belongs to the renderer, because the world shares this texture.
      root.clear()
    },
  }
}
