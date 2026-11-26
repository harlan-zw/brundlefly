<script setup lang="ts">
import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useElementSize, usePreferredReducedMotion } from '@vueuse/core'
import {
  ACESFilmicToneMapping, AmbientLight, CatmullRomCurve3, DirectionalLight, Group,
  Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, SphereGeometry, TubeGeometry, Vector3, WebGLRenderer,
} from 'three'

// Lightweight 3D rotating question mark for the `=` result on Slide 5 (Experiment 2), matching Slide 2's 3D Brundlefly turntable.
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

watch(canvas, (element) => {
  if (!element) return
  const context = element.getContext('webgl2', { alpha: true, antialias: true })
  if (!context) { fallback.value = true; return }

  const renderer = new WebGLRenderer({ canvas: element, context, alpha: true, antialias: true })
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new Scene()
  const camera = new PerspectiveCamera(35, 1, 0.1, 20)
  camera.position.set(0, 0.04, 4.65)
  camera.lookAt(0, 0, 0)

  scene.add(new AmbientLight('#fff5de', 1.6))
  const key = new DirectionalLight('#ffe8b8', 2.8)
  key.position.set(-2.5, 3.5, 4.5)
  scene.add(key)
  const rim = new DirectionalLight('#7ee787', 1.7)
  rim.position.set(3.2, 1.8, -3.2)
  scene.add(rim)
  const fill = new DirectionalLight('#ff6b6b', 1.1)
  fill.position.set(-3.0, -1.5, -2.0)
  scene.add(fill)

  const material = new MeshStandardMaterial({
    color: '#ffca58',
    emissive: '#3d2400',
    roughness: 0.28,
    metalness: 0.32,
  })

  const points = [
    new Vector3(-0.46, 0.42, 0),
    new Vector3(-0.43, 0.80, 0),
    new Vector3(0.0, 0.98, 0),
    new Vector3(0.47, 0.74, 0),
    new Vector3(0.42, 0.34, 0),
    new Vector3(0.07, 0.08, 0),
    new Vector3(0.0, -0.18, 0),
    new Vector3(0.0, -0.34, 0),
  ]
  const radius = 0.205
  const curve = new CatmullRomCurve3(points, false, 'centripetal', 0.45)
  const tubeGeo = new TubeGeometry(curve, 64, radius, 24, false)
  const capGeo = new SphereGeometry(radius, 20, 20)
  const dotGeo = new SphereGeometry(0.235, 24, 24)

  const mark = new Group()
  mark.add(new Mesh(tubeGeo, material))
  const startCap = new Mesh(capGeo, material)
  startCap.position.copy(points[0]!)
  mark.add(startCap)
  const endCap = new Mesh(capGeo, material)
  endCap.position.copy(points[points.length - 1]!)
  mark.add(endCap)
  const dot = new Mesh(dotGeo, material)
  dot.position.set(0, -0.82, 0)
  mark.add(dot)

  const turntable = new Group()
  turntable.add(mark)
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
  const tick = (now: number) => {
    if (!alive) return
    const delta = Math.min(0.05, (now - previous) / 1000)
    previous = now
    elapsed += delta
    if (reducedMotion.value !== 'reduce') {
      turntable.rotation.y = (turntable.rotation.y + delta * 1.15) % (Math.PI * 2)
      mark.position.y = Math.sin(elapsed * 2.2) * 0.06
    }
    else {
      turntable.rotation.y = 0.4
      mark.position.y = 0
    }
    renderer.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  cleanup = () => {
    cancelAnimationFrame(raf)
    resize = undefined
    tubeGeo.dispose()
    capGeo.dispose()
    dotGeo.dispose()
    material.dispose()
    renderer.dispose()
  }
})
</script>

<template>
  <div ref="host" class="question-3d" role="img" aria-label="Rotating 3D question mark">
    <span v-if="fallback" class="fallback-q" aria-hidden="true">?</span>
    <canvas v-else ref="canvas" />
  </div>
</template>

<style scoped>
.question-3d { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.question-3d canvas { display: block; width: 100%; height: 100%; }
.fallback-q { font: 800 clamp(6rem, 16vh, 10rem)/1 var(--font-mono, ui-monospace, monospace); color: #ffca58; }
</style>
