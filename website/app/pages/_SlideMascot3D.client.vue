<script setup lang="ts">
import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useElementSize, usePreferredReducedMotion } from '@vueuse/core'
import {
  ACESFilmicToneMapping, AmbientLight, ClampToEdgeWrapping, DirectionalLight, Group,
  LinearFilter, MirroredRepeatWrapping, PerspectiveCamera, Scene, SRGBColorSpace, TextureLoader, Vector2, WebGLRenderer,
} from 'three'
import { loadMeshMascot, reliefStandingHeight } from '@brundlefly/brand/shared/mascot-mesh'

// Lightweight 3D turntable for Brundlefly on Slide 2 of `/projector?show`.
// Falls back to the static character render if WebGL2 or the GLB mesh is unavailable.
const host = shallowRef<HTMLElement | null>(null)
const canvas = shallowRef<HTMLCanvasElement | null>(null)
const fallback = ref(false)
const { width, height } = useElementSize(host)
const reducedMotion = usePreferredReducedMotion()
let alive = true
let cleanup: (() => void) | undefined
let resize: (() => void) | undefined

watch([width, height], () => resize?.())
onScopeDispose(() => { alive = false; cleanup?.() })

watch(canvas, async (element) => {
  if (!element) return
  const context = element.getContext('webgl2', { alpha: true, antialias: true })
  if (!context) { fallback.value = true; return }

  const [meshResult, faceTexture, projectionTexture] = await Promise.all([
    loadMeshMascot(),
    new TextureLoader().loadAsync('/brand/kit/lair/face-skin-diffuse.png').catch(() => undefined),
    new TextureLoader().loadAsync('/brand/kit/lair/head-projection.png').catch(() => undefined),
  ])
  if (!alive || meshResult._tag === 'Err') {
    if (meshResult._tag === 'Ok') meshResult.mascot.dispose()
    faceTexture?.dispose()
    projectionTexture?.dispose()
    if (alive) fallback.value = true
    return
  }

  const { mascot } = meshResult
  if (faceTexture && projectionTexture) {
    faceTexture.colorSpace = SRGBColorSpace
    faceTexture.wrapS = faceTexture.wrapT = MirroredRepeatWrapping
    projectionTexture.colorSpace = SRGBColorSpace
    projectionTexture.wrapS = projectionTexture.wrapT = ClampToEdgeWrapping
    projectionTexture.magFilter = LinearFilter
    const image = projectionTexture.image as HTMLImageElement
    const raster = document.createElement('canvas')
    raster.width = 180
    raster.height = Math.round(180 * image.height / image.width)
    const painter = raster.getContext('2d')!
    painter.drawImage(image, 0, 0, raster.width, raster.height)
    mascot.dressEyes({ projection: { texture: projectionTexture, raster: painter.getImageData(0, 0, raster.width, raster.height) }, skin: faceTexture })
  }

  const renderer = new WebGLRenderer({ canvas: element, context, alpha: true, antialias: true })
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new Scene()
  const camera = new PerspectiveCamera(35, 1, 0.1, 20)
  camera.position.set(0, 0.08, 4.15)
  camera.lookAt(0, 0.04, 0)

  scene.add(new AmbientLight('#fff5de', 2.0))
  const key = new DirectionalLight('#ffe8c4', 2.6)
  key.position.set(-2.2, 3.2, 4.2)
  scene.add(key)
  const rim = new DirectionalLight('#b8e6c8', 1.5)
  rim.position.set(3.2, 2.0, -3.2)
  scene.add(rim)

  const turntable = new Group()
  mascot.root.position.y = -reliefStandingHeight / 2
  turntable.add(mascot.root)
  scene.add(turntable)

  const syncSize = () => {
    const w = Math.max(1, Math.round(width.value || element.clientWidth || 260))
    const h = Math.max(1, Math.round(height.value || element.clientHeight || 260))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize = syncSize
  syncSize()

  let raf = 0
  let previous = performance.now()
  let elapsed = 0
  const center = new Vector2()
  const tick = (now: number) => {
    if (!alive) return
    const delta = Math.min(0.05, (now - previous) / 1000)
    previous = now
    elapsed += delta
    if (reducedMotion.value !== 'reduce') turntable.rotation.y = (turntable.rotation.y + delta * 0.85) % (Math.PI * 2)
    else turntable.rotation.y = 0.35
    if (mascot.pose) mascot.pose({ time: elapsed, pressure: 0, pointer: center, transform: 'squeeze', speaking: 0 }, undefined, 0)
    else mascot.update(elapsed)
    renderer.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  cleanup = () => {
    cancelAnimationFrame(raf)
    resize = undefined
    mascot.dispose()
    faceTexture?.dispose()
    projectionTexture?.dispose()
    renderer.dispose()
  }
})
</script>

<template>
  <div ref="host" class="mascot-3d" role="img" aria-label="Rotating 3D Brundlefly model">
    <img v-if="fallback" src="/brand/character.png" alt="Brundlefly">
    <canvas v-else ref="canvas" />
  </div>
</template>

<style scoped>
.mascot-3d { width: 100%; height: 100%; display: block; }
.mascot-3d canvas, .mascot-3d img { display: block; width: 100%; height: 100%; object-fit: contain; }
</style>
