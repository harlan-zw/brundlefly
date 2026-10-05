import {
  BufferGeometry, CatmullRomCurve3, Color, DirectionalLight, DoubleSide, Float32BufferAttribute, Group, HemisphereLight,
  InstancedMesh, LineBasicMaterial, LineSegments, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  Object3D, PlaneGeometry, PointLight, Raycaster, ShaderMaterial, SphereGeometry, SpotLight, TubeGeometry, Vector2, Vector3,
} from 'three'
import type { Texture } from 'three'
import { createOrganismModel } from './organism'
import { createGooMaterial } from './goo'
import { createCaveGoo } from './cave-goo'
import { createEggSacs } from './eggs'
import { createTissueMaterial } from './tissue-material'
import { caveCrossSection, createCaveGeometry } from './cave-geometry'
import type { RoomHeight } from './room-height'
import { sceneLayout } from './scene-layout'
import type { SceneSettings } from './scene-settings'

export type WorldTextures = { chitin: Texture, floor: Texture, egg: Texture, room: Texture, roomHeight: RoomHeight }
export type WorldInput = { time: number, pressure: number, settings: SceneSettings }

const groundLevel = -2.2

/** Stable variation keeps the chamber reproducible across builds and screenshots. */
function variation(index: number) {
  return (Math.sin(index * 127.1 + 311.7) * 43758.5453) % 1
}

function foldGeometry(seed: number) {
  const geometry = new SphereGeometry(1, 28, 20)
  const positions = geometry.getAttribute('position')
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index)
    const y = positions.getY(index)
    const z = positions.getZ(index)
    const angle = Math.atan2(z, x)
    const rib = 1 + Math.sin(angle * 9 + y * 6 + seed) * 0.055
    const swelling = 1 + Math.sin(angle * 3 + seed) * 0.13 + Math.cos(y * 5 + seed) * 0.08
    positions.setXYZ(index, x * rib * swelling, y * (1 + Math.sin(angle * 4) * 0.04), z * rib * swelling)
  }
  geometry.computeVertexNormals()
  return geometry
}

/** An open chamber surrounds the walkable foreground without obstructing the mascot. */
export function createWorld(texture: Texture, gooTexture: Texture, textures: WorldTextures) {
  const root = new Group()
  root.name = 'Brundlefly chamber'
  // Connected angular cave shoulders surround the clearing and both player camera positions.
  const enclosureGeometry = createCaveGeometry(textures.roomHeight.raster, [0, groundLevel + 4, 5])
  const enclosureSkin = createTissueMaterial({ surface: 'enclosure', texture: textures.room,
    height: textures.roomHeight.texture, shell: textures.chitin, color: '#A09280',
    bumpScale: 0.28, emissive: '#69404B', glow: 0.28, roughness: 0.92 })
  const enclosure = new Mesh(enclosureGeometry, enclosureSkin.material)
  enclosure.position.set(0, groundLevel + 4, 5)
  root.add(enclosure)
  const tunnel = createOrganismModel(texture, 'lair', 1.35, gooTexture)
  tunnel.root.position.set(...sceneLayout.opening.position)
  tunnel.root.scale.set(...sceneLayout.opening.scale)
  root.add(tunnel.root)

  const tissue = new MeshPhysicalMaterial({ color: '#AA604B', map: texture, bumpMap: texture,
    bumpScale: 0.1, roughness: 0.46, clearcoat: 0.7, clearcoatRoughness: 0.28 })
  const bruise = new MeshPhysicalMaterial({ color: '#69404B', map: texture, bumpMap: texture,
    bumpScale: 0.12, roughness: 0.55, clearcoat: 0.42 })
  // Glassy dark chitin. Its flat facets catch sharp glints from the wet environment.
  const chitin = new MeshPhysicalMaterial({ color: '#4A4F44', map: textures.chitin, bumpMap: textures.chitin,
    bumpScale: 0.12, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.1 })
  const eggs = createEggSacs(textures.egg, textures.chitin)
  root.add(eggs.root)

  const groundGeometry = new PlaneGeometry(22, 36, 44, 48)
  const floorPositions = groundGeometry.getAttribute('position')
  for (let index = 0; index < floorPositions.count; index++) {
    const x = floorPositions.getX(index)
    const z = floorPositions.getY(index)
    // The middle stays nearly level. Raised seams collect at the cave edges.
    const edge = Math.min(1, Math.max(0, (Math.abs(x) - 2) / 3))
    const height = Math.sin(x * 3 + z * 0.9) * 0.025 + edge * Math.sin(z * 2.4 + x) * 0.11
    floorPositions.setZ(index, height)
  }
  groundGeometry.computeVertexNormals()
  const floorSkin = createTissueMaterial({ surface: 'floor', texture: textures.floor, color: '#867461',
    bumpScale: 0.14, roughness: 0.79 })
  const ground = new Mesh(groundGeometry, floorSkin.material)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, groundLevel - 0.035, 5)
  root.add(ground)

  // The wall is made of asymmetric connected folds, rather than isolated boulders.
  const livingFolds: { mesh: Mesh, scale: Vector3, phase: number }[] = []
  for (let side = -1; side <= 1; side += 2) {
    for (let index = 0; index < 2; index++) {
      const z = -1.5 - index * 3.5
      const fold = new Mesh(foldGeometry(index + side * 3), index % 3 === 0 ? bruise : tissue)
      fold.position.set(side * (5.35 + Math.sin(index * 2 + side) * 0.28), -0.1 + index * 0.09, z)
      fold.scale.set(0.45 + index % 2 * 0.12, 2.1 + Math.sin(index) * 0.3, 0.85)
      fold.rotation.z = side * (0.13 + index * 0.035)
      fold.rotation.y = side * 0.24
      livingFolds.push({ mesh: fold, scale: fold.scale.clone(), phase: index * 1.3 + side })
      root.add(fold)
      const shell = new Mesh(foldGeometry(index + 13), chitin)
      shell.position.copy(fold.position)
      shell.position.x += side * 0.38
      shell.position.y -= 0.5
      shell.scale.set(0.5, 1.9, 0.8)
      shell.rotation.copy(fold.rotation)
      root.add(shell)
    }
  }

  // Membrane binders follow the jagged room shell instead of drawing smooth circular arches.
  for (let index = 0; index < 2; index++) {
    const points = caveCrossSection(1.2 - index * 5.1)
    const arch = new Mesh(new TubeGeometry(new CatmullRomCurve3(points), 64, 0.085, 6, false), bruise)
    root.add(arch)
  }

  // Chitin splinters form a low perimeter, not obstacles in the walking area.
  const plateGeometry = new SphereGeometry(1, 5, 3)
  const platePositions = plateGeometry.getAttribute('position')
  for (let index = 0; index < platePositions.count; index++) {
    const x = platePositions.getX(index)
    const z = platePositions.getZ(index)
    const angular = 1 + Math.sin(Math.atan2(z, x) * 3.7) * 0.24
    platePositions.setXYZ(index, x * angular * 1.3, platePositions.getY(index), z * angular * 0.8)
  }
  plateGeometry.computeVertexNormals()
  const plates = new InstancedMesh(plateGeometry, chitin, 48)
  const placement = new Object3D()
  for (let index = 0; index < 48; index++) {
    const side = index % 2 === 0 ? -1 : 1
    placement.position.set(side * (2.8 + Math.abs(variation(index)) * 2),
      groundLevel + 0.035, 3 - Math.floor(index / 2) * 0.43)
    placement.scale.set(0.2 + Math.abs(variation(index + 2)) * 0.28, 0.07 + index % 3 * 0.025, 0.18 + index % 4 * 0.06)
    placement.rotation.set(0.04, index * 0.87, side * 0.08)
    placement.updateMatrix()
    plates.setMatrixAt(index, placement.matrix)
  }
  root.add(plates)

  // Low scar folds populate the foreground without blocking the walking apron.
  for (let index = 0; index < 14; index++) {
    const side = index % 2 === 0 ? -1 : 1
    const x = side * (0.65 + Math.abs(variation(index + 30)) * 2.7)
    const z = 2.9 + Math.floor(index / 2) * 0.62
    const scar = new Mesh(foldGeometry(index + 40), index % 3 === 0 ? bruise : tissue)
    scar.position.set(x, groundLevel + 0.035, z)
    scar.scale.set(0.2 + Math.abs(variation(index + 32)) * 0.34, 0.06 + index % 3 * 0.025, 0.4 + index % 4 * 0.12)
    scar.rotation.y = side * (0.4 + index * 0.33)
    root.add(scar)
    const tendon = new Mesh(new TubeGeometry(new CatmullRomCurve3([
      new Vector3(x - 0.6, 0, z - 0.7), new Vector3(x, 0.045, z),
      new Vector3(x + side * 0.45, 0.015, z + 0.75),
    ]), 18, 0.032 + index % 3 * 0.008, 6, false), bruise)
    tendon.position.y = groundLevel + 0.012
    root.add(tendon)
  }

  // Raycast actual carved shelves, so each wet drape starts on the cave instead of floating nearby.
  enclosure.updateMatrixWorld(true)
  const caveFilm = createGooMaterial(gooTexture)
  caveFilm.material.color.set('#B59B82')
  caveFilm.material.attenuationColor.set('#725339')
  caveFilm.material.side = DoubleSide
  const attachment = (z: number, corner: number) => {
    const target = caveCrossSection(z)[corner]!
    const origin = new Vector3(0, 0.8, z)
    const hit = new Raycaster(origin, target.clone().sub(origin).normalize()).intersectObject(enclosure)[0]!
    return { point: hit.point, normal: hit.face!.normal.clone() }
  }
  const drapes = [[-0.5, 6, 7], [1.3, 10, 11], [3.5, 4, 5], [0.1, 12, 13], [-3.2, 5, 6], [4.8, 9, 10]] as const
  const caveSlime = createCaveGoo(caveFilm.material, drapes.map(([z, a, b], index) => {
    const start = attachment(z, a), end = attachment(z + 0.22, b)
    return { start: start.point, end: end.point, startNormal: start.normal, endNormal: end.normal,
      length: Math.min(Math.abs(start.point.x), Math.abs(end.point.x)) < 2.5 ? 0.48 : 0.95 + index % 3 * 0.28,
      width: 0.28 + index % 3 * 0.09 }
  }))
  root.add(caveSlime.root)

  const bristlePositions: number[] = []
  for (let index = 0; index < 170; index++) {
    const side = index % 2 === 0 ? -1 : 1
    const x = side * (3.1 + Math.abs(variation(index + 50)) * 1.5)
    const z = 3 - Math.abs(variation(index + 90)) * 10
    const height = 0.08 + Math.abs(variation(index + 200)) * 0.24
    bristlePositions.push(x, groundLevel, z, x + side * 0.035, groundLevel + height, z + 0.018)
  }
  const bristleGeometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(bristlePositions, 3))
  root.add(new LineSegments(bristleGeometry, new LineBasicMaterial({ color: '#69404B', transparent: true, opacity: 0.62 })))

  // A soft floor occlusion anchors the chamber without expensive shadow maps.
  const occlusion = new Mesh(new PlaneGeometry(10, 9), new ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv; void main(){float a=exp(-dot((vUv-.5)*vec2(2.5,3.0),(vUv-.5)*vec2(2.5,3.0))*2.8)*.38;gl_FragColor=vec4(.015,.02,.015,a);}',
  }))
  occlusion.rotation.x = -Math.PI / 2
  occlusion.position.set(0, groundLevel + 0.002, -2.2)
  root.add(occlusion)

  const ambient = new HemisphereLight(new Color('#A4B5A0'), new Color('#080B08'), 0.85)
  root.add(ambient)
  // A broad, feathered key follows the walking area, rather than lighting the nearest wall.
  const warm = new SpotLight('#E8D4A6', 90, 18, Math.PI * 0.23, 1, 2)
  warm.position.set(-1.4, 3.3, 4.5)
  warm.target.position.set(0, -0.2, -0.4)
  const fill = new DirectionalLight('#A4B5A0', 0.65)
  fill.position.set(3, 1.5, 5)
  fill.target.position.set(0, -0.3, -0.5)
  const rim = new DirectionalLight('#418B90', 0.4)
  rim.position.set(2.8, 2.4, -3)
  rim.target.position.set(0, 0, -0.3)
  const cold = new PointLight('#418B90', 12, 12, 2)
  cold.position.set(3.5, 1.1, -1.9)
  const inner = new PointLight('#AA604B', 5, 8, 2)
  inner.position.set(-1.4, 0.6, -5.5)
  root.add(warm, warm.target, fill, fill.target, rim, rim.target, cold, inner)
  const pointer = new Vector2()

  return {
    root,
    update({ time, pressure, settings }: WorldInput) {
      const response = Math.min(1, Math.max(0, pressure))
      warm.intensity = settings.key
      fill.intensity = settings.fill
      rim.intensity = settings.rim
      ambient.intensity = settings.ambient
      const enclosureMaterial = enclosure.material
      enclosureMaterial.emissiveIntensity = settings.textureGlow
      const tissueMotion = { time, breath: settings.breath, flow: settings.flow }
      enclosureSkin.update(tissueMotion)
      floorSkin.update(tissueMotion)
      floorSkin.material.roughness = 0.86 - settings.wetness * 0.75
      tissue.roughness = 0.78 - settings.wetness * 0.35
      caveFilm.update({ time, breath: settings.breath, flow: settings.flow, wetness: settings.wetness, key: settings.key, fill: settings.fill, rim: settings.rim })
      caveSlime.update({ time, breath: settings.breath, flow: settings.flow })
      eggs.update({ time, breath: settings.breath, wetness: settings.wetness })
      tunnel.update({ time: time * settings.breath, pressure: response * 0.25, wetness: settings.wetness, pointer, opening: settings.opening, transform: 'squeeze', flow: settings.flow })
      for (const { mesh, scale, phase } of livingFolds) {
        mesh.scale.set(scale.x * (1 + Math.sin(time * 0.48 + phase) * 0.014 * settings.breath + response * 0.015),
          scale.y * (1 + Math.sin(time * 0.36 + phase) * 0.006 * settings.breath), scale.z)
      }
      inner.intensity = settings.inner + Math.sin(time * 0.6) * 0.35 * settings.breath
    },
    dispose() {
      tunnel.dispose()
      root.remove(tunnel.root)
      eggs.dispose()
      root.remove(eggs.root)
      caveSlime.dispose()
      root.remove(caveSlime.root)
      caveFilm.dispose()
      const geometries = new Set<BufferGeometry>()
      const materials = new Set<MeshStandardMaterial | ShaderMaterial | LineBasicMaterial>()
      root.traverse(object => {
        if (object instanceof Mesh || object instanceof LineSegments) {
          geometries.add(object.geometry)
          const values = Array.isArray(object.material) ? object.material : [object.material]
          for (const material of values) {
            if (material instanceof MeshStandardMaterial || material instanceof ShaderMaterial || material instanceof LineBasicMaterial) materials.add(material)
          }
        }
      })
      // The shared texture belongs to the renderer. Only model resources are released here.
      geometries.forEach(geometry => geometry.dispose())
      materials.forEach(material => material.dispose())
      root.clear()
    },
  }
}
