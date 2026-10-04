import {
  BufferGeometry, CatmullRomCurve3, Color, DoubleSide, Float32BufferAttribute, Group, HemisphereLight,
  InstancedMesh, LineBasicMaterial, LineSegments, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  Object3D, PlaneGeometry, PointLight, ShaderMaterial, SphereGeometry, TubeGeometry, Vector2, Vector3,
} from 'three'
import type { Texture } from 'three'
import { createOrganismModel } from './organism'

export type WorldInput = { time: number, pressure: number }

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
export function createWorld(texture: Texture) {
  const root = new Group()
  root.name = 'Brundlefly chamber'
  const tunnel = createOrganismModel(texture, 'lair', 0.7)
  tunnel.root.position.set(0, 0.08, -2.5)
  tunnel.root.scale.setScalar(0.94)
  root.add(tunnel.root)

  const tissue = new MeshPhysicalMaterial({ color: '#AA604B', map: texture, bumpMap: texture,
    bumpScale: 0.1, roughness: 0.46, clearcoat: 0.7, clearcoatRoughness: 0.28 })
  const bruise = new MeshPhysicalMaterial({ color: '#69404B', map: texture, bumpMap: texture,
    bumpScale: 0.12, roughness: 0.55, clearcoat: 0.42 })
  const chitin = new MeshPhysicalMaterial({ color: '#343C3B', map: texture, bumpMap: texture,
    bumpScale: 0.035, roughness: 0.36, clearcoat: 0.8, clearcoatRoughness: 0.3 })
  const membrane = new MeshPhysicalMaterial({ color: '#A4B5A0', map: texture,
    side: DoubleSide, transparent: true, opacity: 0.17, roughness: 0.45, clearcoat: 0.8, depthWrite: false })
  const slime = new MeshPhysicalMaterial({ color: '#777648', transparent: true, opacity: 0.43,
    roughness: 0.13, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, depthWrite: false })

  const groundGeometry = new PlaneGeometry(18, 20, 44, 48)
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
  const ground = new Mesh(groundGeometry, new MeshStandardMaterial({ color: '#343C3B', map: texture,
    bumpMap: texture, bumpScale: 0.085, roughness: 0.83, metalness: 0.04 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, groundLevel - 0.035, -2)
  root.add(ground)

  // The wall is made of asymmetric connected folds, rather than isolated boulders.
  const livingFolds: { mesh: Mesh, scale: Vector3, phase: number }[] = []
  for (let side = -1; side <= 1; side += 2) {
    for (let index = 0; index < 5; index++) {
      const z = 2.1 - index * 1.75
      const fold = new Mesh(foldGeometry(index + side * 3), index % 3 === 0 ? bruise : tissue)
      fold.position.set(side * (4.15 + Math.sin(index * 2 + side) * 0.35), -0.02 + index * 0.06, z)
      fold.scale.set(0.85 + index % 2 * 0.15, 2.7 + Math.sin(index) * 0.3, 1.25)
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
  for (let index = 0; index < 5; index++) {
    const z = 1.2 - index * 1.6
    const points: Vector3[] = []
    for (let step = 0; step <= 12; step++) {
      const angle = step / 12 * Math.PI
      points.push(new Vector3(Math.cos(angle) * (4.15 + Math.sin(index) * 0.12),
        groundLevel + Math.sin(angle) * (5.3 + Math.sin(angle * 3 + index) * 0.17),
        z + Math.sin(angle * 2 + index) * 0.2))
    }
    const arch = new Mesh(new TubeGeometry(new CatmullRomCurve3(points), 48, 0.14 + index % 2 * 0.07, 8, false), bruise)
    root.add(arch)
  }

  // Chitin splinters form a low perimeter, not obstacles in the walking area.
  const plateGeometry = new SphereGeometry(1, 10, 6)
  const plates = new InstancedMesh(plateGeometry, chitin, 48)
  const placement = new Object3D()
  for (let index = 0; index < 48; index++) {
    const side = index % 2 === 0 ? -1 : 1
    placement.position.set(side * (2.8 + Math.abs(variation(index)) * 2),
      groundLevel + 0.035, 3 - Math.floor(index / 2) * 0.43)
    placement.scale.set(0.25 + Math.abs(variation(index + 2)) * 0.4, 0.07 + index % 3 * 0.025, 0.22 + index % 4 * 0.09)
    placement.rotation.set(0.04, index * 0.87, side * 0.08)
    placement.updateMatrix()
    plates.setMatrixAt(index, placement.matrix)
  }
  root.add(plates)

  const puddleGeometry = new SphereGeometry(1, 24, 10)
  for (let index = 0; index < 7; index++) {
    const puddle = new Mesh(puddleGeometry, slime)
    puddle.position.set(Math.sin(index * 2.4) * 2.8, groundLevel - 0.018, 2 - index * 0.78)
    puddle.scale.set(0.46 + index % 3 * 0.18, 0.022, 0.29 + index % 2 * 0.15)
    puddle.rotation.y = index * 0.74
    root.add(puddle)
  }

  const hanging: { mesh: Mesh, phase: number }[] = []
  for (let index = 0; index < 12; index++) {
    const side = index % 2 === 0 ? -1 : 1
    const x = side * (2.45 + index % 3 * 0.42)
    const z = 0.4 - Math.floor(index / 2) * 1.14
    const start = new Vector3(x, 2.2 + Math.sin(index) * 0.35, z)
    const end = new Vector3(x + side * 0.4, -0.8 + index % 3 * 0.3, z + 0.16)
    const midpoint = start.clone().lerp(end, 0.52)
    midpoint.x += side * 0.17
    const strand = new Mesh(new TubeGeometry(new CatmullRomCurve3([start, midpoint, end]), 14, 0.013 + index % 3 * 0.005, 5, false), slime)
    root.add(strand)
    hanging.push({ mesh: strand, phase: index * 1.7 })
    const drop = new Mesh(puddleGeometry, slime)
    drop.position.copy(end)
    drop.scale.set(0.037, 0.065, 0.036)
    root.add(drop)
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

  root.add(new HemisphereLight(new Color('#A4B5A0'), new Color('#080B08'), 0.7))
  const warm = new PointLight('#E8D4A6', 28, 15, 2)
  warm.position.set(-2.7, 3.2, 3.4)
  const cold = new PointLight('#418B90', 16, 12, 2)
  cold.position.set(3.5, 1.1, -1.9)
  const inner = new PointLight('#AA604B', 5, 8, 2)
  inner.position.set(-1.4, 0.6, -5.5)
  root.add(warm, cold, inner)
  const pointer = new Vector2()

  return {
    root,
    update({ time, pressure }: WorldInput) {
      const response = Math.min(1, Math.max(0, pressure))
      tunnel.update({ time, pressure: response * 0.25, wetness: 0.85, pointer, opening: 0.7, transform: 'squeeze' })
      for (const { mesh, scale, phase } of livingFolds) {
        mesh.scale.set(scale.x * (1 + Math.sin(time * 0.48 + phase) * 0.014 + response * 0.015),
          scale.y * (1 + Math.sin(time * 0.36 + phase) * 0.006), scale.z)
      }
      for (const { mesh, phase } of hanging) mesh.rotation.z = Math.sin(time * 0.37 + phase) * 0.006
      inner.intensity = 5 + Math.sin(time * 0.6) * 0.35
    },
    dispose() {
      tunnel.dispose()
      root.remove(tunnel.root)
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
