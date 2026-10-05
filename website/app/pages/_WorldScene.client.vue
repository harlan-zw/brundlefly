<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useDocumentVisibility, useElementSize, useEventListener, usePreferredReducedMotion } from '@vueuse/core'
import {
  ACESFilmicToneMapping, ClampToEdgeWrapping, Color, FogExp2, Group, Mesh, MirroredRepeatWrapping, NearestFilter,
  PerspectiveCamera, PlaneGeometry, Raycaster, Scene, ShaderMaterial, SRGBColorSpace, TextureLoader,
  Vector2, Vector3, WebGLRenderer,
} from 'three'
import { createWorld } from '@brundlefly/brand/shared/world'
import { createMascotModel } from '@brundlefly/brand/shared/mascot'
import { defaultSceneSettings } from '@brundlefly/brand/shared/scene-settings'
import SceneControls from './_SceneControls.vue'

const { paused = false } = defineProps<{ paused?: boolean }>()
const emit = defineEmits<{ talk: [] }>()
type Status = { _tag: 'Loading' } | { _tag: 'Ready' } | { _tag: 'Fallback', reason: 'context' | 'art' }
const status = ref<Status>({ _tag: 'Loading' })
const host = shallowRef<HTMLElement | null>(null)
const canvas = shallowRef<HTMLCanvasElement | null>(null)
const { width, height } = useElementSize(host)
const reduced = usePreferredReducedMotion()
const visibility = useDocumentVisibility()
const settings = ref({ ...defaultSceneSettings })
const animate = computed(() => !paused && !settings.value.motionOff && reduced.value !== 'reduce' && visibility.value === 'visible')
const hovered = ref(false)
const pointer = new Vector2()
let alive = true
let cleanup: (() => void) | undefined
let refresh: (() => void) | undefined
let hit: ((pointer: Vector2) => boolean) | undefined
let bounds = { left: 0, right: 0, top: 0, bottom: 0 }

function move(event: PointerEvent) {
  const rect = host.value?.getBoundingClientRect()
  if (!rect || paused) return
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  hovered.value = x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom
}
function select(event: MouseEvent) {
  const rect = host.value?.getBoundingClientRect()
  if (!rect) return
  if (event.detail === 0) { emit('talk'); return }
  const position = new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2)
  if (status.value._tag !== 'Ready' || hit?.(position)) emit('talk')
}
useEventListener(canvas, 'webglcontextlost', (event) => {
  event.preventDefault()
  alive = false
  cleanup?.()
  refresh = undefined
  hit = undefined
  status.value = { _tag: 'Fallback', reason: 'context' }
})
watch([animate, width, height], () => refresh?.())
watch(settings, () => refresh?.(), { deep: true })
onScopeDispose(() => { alive = false; cleanup?.() })

watch(canvas, async (element) => {
  if (!element) return
  const context = element.getContext('webgl2', { alpha: false, antialias: true })
  if (!context) { status.value = { _tag: 'Fallback', reason: 'context' }; return }
  const results = await Promise.allSettled([
    new TextureLoader().loadAsync('/brand/kit/modular/flesh-diffuse.png'),
    new TextureLoader().loadAsync('/brand/character.png'),
    new TextureLoader().loadAsync('/brand/kit/lair/goo-diffuse.png'),
    new TextureLoader().loadAsync('/brand/kit/lair/chitin-diffuse.png'),
    new TextureLoader().loadAsync('/brand/kit/lair/floor-diffuse.png'),
    new TextureLoader().loadAsync('/brand/kit/lair/egg-diffuse.png'),
  ])
  const [surfaceResult, mascotResult, gooResult, chitinResult, floorResult, eggResult] = results
  if (surfaceResult.status === 'rejected' || mascotResult.status === 'rejected' || gooResult.status === 'rejected'
    || chitinResult.status === 'rejected' || floorResult.status === 'rejected' || eggResult.status === 'rejected') {
    for (const result of results) {
      if (result.status === 'fulfilled') result.value.dispose()
      else console.error('Brundlefly world artwork failed to load.', result.reason)
    }
    status.value = { _tag: 'Fallback', reason: 'art' }
    return
  }
  const [texture, mascotTexture, gooTexture, chitinTexture, floorTexture, eggTexture] = [
    surfaceResult.value, mascotResult.value, gooResult.value, chitinResult.value, floorResult.value, eggResult.value,
  ]
  const loadedTextures = [texture, mascotTexture, gooTexture, chitinTexture, floorTexture, eggTexture]
  if (!alive) { loadedTextures.forEach(value => value.dispose()); return }
  loadedTextures.forEach(value => { value.colorSpace = SRGBColorSpace })
  for (const tiled of [texture, gooTexture, chitinTexture, floorTexture, eggTexture]) {
    tiled.wrapS = tiled.wrapT = MirroredRepeatWrapping
  }
  chitinTexture.repeat.set(2, 2)
  floorTexture.repeat.set(5, 8)
  mascotTexture.wrapS = mascotTexture.wrapT = ClampToEdgeWrapping
  texture.magFilter = mascotTexture.magFilter = NearestFilter
  const image = mascotTexture.image as HTMLImageElement
  const raster = document.createElement('canvas')
  raster.width = 180
  raster.height = Math.round(raster.width * image.height / image.width)
  const painter = raster.getContext('2d')!
  painter.drawImage(image, 0, 0, raster.width, raster.height)
  const mascot = createMascotModel(mascotTexture, painter.getImageData(0, 0, raster.width, raster.height))
  const world = createWorld(texture, gooTexture, { chitin: chitinTexture, floor: floorTexture, egg: eggTexture })
  const renderer = new WebGLRenderer({ canvas: element, context, antialias: true })
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  const scene = new Scene()
  scene.background = new Color('#080B08')
  const fog = new FogExp2('#080B08', 0.028)
  scene.fog = fog
  scene.add(world.root)
  const figure = new Group()
  figure.scale.setScalar(1.25)
  figure.add(mascot.root)
  const positions = mascot.mesh.geometry.getAttribute('position')
  const indices = mascot.mesh.geometry.index!
  let bottom = 0
  for (let index = 0; index < indices.count; index++) bottom = Math.min(bottom, positions.getY(indices.getX(index)))
  const floorY = -2.2 - bottom * 1.25
  figure.position.set(0.35, floorY, -1.45)
  scene.add(figure)
  const shadowGeometry = new PlaneGeometry(2.5, 1.8)
  const shadowMaterial = new ShaderMaterial({ transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv;void main(){float r=length((vUv-.5)*2.0);gl_FragColor=vec4(0.0,0.0,0.0,max(0.0,1.0-r*r)*.55);}',
  })
  const shadow = new Mesh(shadowGeometry, shadowMaterial)
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -2.19
  scene.add(shadow)
  const camera = new PerspectiveCamera(44, 1, 0.1, 50)
  const raycaster = new Raycaster()
  hit = position => { raycaster.setFromCamera(position, camera); return raycaster.intersectObject(mascot.mesh, false).length > 0 }
  const route = [new Vector3(1.45, floorY, 0.6), new Vector3(-1.4, floorY, 0.25), new Vector3(-0.5, floorY, -1.25), new Vector3(0.8, floorY, -0.85)]
  let destination = 0
  let elapsed = 0
  let phase = 0
  let speed = 0
  let lastTime = 0
  let looping = false
  let renderWidth = 0
  let renderHeight = 0
  function render(delta: number) {
    renderer.toneMappingExposure = settings.value.exposure
    fog.density = settings.value.fog
    camera.position.z = (renderWidth / renderHeight < 0.8 ? 14.5 : 10) / settings.value.zoom
    camera.lookAt(0, -0.45, -1.3)
    camera.updateMatrixWorld()
    let walking = false
    if (animate.value) {
      const target = hovered.value ? 0 : settings.value.walkSpeed
      speed += (target - speed) * Math.min(1, delta * 6)
      const direction = route[destination]!.clone().sub(figure.position)
      direction.y = 0
      const remaining = direction.length()
      const step = Math.min(remaining, speed * delta)
      if (remaining < 0.04) destination = (destination + 1) % route.length
      else if (step > 0.001) {
        figure.position.addScaledVector(direction.normalize(), step)
        figure.rotation.y += (direction.x * 0.2 - figure.rotation.y) * Math.min(1, delta * 3)
        phase += step * 10
        walking = true
      }
      elapsed += delta
    }
    world.update({ time: elapsed, pressure: paused ? 0.25 : 0, settings: settings.value })
    mascot.update({ time: elapsed, pressure: 0, pointer, transform: 'squeeze', walking, walkPhase: phase })
    shadow.position.x = figure.position.x
    shadow.position.z = figure.position.z
    const corners = [new Vector3(-1.1, -1.25, 0), new Vector3(1.1, 1.3, 0)].map(value => figure.localToWorld(value).project(camera))
    bounds = { left: (corners[0]!.x + 1) * renderWidth / 2, right: (corners[1]!.x + 1) * renderWidth / 2,
      top: (1 - corners[1]!.y) * renderHeight / 2, bottom: (1 - corners[0]!.y) * renderHeight / 2 }
    renderer.render(scene, camera)
  }
  refresh = () => {
    const w = Math.max(1, width.value)
    const h = Math.max(1, height.value)
    if (w !== renderWidth || h !== renderHeight) {
      renderWidth = w; renderHeight = h
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.position.set(0, 1.25, w / h < 0.8 ? 14.5 : 10)
      camera.lookAt(0, -0.45, -1.3)
      camera.updateProjectionMatrix()
    }
    if (looping !== animate.value) {
      looping = animate.value
      lastTime = 0
      renderer.setAnimationLoop(looping ? (time: number) => {
        const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60
        lastTime = time
        render(delta)
      } : null)
    }
    render(0)
  }
  cleanup = () => {
    renderer.setAnimationLoop(null)
    world.dispose(); mascot.dispose(); loadedTextures.forEach(value => value.dispose())
    shadowGeometry.dispose(); shadowMaterial.dispose(); renderer.dispose()
  }
  status.value = { _tag: 'Ready' }
  refresh()
}, { flush: 'post', once: true })
</script>

<template>
  <div ref="host" class="world-scene" :data-renderer="status._tag">
    <canvas ref="canvas" aria-hidden="true" />
    <img v-if="status._tag !== 'Ready'" class="world-fallback" src="/brand/character.png" alt="" width="1199" height="1312">
    <button class="world-interaction" :class="{ 'mascot-hover': hovered }" aria-label="Talk to Brundlefly" @pointermove="move" @pointerleave="hovered = false" @click="select" />
    <p v-if="status._tag === 'Fallback'" class="world-status" role="status">{{ status.reason === 'context' ? 'Static scene. WebGL is unavailable.' : 'The scene could not load.' }}</p>
    <SceneControls v-model="settings" />
  </div>
</template>

<style scoped>
.world-scene { position: fixed; inset: 0; overflow: hidden; background: var(--color-night); }
canvas { display: block; width: 100%; height: 100%; }
.world-interaction { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; cursor: default; }
.world-interaction.mascot-hover { cursor: pointer; }
.world-interaction:focus-visible { outline: 2px solid var(--color-cream); outline-offset: -8px; }
.world-fallback { position: absolute; inset: 10% 0; margin: auto; height: 80%; width: 80%; object-fit: contain; image-rendering: pixelated; }
.world-status { position: absolute; bottom: 1rem; left: 1rem; right: 1rem; text-align: center; font: 12px var(--font-mono); color: var(--color-wing); }
</style>
