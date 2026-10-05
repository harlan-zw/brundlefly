<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useDocumentVisibility, useElementSize, useEventListener, usePreferredReducedMotion } from '@vueuse/core'
import { useRoute } from '#app'
import {
  ACESFilmicToneMapping, ClampToEdgeWrapping, Color, FogExp2, Group, LinearFilter, Mesh, MirroredRepeatWrapping, NearestFilter,
  NoColorSpace, PerspectiveCamera, PlaneGeometry, Raycaster, RepeatWrapping, Scene, ShaderMaterial, SRGBColorSpace, TextureLoader,
  Vector2, Vector3, WebGLRenderer,
} from 'three'
import { createWorld } from '@brundlefly/brand/shared/world'
import { createMascotModel } from '@brundlefly/brand/shared/mascot'
import { createWetEnvironment } from '@brundlefly/brand/shared/wet-environment'
import { defaultSceneSettings } from '@brundlefly/brand/shared/scene-settings'
import { sceneLayout } from '@brundlefly/brand/shared/scene-layout'
import { defaultCameraView, moveCameraView, resolveCameraView, resolveResponsiveCameraFraming, rotateCameraView } from '@brundlefly/brand/shared/camera-view'
import type { CameraKey } from '@brundlefly/brand/shared/camera-view'
import type { SceneAudioMix } from '#shared/scene-audio'
import type { ConversationMood } from '#shared/conversation'
import SceneControls from './_SceneControls.vue'
import SceneLoading from './_SceneLoading.vue'

const { paused = false, speaking = 0, mood = 'neutral', thinking = false, beat = '', reaction = 0 } = defineProps<{ paused?: boolean, speaking?: number, mood?: ConversationMood, thinking?: boolean, beat?: string, reaction?: number }>()
const spriteMascot = useRoute().query.mascot === 'sprite'
const emit = defineEmits<{ talk: [], mix: [value: SceneAudioMix] }>()
type Status = { _tag: 'Loading' } | { _tag: 'Ready' } | { _tag: 'Fallback', reason: 'context' | 'art' }
const status = ref<Status>({ _tag: 'Loading' })
const host = shallowRef<HTMLElement | null>(null)
const canvas = shallowRef<HTMLCanvasElement | null>(null)
const interaction = shallowRef<HTMLButtonElement | null>(null)
const { width, height } = useElementSize(host)
const reduced = usePreferredReducedMotion()
const visibility = useDocumentVisibility()
const settings = ref({ ...defaultSceneSettings })
watch(() => [settings.value.masterVolume, settings.value.ambienceVolume, settings.value.voiceVolume] as const, ([master, ambience, voice]) => {
  emit('mix', { master, ambience, voice })
}, { immediate: true })
const environmentMotion = computed(() => !settings.value.motionOff && reduced.value !== 'reduce' && visibility.value === 'visible')
const animate = computed(() => !paused && environmentMotion.value)
const hovered = ref(false)
const pointer = new Vector2()
let alive = true
let cleanup: (() => void) | undefined
let refresh: (() => void) | undefined
let hit: ((pointer: Vector2) => boolean) | undefined
let bounds = { left: 0, right: 0, top: 0, bottom: 0 }
let cameraView = { ...defaultCameraView }
const cameraKeys = new Set<CameraKey>()
type Gesture = { _tag: 'Idle' } | { _tag: 'Armed' | 'Dragging'; id: number; startX: number; startY: number; x: number; y: number }
let gesture: Gesture = { _tag: 'Idle' }
let suppressClick = false
const isCameraKey = (key: string): key is CameraKey => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(key)
const inputOwnsKeys = (target: EventTarget | null) => target instanceof HTMLElement
  && Boolean(target.isContentEditable || target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), .scene-controls, dialog'))

function beginView(event: PointerEvent) {
  if (paused || status.value._tag !== 'Ready' || event.button !== 0) return
  suppressClick = false
  gesture = { _tag: 'Armed', id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY }
  interaction.value?.setPointerCapture(event.pointerId)
}
function endView(event?: PointerEvent) {
  if (gesture._tag === 'Idle' || (event && event.pointerId !== gesture.id)) return
  const id = gesture.id
  suppressClick = gesture._tag === 'Dragging'
  gesture = { _tag: 'Idle' }
  if (interaction.value?.hasPointerCapture(id)) interaction.value.releasePointerCapture(id)
}

function move(event: PointerEvent) {
  const rect = host.value?.getBoundingClientRect()
  if (!rect || paused) return
  if (gesture._tag !== 'Idle' && gesture.id === event.pointerId) {
    const dragged = gesture._tag === 'Dragging' || Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 6
    if (dragged) {
      cameraView = rotateCameraView(cameraView, event.clientX - gesture.x, event.clientY - gesture.y)
      gesture = { ...gesture, _tag: 'Dragging', x: event.clientX, y: event.clientY }
      hovered.value = false
      refresh?.()
      return
    }
  }
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  hovered.value = x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom
}
function select(event: MouseEvent) {
  if (suppressClick) { suppressClick = false; if (event.detail !== 0) return }
  if (paused) return
  const rect = host.value?.getBoundingClientRect()
  if (!rect) return
  if (event.detail === 0) { emit('talk'); return }
  const position = new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2)
  if (status.value._tag !== 'Ready' || hit?.(position)) emit('talk')
}
useEventListener('keydown', (event: KeyboardEvent) => {
  if (paused || visibility.value !== 'visible' || status.value._tag !== 'Ready' || event.ctrlKey || event.metaKey || event.altKey || inputOwnsKeys(event.target) || !isCameraKey(event.code)) return
  event.preventDefault()
  cameraKeys.add(event.code)
  refresh?.()
})
useEventListener('keyup', (event: KeyboardEvent) => {
  if (!isCameraKey(event.code)) return
  cameraKeys.delete(event.code)
  refresh?.()
})
useEventListener('blur', () => { cameraKeys.clear(); endView(); refresh?.() })
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
watch(() => [speaking, mood, thinking, reaction], () => refresh?.())
watch([() => paused, visibility], () => {
  if (paused || visibility.value !== 'visible') { cameraKeys.clear(); endView(); hovered.value = false }
  refresh?.()
})
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
    new TextureLoader().loadAsync('/brand/kit/lair/face-skin-diffuse.png'),
    new TextureLoader().loadAsync('/brand/kit/lair/head-projection.png'),
    new TextureLoader().loadAsync('/brand/kit/lair/body-projection.png'),
    new TextureLoader().loadAsync('/brand/kit/lair/room-diffuse.webp'),
    new TextureLoader().loadAsync('/brand/kit/lair/room-height.webp'),
  ])
  const [surfaceResult, mascotResult, gooResult, chitinResult, floorResult, eggResult, faceResult, projectionResult, bodyProjectionResult, roomResult, roomHeightResult] = results
  if (surfaceResult.status === 'rejected' || mascotResult.status === 'rejected' || gooResult.status === 'rejected'
    || chitinResult.status === 'rejected' || floorResult.status === 'rejected' || eggResult.status === 'rejected' || faceResult.status === 'rejected' || projectionResult.status === 'rejected' || bodyProjectionResult.status === 'rejected' || roomResult.status === 'rejected' || roomHeightResult.status === 'rejected') {
    for (const result of results) {
      if (result.status === 'fulfilled') result.value.dispose()
      else console.error('Brundlefly world artwork failed to load.', result.reason)
    }
    status.value = { _tag: 'Fallback', reason: 'art' }
    return
  }
  const [texture, mascotTexture, gooTexture, chitinTexture, floorTexture, eggTexture, faceTexture, projectionTexture, bodyProjectionTexture, roomTexture, roomHeightTexture] = [
    surfaceResult.value, mascotResult.value, gooResult.value, chitinResult.value, floorResult.value, eggResult.value, faceResult.value, projectionResult.value, bodyProjectionResult.value, roomResult.value, roomHeightResult.value,
  ]
  const loadedTextures = [texture, mascotTexture, gooTexture, chitinTexture, floorTexture, eggTexture, faceTexture, projectionTexture, bodyProjectionTexture, roomTexture, roomHeightTexture]
  if (!alive) { loadedTextures.forEach(value => value.dispose()); return }
  loadedTextures.forEach(value => { value.colorSpace = SRGBColorSpace })
  roomHeightTexture.colorSpace = NoColorSpace
  for (const tiled of [texture, gooTexture, chitinTexture, floorTexture, eggTexture, faceTexture]) {
    tiled.wrapS = tiled.wrapT = MirroredRepeatWrapping
  }
  chitinTexture.repeat.set(2, 2)
  floorTexture.repeat.set(5, 8)
  roomTexture.wrapS = roomTexture.wrapT = RepeatWrapping
  roomHeightTexture.wrapS = roomHeightTexture.wrapT = RepeatWrapping
  roomTexture.magFilter = LinearFilter
  roomHeightTexture.magFilter = LinearFilter
  mascotTexture.wrapS = mascotTexture.wrapT = ClampToEdgeWrapping
  projectionTexture.wrapS = projectionTexture.wrapT = ClampToEdgeWrapping
  projectionTexture.magFilter = LinearFilter
  bodyProjectionTexture.wrapS = bodyProjectionTexture.wrapT = ClampToEdgeWrapping
  bodyProjectionTexture.magFilter = LinearFilter
  texture.magFilter = mascotTexture.magFilter = NearestFilter
  const image = mascotTexture.image as HTMLImageElement
  const raster = document.createElement('canvas')
  raster.width = 180
  raster.height = Math.round(raster.width * image.height / image.width)
  const painter = raster.getContext('2d')!
  painter.drawImage(image, 0, 0, raster.width, raster.height)
  const projectionImage = projectionTexture.image as HTMLImageElement
  const projectionRaster = document.createElement('canvas')
  projectionRaster.width = 180
  projectionRaster.height = Math.round(180 * projectionImage.height / projectionImage.width)
  const projectionPainter = projectionRaster.getContext('2d')!
  projectionPainter.drawImage(projectionImage, 0, 0, projectionRaster.width, projectionRaster.height)
  const bodyProjectionImage = bodyProjectionTexture.image as HTMLImageElement
  const bodyProjectionRaster = document.createElement('canvas')
  bodyProjectionRaster.width = 180
  bodyProjectionRaster.height = Math.round(180 * bodyProjectionImage.height / bodyProjectionImage.width)
  const bodyProjectionPainter = bodyProjectionRaster.getContext('2d')!
  bodyProjectionPainter.drawImage(bodyProjectionImage, 0, 0, bodyProjectionRaster.width, bodyProjectionRaster.height)
  const mascot = createMascotModel(mascotTexture, painter.getImageData(0, 0, raster.width, raster.height), faceTexture,
    spriteMascot ? undefined : { texture: projectionTexture, raster: projectionPainter.getImageData(0, 0, projectionRaster.width, projectionRaster.height) },
    spriteMascot ? undefined : { texture: bodyProjectionTexture, raster: bodyProjectionPainter.getImageData(0, 0, bodyProjectionRaster.width, bodyProjectionRaster.height) })
  const roomHeightImage = roomHeightTexture.image as HTMLImageElement
  const roomHeightRaster = document.createElement('canvas')
  roomHeightRaster.width = roomHeightImage.width
  roomHeightRaster.height = roomHeightImage.height
  const roomHeightPainter = roomHeightRaster.getContext('2d')!
  roomHeightPainter.drawImage(roomHeightImage, 0, 0)
  const world = createWorld(texture, gooTexture, { chitin: chitinTexture, floor: floorTexture, egg: eggTexture, room: roomTexture,
    roomHeight: { texture: roomHeightTexture, raster: roomHeightPainter.getImageData(0, 0, roomHeightRaster.width, roomHeightRaster.height) } })
  const renderer = new WebGLRenderer({ canvas: element, context, antialias: true })
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  const scene = new Scene()
  scene.background = new Color('#080B08')
  const environment = createWetEnvironment(renderer)
  scene.environment = environment.texture
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
  figure.position.set(sceneLayout.mascot[0], floorY, sceneLayout.mascot[1])
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
  hit = position => { raycaster.setFromCamera(position, camera); return raycaster.intersectObject(mascot.root, true).length > 0 }
  const route = sceneLayout.walk.map(([x, z]) => new Vector3(x, floorY, z))
  let destination = 0
  let elapsed = 0
  let faceElapsed = 0
  let lastReaction = reaction
  let reactionStarted = 0
  const reactionWing = mascot.root.getObjectByName('left-wing')
  let phase = 0
  let speed = 0
  let lastTime = 0
  let looping = false
  let renderWidth = 0
  let renderHeight = 0
  let focusProgress = paused ? 1 : 0
  const basePosition = new Vector3()
  const baseTarget = new Vector3()
  const focusPosition = new Vector3()
  const focusTarget = new Vector3()
  const needsFrames = () => visibility.value === 'visible' && (animate.value || (!paused && cameraKeys.size > 0)
    || (paused && !settings.value.motionOff && reduced.value !== 'reduce')
    || Math.abs((paused ? 1 : 0) - focusProgress) > 0.001)
  function render(delta: number) {
    renderer.toneMappingExposure = settings.value.exposure
    scene.environmentIntensity = settings.value.reflections
    const aspect = renderWidth / renderHeight
    const portrait = aspect < 0.8
    const { framing, fieldOfView, fogScale } = resolveResponsiveCameraFraming(sceneLayout.camera.desktop, sceneLayout.camera.portrait, aspect)
    fog.density = settings.value.fog * fogScale
    if (camera.fov !== fieldOfView) { camera.fov = fieldOfView; camera.updateProjectionMatrix() }
    if (!paused) cameraView = moveCameraView(cameraView, cameraKeys, delta)
    const view = resolveCameraView(cameraView, framing, sceneLayout.camera.target, settings.value.zoom)
    basePosition.set(...view.position)
    baseTarget.set(...view.target)
    const desiredFocus = paused ? 1 : 0
    focusProgress = reduced.value === 'reduce' ? desiredFocus
      : desiredFocus > focusProgress ? Math.min(1, focusProgress + delta / 0.65) : Math.max(0, focusProgress - delta / 0.65)
    const blend = focusProgress * focusProgress * (3 - 2 * focusProgress)
    focusTarget.copy(figure.localToWorld(new Vector3(0.23, 0.8, 0)))
    focusPosition.copy(focusTarget).add(new Vector3(0, 0.15, portrait ? 3.8 : 4.1))
    focusTarget.y -= portrait ? 0.55 : 0.35
    camera.position.copy(basePosition).lerp(focusPosition, blend)
    camera.lookAt(baseTarget.lerp(focusTarget, blend))
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
    }
    if (environmentMotion.value) elapsed += delta
    world.update({ time: elapsed, pressure: paused ? 0.25 : 0, settings: settings.value })
    const faceMotion = !settings.value.motionOff && reduced.value !== 'reduce'
    if (faceMotion) faceElapsed += delta
    if (lastReaction !== reaction) { lastReaction = reaction; reactionStarted = faceElapsed }
    mascot.update({ time: faceElapsed, pressure: 0, pointer, transform: 'squeeze', walking, walkPhase: phase,
      speaking: faceMotion ? speaking : 0,
      brow: thinking ? 0.12 + (faceMotion ? Math.sin(faceElapsed * 1.6) * 0.025 : 0)
        : mood === 'curious' ? 0.2 : mood === 'wary' ? 0.14 : mood === 'amused' ? 0.08 : 0,
      squint: thinking ? 0.06 : mood === 'wary' ? 0.14 : mood === 'amused' ? 0.1 : mood === 'soft' ? 0.04 : 0 })
    const reactionAge = faceElapsed - reactionStarted
    if (paused && faceMotion && beat === 'One wing twitches.' && reactionWing && reactionAge < 0.8) {
      reactionWing.rotation.y += Math.sin(reactionAge / 0.8 * Math.PI) * Math.exp(-reactionAge * 2) * 0.08
    }
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
      camera.updateProjectionMatrix()
    }
    if (looping !== needsFrames()) {
      looping = needsFrames()
      lastTime = 0
      renderer.setAnimationLoop(looping ? (time: number) => {
        const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60
        lastTime = time
        render(delta)
        if (!needsFrames()) { looping = false; lastTime = 0; renderer.setAnimationLoop(null) }
      } : null)
    }
    render(0)
  }
  cleanup = () => {
    cameraKeys.clear()
    endView()
    renderer.setAnimationLoop(null)
    world.dispose(); mascot.dispose(); loadedTextures.forEach(value => value.dispose())
    shadowGeometry.dispose(); shadowMaterial.dispose(); environment.dispose(); renderer.dispose()
  }
  status.value = { _tag: 'Ready' }
  refresh()
}, { flush: 'post', once: true })
</script>

<template>
  <div ref="host" class="world-scene" :data-renderer="status._tag" :aria-busy="status._tag === 'Loading'">
    <canvas ref="canvas" aria-hidden="true" />
    <div v-if="status._tag === 'Ready'" class="world-vignette" aria-hidden="true" />
    <SceneLoading v-if="status._tag === 'Loading'" />
    <img v-if="status._tag === 'Fallback'" class="world-fallback" src="/brand/character.png" alt="" width="1199" height="1312">
    <button ref="interaction" class="world-interaction" :class="{ 'mascot-hover': hovered }" :disabled="status._tag === 'Loading'" aria-label="Talk to Brundlefly" @pointerdown="beginView" @pointermove="move" @pointerup="endView" @pointercancel="endView" @lostpointercapture="endView" @pointerleave="hovered = false" @click="select" />
    <p v-if="status._tag === 'Fallback'" class="world-status" role="status">{{ status.reason === 'context' ? 'Static scene. WebGL is unavailable.' : 'The scene could not load.' }}</p>
    <SceneControls v-model="settings" />
  </div>
</template>

<style scoped>
.world-scene { position: fixed; inset: 0; overflow: hidden; background: var(--color-night); }
canvas { display: block; width: 100%; height: 100%; }
/* Dark edges hold the eye on the opening and the mascot. */
.world-vignette { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse 72% 68% at 50% 52%, transparent 52%, rgb(8 11 8 / 0.55) 82%, rgb(8 11 8 / 0.88) 100%); }
.world-interaction { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; cursor: url('/brand/kit/lair/cursor-claw.png') 4 3, default; touch-action: none; }
.world-interaction.mascot-hover { cursor: url('/brand/kit/lair/cursor-claw.png') 4 3, pointer; }
.world-interaction:focus-visible { outline: 2px solid var(--color-cream); outline-offset: -8px; }
.world-fallback { position: absolute; inset: 10% 0; margin: auto; height: 80%; width: 80%; object-fit: contain; image-rendering: pixelated; }
.world-status { position: absolute; bottom: 1rem; left: 1rem; right: 1rem; text-align: center; font: 12px var(--font-mono); color: var(--color-wing); }
</style>
