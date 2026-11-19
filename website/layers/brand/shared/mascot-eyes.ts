import { Float32BufferAttribute, Group, Mesh, MeshPhysicalMaterial, NoColorSpace, RepeatWrapping, SphereGeometry, Vector3 } from 'three'
import type { BufferGeometry, Color, Object3D, Texture } from 'three'
import { createEyeMaterial } from './eye-material.ts'
import { createHeadOutline, referenceEyes } from './face.ts'
import type { HeadProjection } from './face.ts'
import { applyMascotSurface } from './mascot-surface.ts'

/** The reference head's artwork and face skin. The caller owns both textures. */
export type EyeDressing = { projection: HeadProjection, skin: Texture }

/** The model's skin beside an eye: a colour, and a small skin texture when the model has one. The caller owns the texture. */
export type LidSkin = { colour: Color, map: Texture | undefined }
/** Where an eye is built. `lid` is the model's skin beside that eye, when the model names one. */
export type EyeAnchor = { node: Object3D, lid: LidSkin | undefined }

/** The radius of an anchor in its parent's units. An anchor is an eyeball mesh, or an empty node whose scale is the radius. */
function anchorRadius(anchor: Object3D) {
  if (!(anchor instanceof Mesh)) return anchor.scale.x
  const geometry: BufferGeometry = anchor.geometry
  if (!geometry.boundingSphere) geometry.computeBoundingSphere()
  return geometry.boundingSphere!.radius * anchor.scale.x
}

/**
 * Builds the relief rig's eyes at each anchor: the same globe artwork and wet-eye shader, and the same two shell lids.
 * An anchor gives the eye its centre, its rest rotation, and its width. The other radii keep the reference proportions.
 * Each anchor is hidden, because the built eye takes its place.
 */
export function createReferenceEyes(anchors: readonly EyeAnchor[], { projection, skin }: EyeDressing) {
  const { uvAt, localAt } = createHeadOutline(projection.raster)
  const { width, height } = projection.raster
  const eye = createEyeMaterial(projection.texture)
  const heightTexture = skin.clone()
  heightTexture.colorSpace = NoColorSpace
  heightTexture.wrapS = heightTexture.wrapT = RepeatWrapping
  heightTexture.needsUpdate = true
  const lidSkin = new MeshPhysicalMaterial({ map: skin, color: '#BAAA96', bumpMap: heightTexture, bumpScale: 0.004,
    roughness: 0.72, metalness: 0.02, clearcoat: 0.03 })
  const lidMaterials = [lidSkin]
  const surfaces = [applyMascotSurface(lidSkin, 'skin')]
  const geometries: BufferGeometry[] = []
  const { lid } = referenceEyes
  const point = new Vector3()
  const built = anchors.slice(0, referenceEyes.radii.length).flatMap(({ node: anchor, lid: modelSkin }, index) => {
    if (!anchor.parent) return []
    // The relief rig's lid skin is the colour of the relief rig's head. A model that names its own skin gets lids in that skin,
    // with the same surface relief.
    let lidMaterial = lidSkin
    if (modelSkin) {
      lidMaterial = new MeshPhysicalMaterial({ color: modelSkin.colour, map: modelSkin.map ?? null, bumpMap: heightTexture, bumpScale: 0.004,
        roughness: 0.72, metalness: 0.02, clearcoat: 0.03 })
      lidMaterials.push(lidMaterial)
      surfaces.push(applyMascotSurface(lidMaterial, 'skin'))
    }
    const [rx, ry, rz] = referenceEyes.radii[index]!
    const [cx, cy] = referenceEyes.centres[index]!
    const centre = localAt(width * cx, height * cy)
    const size = anchorRadius(anchor)
    const radii = { x: size, y: size * ry / rx, z: size * rz / rx }
    const root = new Group()
    root.name = `reference-eye-${index}`
    root.position.copy(anchor.position)
    root.quaternion.copy(anchor.quaternion)
    const sphere = new SphereGeometry(1, 48, 32)
    const directions = sphere.getAttribute('position')
    sphere.setAttribute('eyeSphere', directions.clone())
    // The globe shows the artwork's eye: each point takes the pixel that lies over it in the head artwork.
    const globeUv: number[] = []
    for (let i = 0; i < directions.count; i++) {
      point.fromBufferAttribute(directions, i)
      globeUv.push(...uvAt(centre.x + point.x * rx, centre.y + point.y * ry))
    }
    sphere.setAttribute('uv', new Float32BufferAttribute(globeUv, 2))
    sphere.scale(radii.x, radii.y, radii.z)
    geometries.push(sphere)
    root.add(new Mesh(sphere, eye.material))
    const lids = [true, false].map((upper) => {
      const cap = new SphereGeometry(1, 40, 24, 0, Math.PI * 2, upper ? 0 : Math.PI * 0.5, Math.PI * 0.5)
      cap.scale(lid.radius, lid.radius, lid.depth)
      const shell = cap.getAttribute('position')
      const lidUv: number[] = []
      for (let i = 0; i < shell.count; i++) {
        point.fromBufferAttribute(shell, i)
        lidUv.push(0.5 + point.x * lid.uvSpread, 0.5 + point.y * lid.uvSpread)
      }
      cap.setAttribute('uv', new Float32BufferAttribute(lidUv, 2))
      cap.scale(radii.x, radii.y, radii.z)
      geometries.push(cap)
      const hinge = new Group()
      hinge.name = `reference-${upper ? 'upper' : 'lower'}-lid-${index}`
      hinge.add(new Mesh(cap, lidMaterial))
      root.add(hinge)
      return hinge
    })
    anchor.parent.add(root)
    anchor.visible = false
    return [{ root, upper: lids[0]!, lower: lids[1]!, depth: radii.z, squint: lid.squint[index]! }]
  })
  /** `blink` and `squint` run from 0 to 1. A squint shuts the smaller eye further, as on the relief rig. */
  function shut(blink: number, squint: number) {
    for (const { upper, lower, depth, squint: share } of built) {
      const closure = Math.min(1, Math.max(0, blink) + squint * share)
      upper.rotation.x = -lid.open * (1 - closure)
      lower.rotation.x = lid.open * (1 - closure)
      for (const hinge of [upper, lower]) {
        hinge.position.z = depth * lid.forward * closure
        hinge.scale.z = 1 - closure * lid.flatten
      }
    }
  }
  shut(0, 0)
  return {
    eye,
    shut,
    updateTime(time: number) { eye.updateTime(time); surfaces.forEach(surface => surface.update(time)) },
    /** Removes the built eyes and releases them. The caller's two textures stay. */
    dispose() {
      for (const { root } of built) root.removeFromParent()
      geometries.forEach(geometry => geometry.dispose())
      surfaces.forEach(surface => surface.dispose())
      eye.dispose()
      lidMaterials.forEach(material => material.dispose())
      heightTexture.dispose()
    },
  }
}
