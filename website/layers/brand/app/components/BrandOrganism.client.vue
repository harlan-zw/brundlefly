<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useDocumentVisibility, useElementSize, useEventListener, useIntersectionObserver, usePreferredReducedMotion, useWindowScroll } from '@vueuse/core'
import {
  AmbientLight, AnimationMixer, ClampToEdgeWrapping, DirectionalLight, Group, LinearFilter, Mesh, MeshStandardMaterial, MirroredRepeatWrapping,
  NearestFilter, PerspectiveCamera, Scene, ShaderMaterial, SkeletonHelper, SRGBColorSpace, TextureLoader, Vector2, WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createOrganismModel } from '../../shared/organism'
import { createMascotModel } from '../../shared/mascot'
import { loadMeshMascot, reliefStandingHeight } from '../../shared/mascot-mesh'
import { clipPoses } from '../../shared/mascot-pose'
import { poseMannerisms } from '../../shared/mannerism'
import type { MannerismTag } from '../../shared/mannerism'
import type { Presentation, Transform } from '../../shared/organism'

const { wetness = 0.75, viscosity = 0.6, pressure = 0, opening = 0.5, transform = 'squeeze', presentation = 'specimen', interactive = true, motionOff = false, exportable = false, mascot = false, framing = 'center', distance, speaking = 0, blink, brow, squint, inspector = false, bones = false, wireframe = false, clip = 'Manual', playing = false, playbackSpeed = 1, textureMode = 'mapped', habit = 'None', habitTime = 0, habitSide = 1, turn } = defineProps<{
  wetness?: number, viscosity?: number, pressure?: number, motionOff?: boolean, exportable?: boolean
  opening?: number, transform?: Transform, presentation?: Presentation, interactive?: boolean
  mascot?: boolean
  framing?: 'center' | 'left' | 'face'
  distance?: number
  speaking?: number, blink?: number, brow?: number, squint?: number
  inspector?: boolean, bones?: boolean, wireframe?: boolean
  clip?: 'Manual' | 'Idle' | 'Walk' | 'Speaking'
  playing?: boolean, playbackSpeed?: number, textureMode?: 'mapped' | 'sprite' | 'mesh'
  /** The inspector can hold the mesh in one moment of a habit, turned as he stands at his work. `turn` is his turn about the vertical, in radians. */
  habit?: MannerismTag | 'None', habitTime?: number, habitSide?: 1 | -1, turn?: number
}>()
const clipTime = defineModel<number>('clipTime', { default: 0 })
type ShownMascot = 'relief' | 'sprite' | 'mesh'
const emit = defineEmits<{ clips: [durations: Record<string, number>], shown: [mascot: ShownMascot, rigged: boolean, posable: boolean] }>()
// The component reports the mascot it shows. A mesh that cannot load shows the relief rig.
const shownMascot = ref<ShownMascot>()
const meshUnavailable = ref(false)
type SceneStatus = { _tag: 'Loading' } | { _tag: 'Ready' } | { _tag: 'Fallback', reason: 'context' | 'texture' }
const status = ref<SceneStatus>({ _tag: 'Loading' })
const host = shallowRef<HTMLElement | null>(null)
const canvas = shallowRef<HTMLCanvasElement | null>(null)
const { width, height } = useElementSize(host)
const reducedMotion = usePreferredReducedMotion()
const documentVisibility = useDocumentVisibility()
const visible = ref(true)
useIntersectionObserver(host, ([entry]) => { visible.value = Boolean(entry?.isIntersecting) })
const animate = computed(() => (inspector ? playing && clip !== 'Manual' : !motionOff && reducedMotion.value !== 'reduce') && visible.value && documentVisibility.value === 'visible')
const pressed = ref(false)
const pointer = new Vector2()
const { y: scrollY } = useWindowScroll()
const exportError = ref('')
let cleanup: (() => void) | undefined
let refresh: (() => void) | undefined
let download: (() => Promise<void>) | undefined
let alive = true

function move(event: PointerEvent) {
  const bounds = host.value?.getBoundingClientRect()
  if (!bounds) return
  pointer.set(Math.max(-1, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width) * 2 - 1)),
    Math.max(-1, Math.min(1, 1 - (event.clientY - bounds.top) / Math.max(1, bounds.height) * 2)))
  refresh?.()
}
function release() { pressed.value = false }
function grab(event: PointerEvent) {
  pressed.value = true
  move(event)
  const element = event.currentTarget as HTMLElement
  element.setPointerCapture(event.pointerId)
}
useEventListener('pointerup', release)
useEventListener('blur', release)
useEventListener('pointermove', (event) => { if (!interactive && presentation === 'lair' && animate.value) move(event) })
useEventListener(canvas, 'webglcontextlost', (event) => {
  event.preventDefault()
  alive = false
  cleanup?.()
  cleanup = undefined
  refresh = undefined
  status.value = { _tag: 'Fallback', reason: 'context' }
})
watch([() => wetness, () => viscosity, () => pressure, () => opening, () => transform, () => motionOff, () => distance, () => framing, () => speaking, () => blink, () => brow, () => squint, pressed, animate, width, height], () => refresh?.())
watch([() => bones, () => wireframe, () => clip, () => playbackSpeed, clipTime, () => habit, () => habitTime, () => habitSide, () => turn], () => refresh?.())
watch(scrollY, () => { if (presentation === 'lair' && animate.value) refresh?.() })
onScopeDispose(() => { alive = false; cleanup?.() })

// Client-only hydration can mount before its canvas exists. Start from the actual element.
watch(canvas, async (element) => {
  if (!element) return
  const context = element.getContext('webgl2', { alpha: true, antialias: false })
  if (!context) { status.value = { _tag: 'Fallback', reason: 'context' }; return }
  const texture = await new TextureLoader().loadAsync('/brand/kit/modular/flesh-diffuse.png').catch((error: unknown) => {
    console.warn('Brundlefly texture load failed.', error)
    status.value = { _tag: 'Fallback', reason: 'texture' }
    return undefined
  })
  if (!texture) return
  if (!alive) { texture.dispose(); return }
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = MirroredRepeatWrapping
  texture.magFilter = NearestFilter
  const renderer = new WebGLRenderer({ canvas: element, context, alpha: true, antialias: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, presentation === 'lair' ? 1 : 1.5))
  const scene = new Scene()
  const camera = new PerspectiveCamera(42, 1, 0.1, 20)
  camera.position.set(0, -0.07, 4.7)
  scene.add(new AmbientLight('#E8D4A6', 2))
  const light = new DirectionalLight('#E8D4A6', 3)
  light.position.set(-2, 3, 4)
  scene.add(light)
  const model = createOrganismModel(texture, presentation, mascot ? 0.58 : 1)
  model.root.visible = !mascot
  scene.add(model.root)
  const [mascotTexture, faceTexture, projectionTexture, bodyProjectionTexture, meshResult] = mascot ? await Promise.all([
    new TextureLoader().loadAsync('/brand/character.png').catch((error: unknown) => {
    console.warn('Brundlefly mascot texture load failed.', error)
    return undefined // The chamber remains usable when its optional mascot artwork fails.
    }),
    new TextureLoader().loadAsync('/brand/kit/lair/face-skin-diffuse.png').catch((error: unknown) => {
      console.warn('Brundlefly face texture load failed. Using the chamber tissue.', error)
      return undefined
    }),
    new TextureLoader().loadAsync('/brand/kit/lair/head-projection.png').catch((error: unknown) => {
      console.warn('Brundlefly head projection load failed. Using the sculpted head.', error)
      return undefined
    }),
    new TextureLoader().loadAsync('/brand/kit/lair/body-projection.png').catch((error: unknown) => {
      console.warn('Brundlefly body projection load failed. Using the canonical artwork.', error)
      return undefined
    }),
    textureMode === 'mesh' ? loadMeshMascot() : undefined,
  ]) : [undefined, undefined, undefined, undefined, undefined]
  if (projectionTexture) {
    projectionTexture.colorSpace = SRGBColorSpace
    projectionTexture.wrapS = projectionTexture.wrapT = ClampToEdgeWrapping
    projectionTexture.magFilter = LinearFilter
  }
  if (faceTexture) {
    faceTexture.colorSpace = SRGBColorSpace
    faceTexture.wrapS = faceTexture.wrapT = MirroredRepeatWrapping
  }
  if (bodyProjectionTexture) {
    bodyProjectionTexture.colorSpace = SRGBColorSpace
    bodyProjectionTexture.wrapS = bodyProjectionTexture.wrapT = ClampToEdgeWrapping
    bodyProjectionTexture.magFilter = LinearFilter
  }
  const meshMascot = meshResult?._tag === 'Ok' ? meshResult.mascot : undefined
  if (!alive) { meshMascot?.dispose(); mascotTexture?.dispose(); faceTexture?.dispose(); projectionTexture?.dispose(); bodyProjectionTexture?.dispose(); model.dispose(); texture.dispose(); renderer.dispose(); return }
  if (meshResult?._tag === 'Err') {
    console.warn(`The Brundlefly mesh could not load. The relief rig takes its place. ${meshResult.reason}`)
    meshUnavailable.value = true
  }
  if (meshMascot && projectionTexture && faceTexture) {
    // The mesh gets the relief rig's eyes, from the same head artwork and face skin.
    const projectionImage = projectionTexture.image as HTMLImageElement
    const projectionRaster = document.createElement('canvas')
    projectionRaster.width = 180
    projectionRaster.height = Math.round(180 * projectionImage.height / projectionImage.width)
    const projectionPainter = projectionRaster.getContext('2d')!
    projectionPainter.drawImage(projectionImage, 0, 0, projectionRaster.width, projectionRaster.height)
    meshMascot.dressEyes({ projection: { texture: projectionTexture, raster: projectionPainter.getImageData(0, 0, projectionRaster.width, projectionRaster.height) }, skin: faceTexture })
  }
  const reliefMascot = !meshMascot && mascotTexture ? (() => {
    mascotTexture.colorSpace = SRGBColorSpace
    mascotTexture.wrapS = mascotTexture.wrapT = ClampToEdgeWrapping
    mascotTexture.magFilter = NearestFilter
    const image = mascotTexture.image as HTMLImageElement
    const raster = document.createElement('canvas')
    raster.width = 180
    raster.height = Math.round(180 * image.height / image.width)
    const painter = raster.getContext('2d')!
    painter.drawImage(image, 0, 0, raster.width, raster.height)
    const projection = projectionTexture ? (() => {
      const projectionImage = projectionTexture.image as HTMLImageElement
      const projectionRaster = document.createElement('canvas')
      projectionRaster.width = 180
      projectionRaster.height = Math.round(180 * projectionImage.height / projectionImage.width)
      const projectionPainter = projectionRaster.getContext('2d')!
      projectionPainter.drawImage(projectionImage, 0, 0, projectionRaster.width, projectionRaster.height)
      return { texture: projectionTexture, raster: projectionPainter.getImageData(0, 0, projectionRaster.width, projectionRaster.height) }
    })() : undefined
    const bodyProjection = bodyProjectionTexture ? (() => {
      const projectionImage = bodyProjectionTexture.image as HTMLImageElement
      const projectionRaster = document.createElement('canvas')
      projectionRaster.width = 180
      projectionRaster.height = Math.round(180 * projectionImage.height / projectionImage.width)
      const projectionPainter = projectionRaster.getContext('2d')!
      projectionPainter.drawImage(projectionImage, 0, 0, projectionRaster.width, projectionRaster.height)
      return { texture: bodyProjectionTexture, raster: projectionPainter.getImageData(0, 0, projectionRaster.width, projectionRaster.height) }
    })() : undefined
    return createMascotModel(mascotTexture, painter.getImageData(0, 0, raster.width, raster.height), faceTexture ?? texture,
      textureMode === 'sprite' ? undefined : projection, textureMode === 'sprite' ? undefined : bodyProjection)
  })() : undefined
  const mascotRoot = (meshMascot ?? reliefMascot)?.root
  // The relief rig is centred on its origin. The mesh stands on its origin, so it moves down by half its height.
  if (meshMascot) meshMascot.root.position.y = -reliefStandingHeight / 2
  if (mascotRoot) {
    const figure = new Group()
    figure.position.set(0.3, -0.12, -2)
    figure.scale.setScalar(1.75)
    figure.add(mascotRoot)
    scene.add(figure)
    shownMascot.value = meshMascot ? 'mesh' : textureMode === 'sprite' ? 'sprite' : 'relief'
    emit('shown', shownMascot.value, meshMascot ? meshMascot.skinned : true, meshMascot ? meshMascot.pose !== undefined : true)
  }
  const orbit = inspector ? new OrbitControls(camera, element) : undefined
  if (orbit) {
    camera.position.set(0.3, 0.15, 6.5)
    orbit.target.set(0.3, -0.12, -2)
    orbit.minDistance = 2.2
    orbit.maxDistance = 13
    orbit.enablePan = false
    orbit.addEventListener('change', () => refresh?.())
    orbit.update()
  }
  const helper = inspector && mascotRoot ? new SkeletonHelper(mascotRoot) : undefined
  if (helper) {
    for (const material of Array.isArray(helper.material) ? helper.material : [helper.material]) material.depthTest = false
    helper.renderOrder = 20
    scene.add(helper)
  }
  const mixer = inspector && reliefMascot ? new AnimationMixer(reliefMascot.root) : undefined
  const clips = mixer && reliefMascot ? { Idle: reliefMascot.idleAnimation(), Walk: reliefMascot.walkAnimation(), Speaking: reliefMascot.speakingAnimation() } : undefined
  if (clips) emit('clips', Object.fromEntries(Object.entries(clips).map(([name, animation]) => [name, animation.duration])))
  // The mesh has one motion: its idle clip or its sway.
  // A mesh that takes the relief rig's pose code plays the same three motions. Any other mesh has one motion: its idle clip or its sway.
  else if (inspector && meshMascot) emit('clips', meshMascot.pose
    ? Object.fromEntries(Object.entries(clipPoses).map(([name, { duration }]) => [name, duration]))
    : { Idle: meshMascot.idleDuration })
  let activeClip = ''
  let currentPressure = 0
  let elapsed = 0
  let previousTime = 0
  let renderWidth = 0
  let renderHeight = 0
  let loopActive = false
  function render(delta: number) {
    const target = pressed.value ? 1 : pressure
    currentPressure = animate.value ? currentPressure + (target - currentPressure) * Math.min(1, delta * (14 - viscosity * 10)) : target
    const approach = presentation === 'lair' ? Math.min(scrollY.value / 900, 0.8) : 0
    if (!inspector && mascot && framing === 'face') {
      camera.position.set(1.012, 1.108, -1.72 + (distance ?? 2.8))
      camera.lookAt(1.012, 1.108, -1.72)
    }
    else if (!inspector) {
      camera.position.set(0, -0.07, (distance ?? (presentation === 'lair' ? 5.8 : 5.5)) - approach * 0.45)
      camera.lookAt(0, -0.07, 0)
    }
    model.update({ time: elapsed, pressure: currentPressure, wetness, pointer, transform,
      opening: opening + (presentation === 'lair' ? Math.min(elapsed / 2, 1) * 0.15 + approach * 0.12 : 0) })
    const posedClip = inspector && meshMascot?.pose && clip !== 'Manual' ? clipPoses[clip] : undefined
    if (meshMascot?.pose && posedClip) {
      if (delta && animate.value) clipTime.value = (clipTime.value + delta * playbackSpeed) % posedClip.duration
      meshMascot.pose(posedClip.pose(clipTime.value))
    }
    else if (meshMascot) {
      // Every clip except Idle shows the mesh at rest. Outside the inspector the idle motion always runs.
      const idle = !inspector || clip === 'Idle'
      if (inspector && idle && delta && animate.value) clipTime.value = (clipTime.value + delta * playbackSpeed) % meshMascot.idleDuration
      meshMascot.update(!idle ? 0 : inspector ? clipTime.value : elapsed)
      // Manual shows the pose the controls set, when the file can take the relief rig's pose code.
      if (!idle) meshMascot.pose?.({ time: 0, pressure: currentPressure, pointer, transform, speaking, blink: blink ?? 0, brow, squint,
        mannerism: habit === 'None' ? undefined : poseMannerisms([{ mannerism: { _tag: habit }, age: habitTime, side: habitSide }]) }, undefined, turn)
    }
    else if (mixer && clips && clip !== 'Manual') {
      if (activeClip !== clip) {
        mixer.stopAllAction()
        mixer.clipAction(clips[clip]).reset().play()
        activeClip = clip
      }
      if (delta && animate.value) clipTime.value = (clipTime.value + delta * playbackSpeed) % clips[clip].duration
      reliefMascot?.updateMaterials(clipTime.value)
      mixer.setTime(clipTime.value)
    }
    else {
      if (mixer && activeClip) { mixer.stopAllAction(); activeClip = '' }
      reliefMascot?.update({ time: inspector ? 0 : elapsed, pressure: currentPressure, pointer, transform, speaking, blink, brow, squint,
        eyes: inspector ? undefined : { _tag: 'Wander' } })
    }
    if (helper) helper.visible = bones
    if (inspector) mascotRoot?.traverse(object => {
      if (!(object instanceof Mesh)) return
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if ('wireframe' in material) material.wireframe = wireframe
      }
    })
    renderer.render(scene, camera)
  }
  refresh = () => {
    const w = Math.max(1, width.value)
    const h = Math.max(1, height.value)
    if (w !== renderWidth || h !== renderHeight) {
      renderWidth = w
      renderHeight = h
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      if (framing === 'left' && w / h > 1.3) camera.setViewOffset(w, h, w * 0.17, 0, w, h)
      else camera.clearViewOffset()
      camera.updateProjectionMatrix()
    }
    if (loopActive !== animate.value) {
      loopActive = animate.value
      previousTime = 0
      renderer.setAnimationLoop(loopActive ? (time: number) => {
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 1 / 60
      previousTime = time
      elapsed += delta
      render(delta)
      } : null)
    }
    render(inspector ? 0 : 1 / 60)
  }
  cleanup = () => {
    renderer.setAnimationLoop(null)
    orbit?.dispose()
    helper?.dispose()
    mixer?.stopAllAction()
    if (reliefMascot) mixer?.uncacheRoot(reliefMascot.root)
    model.dispose()
    meshMascot?.dispose()
    reliefMascot?.dispose()
    mascotTexture?.dispose()
    faceTexture?.dispose()
    projectionTexture?.dispose()
    bodyProjectionTexture?.dispose()
    texture.dispose()
    renderer.dispose()
    download = undefined
  }
  download = async () => {
    // Ambient pages never export. Load the GLB writer only for an explicit download.
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js')
    // GLB stores the rest mesh and PBR texture. Runtime shader deformation stays in the layer source.
    const rest = reliefMascot ? reliefMascot.root : model.root.clone(true)
    const flesh = new MeshStandardMaterial({ map: texture, roughness: 0.35, metalness: 0.1 })
    const chitin = new MeshStandardMaterial({ map: texture, color: '#343C3B', roughness: 0.2, metalness: 0.25 })
    rest.traverse(object => {
      if (object instanceof Mesh && object.material instanceof ShaderMaterial) {
        object.material = object.material.uniforms.uChitin?.value ? chitin : flesh
      }
    })
    const animations = reliefMascot ? [reliefMascot.idleAnimation(), reliefMascot.walkAnimation(), reliefMascot.speakingAnimation()] : []
    const data = await new GLTFExporter().parseAsync(rest, { binary: true, animations }).finally(() => { flesh.dispose(); chitin.dispose(); refresh?.() })
    if (!(data instanceof ArrayBuffer)) throw new Error('GLB export did not return a binary model.')
    const url = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }))
    const link = document.createElement('a')
    link.href = url
    link.download = reliefMascot ? 'brundlefly-rig.glb' : `brundlefly-${presentation === 'lair' ? 'lair' : 'aperture'}.glb`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  status.value = { _tag: 'Ready' }
  refresh()
}, { flush: 'post', once: true })
function exportModel() {
  exportError.value = ''
  download?.().catch((error: unknown) => {
    console.error('Brundlefly GLB export failed.', error)
    exportError.value = 'Model export failed. Use the layer source to rebuild the model.'
  })
}
</script>

<template>
  <div>
    <div ref="host" class="brand-organism" :data-renderer="status._tag" :data-mascot="shownMascot" :data-presentation="presentation" :data-transform="transform">
      <img v-if="status._tag !== 'Ready'" class="brand-organism-fallback" :src="mascot ? '/brand/character.png' : '/brand/kit/aperture.png'" alt="" :width="mascot ? 1199 : 1254" :height="mascot ? 1312 : 1254">
      <canvas ref="canvas" :style="{ opacity: status._tag === 'Ready' ? 1 : 0 }" aria-hidden="true" />
      <button v-if="status._tag === 'Ready' && interactive && !inspector" class="brand-organism-control" type="button" aria-label="Press to deform"
        @pointermove="move" @pointerdown="grab" @pointercancel="release" @lostpointercapture="release"
        @keydown.space.prevent="pressed = true" @keyup.space.prevent="release" @keydown.enter.prevent="pressed = true" @keyup.enter.prevent="release" @blur="release" />
      <span class="brand-organism-status" role="status">{{ status._tag === 'Ready' ? meshUnavailable ? 'Mapped texture. The mesh could not load.' : '3D material' : status._tag === 'Loading' ? '3D loading.' : status.reason === 'texture' ? 'Static material. The texture could not load.' : 'Static material. WebGL is unavailable.' }}</span>
    </div>
    <UButton v-if="exportable && status._tag === 'Ready' && shownMascot !== 'mesh'" variant="outline" @click="exportModel">Download GLB</UButton>
    <p v-if="exportError" role="alert">{{ exportError }}</p>
  </div>
</template>
