<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useDocumentVisibility, useElementSize, useEventListener, useIntersectionObserver, usePreferredReducedMotion, useWindowScroll } from '@vueuse/core'
import {
  AmbientLight, ClampToEdgeWrapping, DirectionalLight, Group, Mesh, MeshStandardMaterial, MirroredRepeatWrapping,
  NearestFilter, PerspectiveCamera, Scene, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector2, WebGLRenderer,
} from 'three'
import { createOrganismModel } from '../../shared/organism'
import { createMascotModel } from '../../shared/mascot'
import type { Presentation, Transform } from '../../shared/organism'

const { wetness = 0.75, viscosity = 0.6, pressure = 0, opening = 0.5, transform = 'squeeze', presentation = 'specimen', interactive = true, motionOff = false, exportable = false, mascot = false, framing = 'center', distance } = defineProps<{
  wetness?: number, viscosity?: number, pressure?: number, motionOff?: boolean, exportable?: boolean
  opening?: number, transform?: Transform, presentation?: Presentation, interactive?: boolean
  mascot?: boolean
  framing?: 'center' | 'left'
  distance?: number
}>()
type SceneStatus = { _tag: 'Loading' } | { _tag: 'Ready' } | { _tag: 'Fallback', reason: 'context' | 'texture' }
const status = ref<SceneStatus>({ _tag: 'Loading' })
const host = shallowRef<HTMLElement | null>(null)
const canvas = shallowRef<HTMLCanvasElement | null>(null)
const { width, height } = useElementSize(host)
const reducedMotion = usePreferredReducedMotion()
const documentVisibility = useDocumentVisibility()
const visible = ref(true)
useIntersectionObserver(host, ([entry]) => { visible.value = Boolean(entry?.isIntersecting) })
const animate = computed(() => !motionOff && reducedMotion.value !== 'reduce' && visible.value && documentVisibility.value === 'visible')
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
watch([() => wetness, () => viscosity, () => pressure, () => opening, () => transform, () => motionOff, () => distance, pressed, animate, width, height], () => refresh?.())
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
  scene.add(model.root)
  const mascotTexture = mascot ? await new TextureLoader().loadAsync('/brand/character.png').catch((error: unknown) => {
    console.warn('Brundlefly mascot texture load failed.', error)
    return undefined // The chamber remains usable when its optional mascot artwork fails.
  }) : undefined
  if (!alive) { mascotTexture?.dispose(); model.dispose(); texture.dispose(); renderer.dispose(); return }
  const mascotModel = mascotTexture ? (() => {
    mascotTexture.colorSpace = SRGBColorSpace
    mascotTexture.wrapS = mascotTexture.wrapT = ClampToEdgeWrapping
    mascotTexture.magFilter = NearestFilter
    const image = mascotTexture.image as HTMLImageElement
    const raster = document.createElement('canvas')
    raster.width = 180
    raster.height = Math.round(180 * image.height / image.width)
    const painter = raster.getContext('2d')!
    painter.drawImage(image, 0, 0, raster.width, raster.height)
    return createMascotModel(mascotTexture, painter.getImageData(0, 0, raster.width, raster.height))
  })() : undefined
  if (mascotModel) {
    const figure = new Group()
    figure.position.set(0.3, -0.12, -2)
    figure.scale.setScalar(1.75)
    figure.add(mascotModel.root)
    scene.add(figure)
  }
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
    camera.position.z = (distance ?? (presentation === 'lair' ? 5.8 : 5.5)) - approach * 0.45
    model.update({ time: elapsed, pressure: currentPressure, wetness, pointer, transform,
      opening: opening + (presentation === 'lair' ? Math.min(elapsed / 2, 1) * 0.15 + approach * 0.12 : 0) })
    mascotModel?.update({ time: elapsed, pressure: currentPressure, pointer, transform })
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
    render(1 / 60)
  }
  cleanup = () => {
    renderer.setAnimationLoop(null)
    model.dispose()
    mascotModel?.dispose()
    mascotTexture?.dispose()
    texture.dispose()
    renderer.dispose()
    download = undefined
  }
  download = async () => {
    // Ambient pages never export. Load the GLB writer only for an explicit download.
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js')
    // GLB stores the rest mesh and PBR texture. Runtime shader deformation stays in the layer source.
    const rest = mascotModel ? mascotModel.root : model.root.clone(true)
    const flesh = new MeshStandardMaterial({ map: texture, roughness: 0.35, metalness: 0.1 })
    const chitin = new MeshStandardMaterial({ map: texture, color: '#343C3B', roughness: 0.2, metalness: 0.25 })
    rest.traverse(object => {
      if (object instanceof Mesh && object.material instanceof ShaderMaterial) {
        object.material = object.material.uniforms.uChitin?.value ? chitin : flesh
      }
    })
    const animations = mascotModel ? [mascotModel.idleAnimation(), mascotModel.walkAnimation()] : []
    const data = await new GLTFExporter().parseAsync(rest, { binary: true, animations }).finally(() => { flesh.dispose(); chitin.dispose(); refresh?.() })
    if (!(data instanceof ArrayBuffer)) throw new Error('GLB export did not return a binary model.')
    const url = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }))
    const link = document.createElement('a')
    link.href = url
    link.download = mascotModel ? 'brundlefly-rig.glb' : `brundlefly-${presentation === 'lair' ? 'lair' : 'aperture'}.glb`
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
    <div ref="host" class="brand-organism" :data-renderer="status._tag" :data-presentation="presentation" :data-transform="transform">
      <img v-if="status._tag !== 'Ready'" class="brand-organism-fallback" :src="mascot ? '/brand/character.png' : '/brand/kit/aperture.png'" alt="" :width="mascot ? 1199 : 1254" :height="mascot ? 1312 : 1254">
      <canvas ref="canvas" :style="{ opacity: status._tag === 'Ready' ? 1 : 0 }" aria-hidden="true" />
      <button v-if="status._tag === 'Ready' && interactive" class="brand-organism-control" type="button" aria-label="Press to deform"
        @pointermove="move" @pointerdown="grab" @pointercancel="release" @lostpointercapture="release"
        @keydown.space.prevent="pressed = true" @keyup.space.prevent="release" @keydown.enter.prevent="pressed = true" @keyup.enter.prevent="release" @blur="release" />
      <span class="brand-organism-status" role="status">{{ status._tag === 'Ready' ? '3D material' : status._tag === 'Loading' ? '3D loading.' : status.reason === 'texture' ? 'Static material. The texture could not load.' : 'Static material. WebGL is unavailable.' }}</span>
    </div>
    <UButton v-if="exportable && status._tag === 'Ready'" variant="outline" @click="exportModel">Download GLB</UButton>
    <p v-if="exportError" role="alert">{{ exportError }}</p>
  </div>
</template>
