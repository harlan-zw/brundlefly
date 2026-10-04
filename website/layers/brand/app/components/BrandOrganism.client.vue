<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useDocumentVisibility, useElementSize, useEventListener, useIntersectionObserver, usePreferredReducedMotion } from '@vueuse/core'
import {
  AmbientLight, DirectionalLight, Mesh, MeshStandardMaterial, MirroredRepeatWrapping,
  NearestFilter, PerspectiveCamera, Scene, SRGBColorSpace, TextureLoader, Vector2, WebGLRenderer,
} from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { createOrganismModel } from '../../shared/organism'

const { wetness = 0.75, viscosity = 0.6, pressure = 0, motionOff = false, exportable = false } = defineProps<{
  wetness?: number, viscosity?: number, pressure?: number, motionOff?: boolean, exportable?: boolean
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
const exportError = ref('')
let cleanup: (() => void) | undefined
let refresh: (() => void) | undefined
let download: (() => Promise<void>) | undefined
let alive = true

function move(event: PointerEvent) {
  const bounds = host.value?.getBoundingClientRect()
  if (!bounds) return
  pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2)
  refresh?.()
}
function release() { pressed.value = false }
useEventListener('pointerup', release)
useEventListener('blur', release)
useEventListener(canvas, 'webglcontextlost', (event) => {
  event.preventDefault()
  cleanup?.()
  cleanup = undefined
  refresh = undefined
  status.value = { _tag: 'Fallback', reason: 'context' }
})
watch([() => wetness, () => viscosity, () => pressure, () => motionOff, pressed, animate, width, height], () => refresh?.())
onScopeDispose(() => { alive = false; cleanup?.() })

onMounted(async () => {
  if (!canvas.value) return
  const element = canvas.value
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  const scene = new Scene()
  const camera = new PerspectiveCamera(42, 1, 0.1, 20)
  camera.position.set(0, -0.07, 4.7)
  scene.add(new AmbientLight('#E8D4A6', 2))
  const light = new DirectionalLight('#E8D4A6', 3)
  light.position.set(-2, 3, 4)
  scene.add(light)
  const model = createOrganismModel(texture)
  scene.add(model.root)
  let currentPressure = 0
  let elapsed = 0
  let previousTime = 0
  let renderWidth = 0
  let renderHeight = 0
  let loopActive = false
  function render(delta: number) {
    const target = pressed.value ? 1 : pressure
    currentPressure = animate.value ? currentPressure + (target - currentPressure) * Math.min(1, delta * (14 - viscosity * 10)) : target
    model.update({ time: elapsed, pressure: currentPressure, wetness, pointer })
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
    texture.dispose()
    renderer.dispose()
    download = undefined
  }
  download = async () => {
    // GLB stores the rest mesh and PBR texture. Runtime shader deformation stays in the layer source.
    const rest = model.root.clone(true)
    const material = new MeshStandardMaterial({ map: texture, roughness: 0.35, metalness: 0.1 })
    rest.traverse(object => { if (object instanceof Mesh) object.material = material })
    const data = await new GLTFExporter().parseAsync(rest, { binary: true }).finally(() => material.dispose())
    if (!(data instanceof ArrayBuffer)) throw new Error('GLB export did not return a binary model.')
    const url = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'brundlefly-aperture.glb'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  status.value = { _tag: 'Ready' }
  refresh()
})
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
    <div ref="host" class="brand-organism" :data-renderer="status._tag">
      <img v-if="status._tag !== 'Ready'" class="brand-organism-fallback" :src="'/brand/kit/aperture.png'" alt="" width="1254" height="1254">
      <canvas ref="canvas" :style="{ opacity: status._tag === 'Ready' ? 1 : 0 }" aria-hidden="true" />
      <button v-if="status._tag === 'Ready'" class="brand-organism-control" type="button" aria-label="Press to deform"
        @pointermove="move" @pointerdown="pressed = true" @pointerleave="release" @pointercancel="release"
        @keydown.space.prevent="pressed = true" @keyup.space.prevent="release" @keydown.enter.prevent="pressed = true" @keyup.enter.prevent="release" @blur="release" />
      <span class="brand-organism-status" role="status">{{ status._tag === 'Ready' ? '3D material' : status._tag === 'Loading' ? '3D loading.' : status.reason === 'texture' ? 'Static material. The texture could not load.' : 'Static material. WebGL is unavailable.' }}</span>
    </div>
    <UButton v-if="exportable && status._tag === 'Ready'" variant="outline" @click="exportModel">Download GLB</UButton>
    <p v-if="exportError" role="alert">{{ exportError }}</p>
  </div>
</template>
