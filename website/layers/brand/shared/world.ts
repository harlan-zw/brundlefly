import {
  BufferGeometry, CatmullRomCurve3, Color, DirectionalLight, DoubleSide, Float32BufferAttribute, Group, HemisphereLight,
  InstancedMesh, LineBasicMaterial, LineSegments, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  Object3D, PlaneGeometry, PointLight, ShaderMaterial, SphereGeometry, SpotLight, TubeGeometry, Vector2, Vector3,
} from 'three'
import type { Texture } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createOrganismModel } from './organism'
import { createGooMaterial } from './goo'
import { createEggSacs } from './eggs'
import { createTissueMaterial } from './tissue-material'
import { sceneLayout } from './scene-layout'
import type { SceneSettings } from './scene-settings'

export type WorldTextures = { chitin: Texture, floor: Texture, egg: Texture }
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
  // Both camera framings sit inside the enclosure. Rounded corners keep the backdrop continuous.
  const enclosureGeometry = new RoundedBoxGeometry(22, 9, 36, 5, 1.3)
  const enclosurePositions = enclosureGeometry.getAttribute('position')
  const enclosureNormals = enclosureGeometry.getAttribute('normal')
  const enclosureUvs = enclosureGeometry.getAttribute('uv')
  for (let index = 0; index < enclosurePositions.count; index++) {
    const x = enclosurePositions.getX(index)
    const y = enclosurePositions.getY(index)
    const z = enclosurePositions.getZ(index)
    const ripple = Math.sin(x * 1.7 + z * 0.7) * Math.cos(y * 2.2 + z * 0.5) * 0.12
    enclosurePositions.setXYZ(index, x + enclosureNormals.getX(index) * ripple,
      y + enclosureNormals.getY(index) * ripple, z + enclosureNormals.getZ(index) * ripple)
    enclosureUvs.setXY(index, enclosureUvs.getX(index) * 4, enclosureUvs.getY(index) * 3)
  }
  enclosureGeometry.computeVertexNormals()
  const enclosureSkin = createTissueMaterial({ surface: 'enclosure', texture, color: '#69404B',
    bumpScale: 0.14, emissive: '#69404B', glow: 0.28, roughness: 0.84 })
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
  const chitin = new MeshPhysicalMaterial({ color: '#69716A', map: textures.chitin, bumpMap: textures.chitin,
    bumpScale: 0.12, roughness: 0.72, clearcoat: 0.18, clearcoatRoughness: 0.6 })
  const membrane = new MeshPhysicalMaterial({ color: '#A4B5A0', map: texture,
    side: DoubleSide, transparent: true, opacity: 0.17, roughness: 0.45, clearcoat: 0.8, depthWrite: false })
  const goo = createGooMaterial(gooTexture)
  const slime = goo.material
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
    for (let index = 0; index < 4; index++) {
      const z = 2.5 - index * 2.25
      const fold = new Mesh(foldGeometry(index + side * 3), index % 3 === 0 ? bruise : tissue)
      fold.position.set(side * (5.05 + Math.sin(index * 2 + side) * 0.28), -0.1 + index * 0.09, z)
      fold.scale.set(0.7 + index % 2 * 0.12, 2.45 + Math.sin(index) * 0.3, 1.35)
      fold.rotation.z = side * (0.13 + index * 0.035)
      fold.rotation.y = side * 0.24
      livingFolds.push({ mesh: fold, scale: fold.scale.clone(), phase: index * 1.3 + side })
      root.add(fold)
      const shell = new Mesh(foldGeometry(index + 13), chitin)
      shell.position.copy(fold.position)
      shell.position.x += side * 0.38
      shell.position.y -= 0.5
      shell.scale.set(0.78, 2.14, 1.13)
      shell.rotation.copy(fold.rotation)
      root.add(shell)
    }
  }

  // Long arch folds wrap the chamber, leaving a visible tunnel and clear floor.
  for (let index = 0; index < 2; index++) {
    const z = 2.2 - index * 5.6
    const points: Vector3[] = []
    for (let step = 0; step <= 12; step++) {
      const angle = step / 12 * Math.PI
      points.push(new Vector3(Math.cos(angle) * (5.2 + Math.sin(index) * 0.12),
        groundLevel + Math.sin(angle) * (6.65 + Math.sin(angle * 3 + index) * 0.17),
        z + Math.sin(angle * 2 + index) * 0.2))
    }
    const arch = new Mesh(new TubeGeometry(new CatmullRomCurve3(points), 48, 0.14 + index % 2 * 0.07, 8, false), bruise)
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

  const puddleGeometry = new SphereGeometry(1, 24, 10)
  const puddlePositions = puddleGeometry.getAttribute('position')
  for (let index = 0; index < puddlePositions.count; index++) {
    const x = puddlePositions.getX(index)
    const z = puddlePositions.getZ(index)
    const angle = Math.atan2(z, x)
    const swelling = 1 + Math.sin(angle * 3 + 0.7) * 0.17 + Math.cos(angle * 7) * 0.07
    const y = puddlePositions.getY(index)
    const radial = Math.min(1, Math.hypot(x, z))
    const meniscus = Math.exp(-(((radial - 0.86) / 0.14) ** 2)) * 0.65
    puddlePositions.setXYZ(index, x * swelling, y > 0 ? y * 0.22 + meniscus : y, z * swelling)
  }
  puddleGeometry.computeVertexNormals()
  for (let index = 0; index < 6; index++) {
    const side = index % 2 === 0 ? -1 : 1
    const puddle = new Mesh(puddleGeometry, slime)
    puddle.position.set(side * (2.2 + Math.sin(index * 1.3) * 0.35), groundLevel + 0.012, 3.1 - Math.floor(index / 2) * 1.7)
    puddle.scale.set(0.6 + index % 3 * 0.18, 0.022, 0.38 + index % 2 * 0.15)
    puddle.rotation.y = index * 0.74
    root.add(puddle)
  }

  // Shallow runoff leads away from the lips and along the edge of the walking apron.
  for (const side of [-1, 1]) {
    const runoff = new Mesh(new TubeGeometry(new CatmullRomCurve3([
      new Vector3(side * 1.7, 0, -2.6), new Vector3(side * 2.3, 0.025, -1.3),
      new Vector3(side * 2.1, 0, 0.4), new Vector3(side * 2.75, 0.015, 2.9),
    ]), 40, 0.11, 8, false), slime)
    runoff.position.y = groundLevel + 0.025
    runoff.scale.y = 0.13
    root.add(runoff)
  }

  const dropGeometry = new SphereGeometry(1, 18, 14)
  const dropVertices = dropGeometry.getAttribute('position')
  for (let index = 0; index < dropVertices.count; index++) {
    const y = dropVertices.getY(index)
    const taper = 0.72 - y * 0.42
    dropVertices.setXYZ(index, dropVertices.getX(index) * taper, y, dropVertices.getZ(index) * taper)
  }
  dropGeometry.computeVertexNormals()
  const hanging: { mesh: Mesh, drop: Mesh, anchor: Vector3, phase: number }[] = []
  for (let index = 0; index < 12; index++) {
    const side = index % 2 === 0 ? -1 : 1
    const x = side * (3.7 + index % 3 * 0.42)
    const z = 0.4 - Math.floor(index / 2) * 1.14
    const start = new Vector3(x, 2.2 + Math.sin(index) * 0.35, z)
    const end = new Vector3(x + side * 0.4, -0.8 + index % 3 * 0.3, z + 0.16)
    const midpoint = start.clone().lerp(end, 0.52)
    midpoint.x += side * 0.17
    const curve = new CatmullRomCurve3([
      new Vector3(), midpoint.clone().sub(start), end.clone().sub(start),
    ])
    const strandGeometry = new TubeGeometry(curve, 20, 0.024 + index % 3 * 0.008, 7, false)
    const strandVertices = strandGeometry.getAttribute('position')
    for (let vertex = 0; vertex < strandVertices.count; vertex++) {
      const t = Math.floor(vertex / 8) / 20
      const centre = curve.getPointAt(t)
      const thickness = 0.5 + Math.exp(-t * 8) * 3 + Math.exp(-(1 - t) * 12) * 0.5
      strandVertices.setXYZ(vertex,
        centre.x + (strandVertices.getX(vertex) - centre.x) * thickness,
        centre.y + (strandVertices.getY(vertex) - centre.y) * thickness,
        centre.z + (strandVertices.getZ(vertex) - centre.z) * thickness)
    }
    strandGeometry.computeVertexNormals()
    const strand = new Mesh(strandGeometry, slime)
    strand.position.copy(start)
    root.add(strand)
    const drop = new Mesh(dropGeometry, slime)
    drop.position.copy(end)
    drop.scale.set(0.055, 0.085, 0.052)
    root.add(drop)
    hanging.push({ mesh: strand, drop, anchor: end.clone(), phase: index * 1.7 })
    if (index % 2 === 0) {
      const web = new BufferGeometry()
      web.setAttribute('position', new Float32BufferAttribute([...start.toArray(), ...end.toArray(), x + side * 0.65, 1.5, z - 0.35], 3))
      web.setAttribute('uv', new Float32BufferAttribute([0, 0, 0.5, 1, 1, 0], 2))
      web.computeVertexNormals()
      root.add(new Mesh(web, membrane))
    }
  }

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
      tissue.roughness = 0.78 - settings.wetness * 0.35
      goo.update({ time, breath: settings.breath, flow: settings.flow, wetness: settings.wetness, key: settings.key, fill: settings.fill, rim: settings.rim })
      eggs.update({ time, breath: settings.breath, wetness: settings.wetness })
      tunnel.update({ time: time * settings.breath, pressure: response * 0.25, wetness: settings.wetness, pointer, opening: settings.opening, transform: 'squeeze', flow: settings.flow })
      for (const { mesh, scale, phase } of livingFolds) {
        mesh.scale.set(scale.x * (1 + Math.sin(time * 0.48 + phase) * 0.014 * settings.breath + response * 0.015),
          scale.y * (1 + Math.sin(time * 0.36 + phase) * 0.006 * settings.breath), scale.z)
      }
      for (const { mesh, drop, anchor, phase } of hanging) {
        const cycle = (time * 0.17 * settings.flow + phase * 0.13) % 1
        const attached = Math.min(cycle / 0.8, 1)
        const falling = Math.max(0, (cycle - 0.8) / 0.2)
        const sag = Math.sin(time * 0.65 + phase) * 0.025 * settings.breath + attached * 0.035 * settings.flow
        mesh.scale.y = 1 + sag
        mesh.rotation.z = Math.sin(time * 0.43 + phase) * 0.02 * settings.breath
        const growth = 0.65 + attached * 0.8
        drop.position.copy(anchor)
        drop.position.y += (anchor.y - mesh.position.y) * sag - falling * falling * 3.2
        drop.visible = drop.position.y > groundLevel + 0.025
        drop.position.x += Math.sin(time * 0.43 + phase) * 0.06 * settings.breath
        drop.scale.set(0.055 * growth, 0.085 * growth * (1 + attached * 0.9 - falling * 0.7), 0.052 * growth)
      }
      inner.intensity = settings.inner + Math.sin(time * 0.6) * 0.35 * settings.breath
    },
    dispose() {
      tunnel.dispose()
      root.remove(tunnel.root)
      eggs.dispose()
      root.remove(eggs.root)
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
