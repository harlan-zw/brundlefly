import { BackSide, Color, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, PMREMGenerator, Scene, SphereGeometry } from 'three'
import type { WebGLRenderer } from 'three'

// Broad cards mirror the scene lights, so reflections agree with the direct lighting.
const cards = [
  { color: '#E8D4A6', strength: 7, position: [-1.4, 6.5, 5], scale: [5, 2.4] },
  { color: '#418B90', strength: 5, position: [-8, 1.2, -3], scale: [1.6, 6] },
  { color: '#418B90', strength: 6, position: [8, 2, -2], scale: [2, 4.5] },
  { color: '#A4B5A0', strength: 1.6, position: [0, 7, -6], scale: [7, 1] },
  { color: '#AA604B', strength: 0.4, position: [0, -6, 1], scale: [14, 14] },
  // Low cold pockets beyond the opening. The wet floor mirrors them toward the camera.
  { color: '#A4B5A0', strength: 10, position: [-3.2, 0.9, -7.2], scale: [1.4, 0.5] },
  { color: '#418B90', strength: 12, position: [2.6, 0.6, -7.5], scale: [1.8, 0.45] },
  { color: '#E8D4A6', strength: 8, position: [0.4, 1.6, -7.8], scale: [1, 0.35] },
] as const

// Small seeps of cold light scatter glints across every wet surface, as in a cave lit through cracks.
const seeps = Array.from({ length: 34 }, (_, index) => {
  const y = 0.92 - index / 33 * 1.25
  const ring = Math.sqrt(1 - y * y)
  const angle = index * 2.39996
  const size = 0.3 + (index * 7 % 5) * 0.1
  return { color: index % 3 === 0 ? '#E8D4A6' : '#A4B5A0', strength: 16, size,
    position: [Math.cos(angle) * ring * 8, y * 8, Math.sin(angle) * ring * 8] as const }
})

/** A black cave surround with bright cards. Wet surfaces show them as sparse glints, not a lit room. */
export function createWetEnvironment(renderer: WebGLRenderer) {
  const scene = new Scene()
  const surroundGeometry = new SphereGeometry(10, 32, 16)
  const cardGeometry = new PlaneGeometry(1, 1)
  const materials = [new MeshBasicMaterial({ color: '#040403', side: BackSide })]
  scene.add(new Mesh(surroundGeometry, materials[0]))
  const placements = [...cards.map(({ color, strength, position, scale }) => ({ color, strength, position, scale: [scale[0], scale[1]] as const })),
    ...seeps.map(({ color, strength, position, size }) => ({ color, strength, position, scale: [size, size * 0.6] as const }))]
  for (const { color, strength, position, scale } of placements) {
    const material = new MeshBasicMaterial({ color: new Color(color).multiplyScalar(strength), side: DoubleSide })
    materials.push(material)
    const card = new Mesh(cardGeometry, material)
    card.position.set(...position)
    card.scale.set(scale[0], scale[1], 1)
    card.lookAt(0, 0, 0)
    scene.add(card)
  }
  const generator = new PMREMGenerator(renderer)
  const target = generator.fromScene(scene, 0.02)
  generator.dispose()
  surroundGeometry.dispose()
  cardGeometry.dispose()
  materials.forEach(material => material.dispose())
  return { texture: target.texture, dispose: () => target.dispose() }
}
