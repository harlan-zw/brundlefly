import { AnimationMixer, Box3, Group, Mesh, Object3D, SkinnedMesh, Texture, Vector3 } from 'three'
import type { AnimationClip } from 'three'

/** Served copy of assets/3d/brundlefly/brundlefly-web.glb. The brand sync script owns that copy. */
export const meshMascotUrl = '/brand/3d/brundlefly-web.glb'
/** Height of the relief rig in its own units. Both mascots fill the same space. */
export const reliefStandingHeight = 2.5

export type MeshMascotSource = { scene: Object3D, animations: readonly AnimationClip[] }
/** A file with clips plays its idle clip. A file without clips sways as one object. */
export type MeshMascotMotion = { _tag: 'Clip', name: string } | { _tag: 'Sway' }
export type MeshMascot = ReturnType<typeof assemble>
export type MeshMascotResult = { _tag: 'Ok', mascot: MeshMascot } | { _tag: 'Err', reason: string }

/** Releases every GPU resource a loaded model holds. */
export function releaseMeshSource(scene: Object3D) {
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.geometry.dispose()
    if (object instanceof SkinnedMesh) object.skeleton.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material)) if (value instanceof Texture) value.dispose()
      material.dispose()
    }
  })
}

function assemble(scene: Object3D, animations: readonly AnimationClip[], bounds: Box3, height: number) {
  const size = bounds.getSize(new Vector3())
  const scale = height / size.y
  // The file sets where he stands. Only the height and the floor contact come from the measured bounds.
  const fit = new Group()
  fit.scale.setScalar(scale)
  fit.position.y = -bounds.min.y * scale
  fit.add(scene)
  // The pivot sits between the feet, so a sway never lifts them off the floor.
  const pivot = new Group()
  pivot.add(fit)
  const root = new Group()
  root.name = 'Brundlefly-mesh'
  root.add(pivot)
  const idle = animations.find(clip => clip.name === 'Brundlefly-idle') ?? animations[0]
  const mixer = idle ? new AnimationMixer(scene) : undefined
  if (mixer && idle) mixer.clipAction(idle).play()
  const motion: MeshMascotMotion = idle ? { _tag: 'Clip', name: idle.name } : { _tag: 'Sway' }
  let face = scene.getObjectByName('anchor-face')
  if (!face) {
    // Without an anchor, the face is high on the front of the body.
    face = new Object3D()
    face.position.set((bounds.min.x + bounds.max.x) / 2, bounds.min.y + size.y * 0.8, bounds.max.z)
    fit.add(face)
  }
  const faceAnchor = face
  return {
    _tag: 'Mesh' as const,
    root,
    motion,
    /** Horizontal reach and height in root units. The feet are at zero. */
    extent: { left: bounds.min.x * scale, right: bounds.max.x * scale, height },
    /** World position of his face, for the conversation close-up. */
    facePoint: (target: Vector3) => faceAnchor.getWorldPosition(target),
    /** `time` is seconds of visible motion. Zero is the authored rest pose. */
    update(time: number) {
      if (mixer) { mixer.setTime(time); return }
      pivot.rotation.set(Math.sin(time * 0.37) * 0.01, Math.sin(time * 0.23) * 0.06, Math.sin(time * 0.53) * 0.014)
      pivot.scale.y = 1 + Math.sin(time * 1.4) * 0.006
    },
    dispose() {
      mixer?.stopAllAction()
      mixer?.uncacheRoot(scene)
      releaseMeshSource(scene)
    },
  }
}

/**
 * Places a loaded model where the relief rig stands. The model keeps its own materials.
 * The function owns the source: it releases the model when the file is unusable.
 */
export function createMeshMascot({ scene, animations }: MeshMascotSource, height = reliefStandingHeight): MeshMascotResult {
  // A figurine base changes the measured height and the floor contact. The site shows him without it.
  const base = scene.getObjectByName('Brundlefly-base')
  if (base) { releaseMeshSource(base); base.removeFromParent() }
  scene.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(scene, true)
  if (bounds.isEmpty() || bounds.max.y <= bounds.min.y) {
    releaseMeshSource(scene)
    return { _tag: 'Err', reason: 'The file contains no geometry with height.' }
  }
  return { _tag: 'Ok', mascot: assemble(scene, animations, bounds, height) }
}
