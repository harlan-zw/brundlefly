import {
  CatmullRomCurve3, Color, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, SphereGeometry,
  TubeGeometry, Vector3,
} from 'three'
import type { BufferGeometry, Material, Texture } from 'three'
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
 * Floor-edge sacs preserve the central walking corridor and contain no additional characters.
 * `floorTexture` is the floor's colour map. The glow that the sacs cast on the floor reads it.
 */
export function createEggSacs(eggTexture: Texture, chitinTexture: Texture, floorTexture: Texture) {
  const root = new Group()
  root.name = 'Floor egg sacs'
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const geometry = shellGeometry()
  const sphere = new SphereGeometry(1, 14, 10)
  geometries.add(geometry)
  geometries.add(sphere)
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
  const innerMaterial = new MeshStandardMaterial({ color: '#343C3B', map: chitinTexture, bumpMap: chitinTexture, bumpScale: 0.02,
    roughness: 0.58, metalness: 0.02 })
  const attachmentMaterial = new MeshPhysicalMaterial({ color: '#777648', map: eggTexture,
    transparent: true, opacity: 0.67, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 })
  const tendonMaterial = new MeshPhysicalMaterial({ color: '#69404B', map: eggTexture,
    roughness: 0.3, clearcoat: 0.8 })
  materials.add(innerMaterial)
  materials.add(attachmentMaterial)
  materials.add(tendonMaterial)

  const animated: { body: Group, core: Group, phase: number, height: number, base: Vector3 }[] = []
  const shadows: FloorSpot[] = []
  const glows: FloorSpot[] = []
  const clusters = sceneLayout.eggs.map(([x, z], index) => ({ x, z, side: index === 0 ? -1 : 1 }))
  const heights = [1.29, 0.79, 1.06, 0.59]
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

      // A folded shadow moves behind the translucent membrane. It has no creature anatomy.
      const core = new Group()
      core.position.set(0, height * 0.39, 0)
      core.rotation.z = cluster.side * 0.25
      const lowerFold = new Mesh(sphere, innerMaterial)
      lowerFold.scale.set(radius * 0.5, height * 0.18, radius * 0.38)
      const upperFold = new Mesh(sphere, innerMaterial)
      upperFold.position.set(radius * 0.23, height * 0.19, -radius * 0.08)
      upperFold.scale.set(radius * 0.31, height * 0.12, radius * 0.26)
      upperFold.rotation.z = -0.38
      core.add(lowerFold, upperFold)
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
      animated.push({ body, core, phase, height, base: core.position.clone() })
    }
  }

  // Each sac's glow reaches the floor as a painted mark, not a lamp. A lamp would cost every material in the room.
  const glowLevels = new Float32Array(animated.length).fill(1)
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
        const { body, core, phase, height, base } = animated[index]!
        const pulse = eggPulse(time, phase)
        // The floor light swells and wavers with the sac that casts it.
        glowLevels[index] = eggGlow(time, phase, breath)
        body.scale.set(2 * (1 + pulse * 0.018 * response), 2 * (1 + pulse * 0.032 * response), 2 * (1 + pulse * 0.014 * response))
        core.position.set(base.x + Math.sin(time * 0.31 + phase) * 0.008 * response,
          base.y + Math.sin(time * 0.4 + phase) * height * 0.008 * response, base.z)
        core.rotation.y = Math.sin(time * 0.24 + phase) * 0.035 * response
      }
      shells.forEach((material, index) => {
        material.roughness = 0.42 - wet * 0.23
        // A low tissue glow reveals the membrane in floor shadow without making it a lamp.
        material.emissiveIntensity = 0.32 + Math.sin(time * 0.55 + index * 1.73) * 0.025 * response
      })
      attachmentMaterial.roughness = 0.34 - wet * 0.23
    },
    dispose() {
      geometries.forEach(value => value.dispose())
      materials.forEach(value => value.dispose())
      // Texture lifetime belongs to the renderer, because the world shares this texture.
      root.clear()
    },
  }
}
