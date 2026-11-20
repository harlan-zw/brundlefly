<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useDeviceOrientation, useDocumentVisibility, useElementSize, useEventListener, useMediaQuery, usePreferredReducedMotion, useScreenOrientation } from '@vueuse/core'
import { useRoute } from '#app'
import {
  ACESFilmicToneMapping, ClampToEdgeWrapping, Color, FogExp2, Group, LinearFilter, Mesh, MirroredRepeatWrapping, NearestFilter,
  PerspectiveCamera, PlaneGeometry, PointLight, Quaternion, Raycaster, Scene, ShaderMaterial, SpotLight, SRGBColorSpace, TextureLoader,
  Vector2, Vector3, WebGLRenderer,
} from 'three'
import { createMascotModel } from '@brundlefly/brand/shared/mascot'
import { loadMeshMascot, meshShading } from '@brundlefly/brand/shared/mascot-mesh'
import { advanceStroll, advanceTurn, settleTurn, startStroll, startTurn, strollPose } from '@brundlefly/brand/shared/mascot-stroll'
import { createWetEnvironment } from '@brundlefly/brand/shared/wet-environment'
import { defaultSceneSettings } from '@brundlefly/brand/shared/scene-settings'
import { resolveSceneQuality } from '@brundlefly/brand/shared/scene-quality'
import { resolveMascotMode } from '@brundlefly/brand/shared/mascot-mode'
import type { MascotMode } from '@brundlefly/brand/shared/mascot-mode'
import { createSceneFinish } from '@brundlefly/brand/shared/scene-finish'
import type { SceneFinish } from '@brundlefly/brand/shared/scene-finish'
import { createFloorReflection } from '@brundlefly/brand/shared/floor-reflection'
import type { FloorReflection } from '@brundlefly/brand/shared/floor-reflection'
import { sceneSets } from '@brundlefly/brand/shared/scene-sets'
import type { BuiltSet, SceneSet, SetArt, SetName } from '@brundlefly/brand/shared/scene-set'
import { advanceTravel, startTravel, travelShade } from '@brundlefly/brand/shared/set-travel'
import type { Travel } from '@brundlefly/brand/shared/set-travel'
import { beatMannerism, pauseMannerism, poseMannerisms } from '@brundlefly/brand/shared/mannerism'
import type { EyeCue, MannerismLayer } from '@brundlefly/brand/shared/mannerism'
import { advanceConversationFocus, blendCameraShot, defaultCameraView, followTiltRest, moveCameraView, resolveCameraView, resolveConversationCloseUp, resolveConversationFocus, resolveDialogClearance, resolveResponsiveCameraFraming, resolveTiltView, rotateCameraView, tiltCameraView, tiltPose } from '@brundlefly/brand/shared/camera-view'
import type { CameraKey } from '@brundlefly/brand/shared/camera-view'
import type { SceneAudioMix } from '#shared/scene-audio'
import type { ConversationMood } from '#shared/conversation'
import SceneControls from './_SceneControls.vue'
import SceneLoading from './_SceneLoading.vue'

const { set = 'lair', paused = false, speaking = 0, mood = 'neutral', thinking = false, beat = '', reaction = 0 } = defineProps<{ set?: SetName, paused?: boolean, speaking?: number, mood?: ConversationMood, thinking?: boolean, beat?: string, reaction?: number }>()
// `set` is the place the page wants him in. The scene reports the set that stands, and travels when the two differ.
const shownSet = ref<SetName>(set)
const travelPhase = ref<Travel['_tag']>('Home')
// How dark a journey makes the picture, from 0 to 1.
const shade = ref(0)
const requestedMascot = useRoute().query.mascot
const mascotMode = resolveMascotMode(requestedMascot)
const spriteMascot = mascotMode === 'sprite'
// `?quality=low`, `medium`, or `high` overrides the tier that the device would get.
const requestedQuality = useRoute().query.quality
const shownQuality = ref<string>()
// The scene reports the mascot it shows. A mesh that cannot load shows the relief rig.
const shownMascot = ref<MascotMode>()
// How the visible mascot moves: the relief rig's pose code, the file's own clip, or a whole-body sway.
const mascotMotion = ref<'posed' | 'clip' | 'sway'>()
// `shown` names the set that stands after a journey. `stayed` means the other set's artwork did not load.
const emit = defineEmits<{ talk: [], mix: [value: SceneAudioMix], shown: [set: SetName, outcome: 'arrived' | 'stayed'], time: [seconds: number] }>()
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
// Phones look around by tilting. iOS grants motion access only during a tap, so the first tap asks once.
const orientation = useDeviceOrientation()
const { angle: screenAngle } = useScreenOrientation()
const touchScreen = useMediaQuery('(pointer: coarse)')
type OrientationAccess = { requestPermission?: () => Promise<'granted' | 'denied'> }
const orientationAccess = 'DeviceOrientationEvent' in window ? DeviceOrientationEvent as unknown as OrientationAccess : undefined
type TiltAccess = { _tag: 'Ask' | 'Pending' | 'Granted' | 'Denied' }
const tiltAccess = ref<TiltAccess>({ _tag: typeof orientationAccess?.requestPermission === 'function' ? 'Ask' : 'Granted' })
function askForTilt() {
  if (tiltAccess.value._tag !== 'Ask' || !touchScreen.value || !orientationAccess?.requestPermission) return
  tiltAccess.value = { _tag: 'Pending' }
  orientationAccess.requestPermission().then((answer) => {
    tiltAccess.value = { _tag: answer === 'granted' ? 'Granted' : 'Denied' }
    refresh?.()
  }, (cause: unknown) => {
    console.warn('Tilt look is unavailable.', cause)
    tiltAccess.value = { _tag: 'Denied' }
  })
}
const animate = computed(() => !paused && environmentMotion.value)
const hovered = ref(false)
const pointer = new Vector2()
let alive = true
let cleanup: (() => void) | undefined
let refresh: (() => void) | undefined
let hit: ((pointer: Vector2) => boolean) | undefined
let bounds = { left: 0, right: 0, top: 0, bottom: 0 }
/** The hover area in host pixels. The pointer cursor shows over it. */
const overMascot = (x: number, y: number) => x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom
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
  if (event?.type === 'pointerup') askForTilt()
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
  hovered.value = overMascot(x, y)
}
function select(event: MouseEvent) {
  askForTilt()
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
// A scene without WebGL shows one still picture for every set, so it changes place at once.
const changeStill = () => {
  if (status.value._tag !== 'Fallback' || shownSet.value === set) return
  shownSet.value = set
  emit('shown', set, 'arrived')
}
watch(status, changeStill)
watch(() => set, () => { changeStill(); refresh?.() })
watch([() => paused, visibility], () => {
  if (paused || visibility.value !== 'visible') { cameraKeys.clear(); endView(); hovered.value = false }
  refresh?.()
})
onScopeDispose(() => { alive = false; cleanup?.() })

watch(canvas, async (element) => {
  if (!element) return
  const context = element.getContext('webgl2', { alpha: false, antialias: true })
  if (!context) { status.value = { _tag: 'Fallback', reason: 'context' }; return }
  // A missing or broken model file is an error value. The relief rig then takes its place.
  const [results, setArt, meshResult] = await Promise.all([Promise.allSettled([
    new TextureLoader().loadAsync('/brand/character.png'),
    new TextureLoader().loadAsync('/brand/kit/lair/face-skin-diffuse.png'),
    new TextureLoader().loadAsync('/brand/kit/lair/head-projection.png'),
    new TextureLoader().loadAsync('/brand/kit/lair/body-projection.png'),
  ]), sceneSets[set].load(), mascotMode === 'mesh' ? loadMeshMascot(undefined, undefined, meshShading) : undefined])
  const [mascotResult, faceResult, projectionResult, bodyProjectionResult] = results
  if (mascotResult.status === 'rejected' || faceResult.status === 'rejected' || projectionResult.status === 'rejected' || bodyProjectionResult.status === 'rejected' || setArt._tag === 'Err') {
    for (const result of results) {
      if (result.status === 'fulfilled') result.value.dispose()
      else console.error('Brundlefly world artwork failed to load.', result.reason)
    }
    if (setArt._tag === 'Ok') setArt.release()
    else for (const reason of setArt.reasons) console.error('Brundlefly world artwork failed to load.', reason)
    if (meshResult?._tag === 'Ok') meshResult.mascot.dispose()
    status.value = { _tag: 'Fallback', reason: 'art' }
    return
  }
  const [mascotTexture, faceTexture, projectionTexture, bodyProjectionTexture] = [mascotResult.value, faceResult.value, projectionResult.value, bodyProjectionResult.value]
  const loadedTextures = [mascotTexture, faceTexture, projectionTexture, bodyProjectionTexture]
  if (!alive) { loadedTextures.forEach(value => value.dispose()); setArt.release(); if (meshResult?._tag === 'Ok') meshResult.mascot.dispose(); return }
  loadedTextures.forEach(value => { value.colorSpace = SRGBColorSpace })
  faceTexture.wrapS = faceTexture.wrapT = MirroredRepeatWrapping
  mascotTexture.wrapS = mascotTexture.wrapT = ClampToEdgeWrapping
  projectionTexture.wrapS = projectionTexture.wrapT = ClampToEdgeWrapping
  projectionTexture.magFilter = LinearFilter
  bodyProjectionTexture.wrapS = bodyProjectionTexture.wrapT = ClampToEdgeWrapping
  bodyProjectionTexture.magFilter = LinearFilter
  // The relief mascot is pixel artwork, so it keeps hard pixels.
  mascotTexture.magFilter = NearestFilter
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
  const headProjection = { texture: projectionTexture, raster: projectionPainter.getImageData(0, 0, projectionRaster.width, projectionRaster.height) }
  if (meshResult?._tag === 'Err') console.warn(`The Brundlefly mesh could not load. The relief rig takes its place. ${meshResult.reason}`)
  const mascot = meshResult?._tag === 'Ok' ? meshResult.mascot : { _tag: 'Relief' as const, ...createMascotModel(mascotTexture, painter.getImageData(0, 0, raster.width, raster.height), faceTexture,
    spriteMascot ? undefined : headProjection,
    spriteMascot ? undefined : { texture: bodyProjectionTexture, raster: bodyProjectionPainter.getImageData(0, 0, bodyProjectionRaster.width, bodyProjectionRaster.height) }) }
  shownMascot.value = mascot._tag === 'Mesh' ? 'mesh' : mascotMode === 'sprite' ? 'sprite' : 'relief'
  // The mesh gets the relief rig's eyes, from the same head artwork and face skin.
  if (mascot._tag === 'Mesh') mascot.dressEyes({ projection: headProjection, skin: faceTexture })
  const quality = resolveSceneQuality({ requested: requestedQuality, coarsePointer: touchScreen.value, cores: navigator.hardwareConcurrency,
    memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory, shortSide: Math.min(window.innerWidth, window.innerHeight) })
  shownQuality.value = quality.tier
  const renderer = new WebGLRenderer({ canvas: element, context, antialias: true })
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatio))
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  const scene = new Scene()
  const camera = new PerspectiveCamera(44, 1, 0.1, 50)
  let renderWidth = 0
  let renderHeight = 0
  let mirror: FloorReflection | undefined
  // The set that stands in the scene, with the effects it asked for. A journey strikes it and raises another.
  type Standing = { stage: SceneSet, world: BuiltSet, environment: ReturnType<typeof createWetEnvironment> | undefined,
    fog: { air: FogExp2, scale: number } | undefined, finish: SceneFinish | undefined, reflection: FloorReflection | undefined }
  const raise = (stage: SceneSet, art: Extract<SetArt, { _tag: 'Ok' }>): Standing => {
    const world = art.build({ quality, anisotropy })
    scene.background = new Color(stage.background)
    const environment = stage.effects.includes('WetEnvironment') ? createWetEnvironment(renderer) : undefined
    scene.environment = environment?.texture ?? null
    const fog = stage.fog._tag === 'Exponential' ? { air: new FogExp2(stage.fog.colour, 0.028), scale: stage.fog.scale } : undefined
    scene.fog = fog?.air ?? null
    scene.add(world.root)
    return { stage, world, environment, fog, finish: undefined, reflection: undefined }
  }
  // The effects come after him in the scene, so every set draws in the same order: the set, him, the mirror, his lights.
  const dress = (raised: Standing) => {
    // The finishing pass draws the scene through its own target. A tier or a set without it draws straight to the canvas.
    raised.finish = raised.stage.effects.includes('Finish') ? createSceneFinish(renderer, scene, camera, quality) : undefined
    // The wet floor mirrors the room at the highest tier only: it draws the room a second time.
    // The mirror draws through its own camera, and the renderer keeps a target for every camera that sees wet glass.
    // So one mirror serves every visit to a set that wants it. A new mirror for each visit would leave a target behind each time.
    if (raised.finish && quality.reflection && raised.stage.effects.includes('FloorMirror')) raised.reflection = mirror ??= createFloorReflection(768, 432)
    if (raised.reflection) scene.add(raised.reflection.mesh)
    if (renderWidth) raised.finish?.setSize(renderWidth, renderHeight)
  }
  const strike = (fallen: Standing) => {
    scene.remove(fallen.world.root)
    if (fallen.reflection) scene.remove(fallen.reflection.mesh)
    fallen.world.dispose(); fallen.environment?.dispose(); fallen.finish?.dispose()
    scene.environment = null
    scene.fog = null
  }
  let standing = raise(sceneSets[set], setArt)
  shownSet.value = standing.stage.name
  const figure = new Group()
  figure.scale.setScalar(1.25)
  figure.add(mascot.root)
  // The mesh stands on its own origin. The relief rig stands on its lowest drawn vertex.
  let bottom = 0
  if (mascot._tag === 'Relief') {
    const positions = mascot.mesh.geometry.getAttribute('position')
    const indices = mascot.mesh.geometry.index!
    for (let index = 0; index < indices.count; index++) bottom = Math.min(bottom, positions.getY(indices.getX(index)))
  }
  const floorY = standing.stage.layout.floorLevel - bottom * 1.25
  figure.position.set(standing.stage.layout.mascot[0], floorY, standing.stage.layout.mascot[1])
  scene.add(figure)
  const shadowGeometry = new PlaneGeometry(2.5, 1.8)
  const shadowMaterial = new ShaderMaterial({ transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv;void main(){float r=length((vUv-.5)*2.0);gl_FragColor=vec4(0.0,0.0,0.0,max(0.0,1.0-r*r)*.55);}',
  })
  const shadow = new Mesh(shadowGeometry, shadowMaterial)
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = standing.stage.layout.floorLevel + 0.01
  scene.add(shadow)
  // The mesh has real feet. A small dark patch under each one ties it to the floor, and fades as the foot lifts.
  const footShadowGeometry = new PlaneGeometry(0.66, 0.5)
  const footShadows = mascot._tag === 'Mesh' ? [0, 1].map(() => {
    const patch = new Mesh(footShadowGeometry, new ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uStrength: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform float uStrength;varying vec2 vUv;void main(){float r=length((vUv-.5)*2.0);gl_FragColor=vec4(0.0,0.0,0.0,max(0.0,1.0-r*r)*.62*uStrength);}',
    }))
    patch.rotation.x = -Math.PI / 2
    patch.position.y = standing.stage.layout.floorLevel + 0.015
    scene.add(patch)
    return patch
  }) : []
  dress(standing)
  const raycaster = new Raycaster()
  // The mesh has thin limbs with gaps between them, so its click area is its hover area. The pointer cursor and the click then agree.
  hit = mascot._tag === 'Mesh'
    ? position => overMascot((position.x + 1) * renderWidth / 2, (1 - position.y) * renderHeight / 2)
    : position => { raycaster.setFromCamera(position, camera); return raycaster.intersectObject(mascot.root, true).length > 0 }
  let stroll = startStroll(standing.stage.layout.mascot, 0)
  // The mesh's turn about the vertical. The relief rig is flat artwork and always faces screen right.
  // His feet carry every turn, so he never spins where he stands.
  let turn = startTurn(mascot._tag === 'Mesh' ? mascot.restHeading : 0)
  let elapsed = 0
  let faceElapsed = 0
  // How far the mesh has turned its head to the visitor, and how far it has tilted. Both ease, so neither snaps.
  const attention = { weight: 0, tilt: 0 }
  // How much of a walk-pause habit shows. It falls to zero in a conversation and returns after it.
  let habitWeight = 1
  // A mesh with the relief rig's joints takes the relief rig's pose code. Any other mesh plays its own clip or sway.
  const meshPose = mascot._tag === 'Mesh' ? mascot.pose : undefined
  const walks = mascot._tag === 'Relief' || meshPose !== undefined
  // The mesh is a full body, so it walks a route that keeps it clear of the set's furniture.
  const loop = () => meshPose ? standing.stage.layout.meshWalk : standing.stage.layout.walk
  // His legs cycle once for each stride of ground he covers, whichever way he faces. The relief rig keeps its own cadence.
  const stride = mascot._tag === 'Mesh' ? mascot.strideLength : undefined
  const meshCadence = stride ? Math.PI * 2 / (stride * figure.scale.x) : undefined
  // A full body reads as heavy at about one walk cycle in 1.6 seconds. That needs more speed than the relief rig's short cycle.
  const walkPace = meshPose ? 1.5 : 1
  const moving = () => !settings.value.motionOff && reduced.value !== 'reduce'
  // Without motion he has no steps to turn with and no later frame to turn in, so he takes his standing turn at once.
  // The close shot then stands on the side he faces, from the first frame.
  const standStill = () => {
    if (moving() || mascot._tag !== 'Mesh' || !meshPose) return
    turn = settleTurn(turn, { ...stroll, speed: 0 }, { walkSpeed: settings.value.walkSpeed * walkPace, rest: Math.abs(mascot.restHeading), limit: 1.3, attention: 'free' })
  }
  standStill()
  mascotMotion.value = walks ? 'posed' : mascot._tag === 'Mesh' && mascot.motion._tag === 'Clip' ? 'clip' : 'sway'
  if (mascot._tag === 'Mesh' && mascot.poseGap) console.warn(`The Brundlefly mesh keeps its own motion. ${mascot.poseGap}`)
  let lastReaction = reaction
  let reactionStarted = 0
  // Only the relief rig has hand joints. The mesh performs no habit, so it never needs a hand cue.
  const leftHand = mascot.root.getObjectByName('left-hand') ?? figure
  const rightHand = mascot.root.getObjectByName('right-hand') ?? figure
  // A habit's eye cue becomes a world point. The set places the light, the ceiling, and the eggs. Eggs resolve to the nearer cluster.
  const cueTarget = (cue: EyeCue) => cue === 'Palm' ? rightHand.getWorldPosition(new Vector3())
    : cue === 'Claw' ? leftHand.getWorldPosition(new Vector3())
      : cue === 'Light' ? standing.world.cues.light
        : cue === 'Ceiling' ? standing.world.cues.ceiling(figure.position)
          : nearestEggs()
  const nearestEggs = () => standing.world.cues.eggs.reduce((near, egg) => egg.distanceTo(figure.position) < near.distanceTo(figure.position) ? egg : near)
  let lastTime = 0
  let looping = false
  let focusProgress = paused ? 1 : 0
  // The mesh is a full body, so its conversation is staged: a head-and-shoulders shot, and two lights for his face that rise with the shot.
  // Both lights stay in the scene at zero, so opening the dialog compiles no new shader. The relief rig keeps its full-body shot and the lair's light.
  const staging = mascot._tag === 'Mesh' ? { eyeLine: mascot.eyeLine, rest: Math.abs(mascot.restHeading) || 0.5, face: new Vector3(), placed: false, side: 1 as 1 | -1, drift: 0,
    key: new SpotLight('#F2DEB8', 0, 7, 0.34, 0.9, 2), rim: new PointLight('#6FB7C0', 0, 3.5, 2) } : undefined
  const lamps = staging ? [staging.key, staging.key.target, staging.rim] : []
  if (lamps.length) scene.add(...lamps)
  // A journey to another set. He walks `way` during it: to the way out, then in from it.
  let travel: Travel = { _tag: 'Home' }
  let way: readonly (readonly [number, number])[] | undefined
  let swapped = false
  // The other set's artwork loads while he walks out, so the dark is short.
  let incoming: { name: SetName, art: Promise<SetArt> } | undefined
  const forget = (pending: typeof incoming) => { void pending?.art.then((art) => { if (art._tag === 'Ok') art.release() }) }
  // How far the wide view has turned to keep him clear of the open dialog during a journey, from 0 to 1.
  let lift = 0
  /** The work in the dark: the set that the page wants now replaces the set that stands. A journey back to the same set changes nothing. */
  async function changeSet() {
    const name = set
    let outcome: 'arrived' | 'stayed' = 'arrived'
    if (name === standing.stage.name) forget(incoming)
    else {
      if (incoming?.name !== name) { forget(incoming); incoming = { name, art: sceneSets[name].load() } }
      const art = await incoming.art
      if (!alive) { if (art._tag === 'Ok') art.release(); return }
      if (art._tag === 'Err') {
        for (const reason of art.reasons) console.error('Brundlefly world artwork failed to load.', reason)
        outcome = 'stayed'
      }
      else {
        const actors = [figure, shadow, ...footShadows]
        scene.remove(...actors, ...lamps)
        strike(standing)
        standing = raise(sceneSets[name], art)
        scene.add(...actors)
        dress(standing)
        if (lamps.length) scene.add(...lamps)
        const level = standing.stage.layout.floorLevel
        shadow.position.y = level + 0.01
        for (const patch of footShadows) patch.position.y = level + 0.015
      }
    }
    incoming = undefined
    // He comes in from the way out and walks to his start point. Without motion he stands at his start point at once.
    const { mascot: start, exit } = standing.stage.layout
    stroll = startStroll(moving() ? exit : start, 0)
    way = moving() ? [start] : undefined
    turn = startTurn(mascot._tag === 'Mesh' ? mascot.restHeading : 0)
    standStill()
    if (staging) staging.placed = false
    cameraView = { ...defaultCameraView }
    shownSet.value = standing.stage.name
    emit('shown', standing.stage.name, outcome)
    swapped = true
    refresh?.()
  }
  const basePosition = new Vector3()
  const baseTarget = new Vector3()
  let tiltRest: Quaternion | undefined
  const tilt = { yaw: 0, pitch: 0 }
  // A journey needs frames to its end, even without motion: its dark hold is counted in frames.
  const needsFrames = () => visibility.value === 'visible' && (animate.value || (!paused && cameraKeys.size > 0)
    || (paused && moving()) || travel._tag !== 'Home' || set !== standing.stage.name
    || Math.abs((paused ? 1 : 0) - focusProgress) > 0.001)
  function render(delta: number) {
    renderer.toneMappingExposure = settings.value.exposure
    scene.environmentIntensity = settings.value.reflections
    const aspect = renderWidth / renderHeight
    const faceMotion = moving()
    // The page wants another set: a journey begins. He leaves his loop and walks straight to the way out.
    if (travel._tag === 'Home' && set !== standing.stage.name) {
      travel = startTravel(travel)
      swapped = false
      incoming = { name: set, art: sceneSets[set].load() }
      way = [standing.stage.layout.exit]
      stroll = { ...stroll, destination: 0, activity: { _tag: 'Walking' } }
    }
    const phase = travel._tag
    travel = advanceTravel(travel, { delta, still: !faceMotion, swapped, settled: stroll.activity._tag === 'Pausing' })
    if (travel._tag === 'Dark' && phase !== 'Dark') void changeSet()
    // At home again he takes up his loop from where he stands.
    if (travel._tag === 'Home' && phase !== 'Home') { way = undefined; stroll = { ...stroll, destination: 0, activity: { _tag: 'Walking' } } }
    if (travelPhase.value !== travel._tag) travelPhase.value = travel._tag
    const dark = travelShade(travel, !faceMotion)
    if (shade.value !== dark) shade.value = dark
    const journey = travel._tag !== 'Home'
    // The conversation holds him and the close shot only while he is at home. On a journey the dialog stays open and the view goes wide.
    const talking = paused && !journey
    const layout = standing.stage.layout
    const { fog, world, finish, reflection } = standing
    const route = way ?? loop()
    const { framing, fieldOfView, fogScale } = resolveResponsiveCameraFraming(layout.camera.desktop, layout.camera.portrait, aspect)
    focusProgress = advanceConversationFocus(focusProgress, talking, delta, reduced.value === 'reduce')
    const blend = focusProgress * focusProgress * (3 - 2 * focusProgress)
    // Thicker air during a staged talk pushes the set back behind him.
    if (fog) fog.air.density = settings.value.fog * fog.scale * fogScale * (staging ? 1 + blend * 0.7 : 1)
    if (camera.fov !== fieldOfView) { camera.fov = fieldOfView; camera.updateProjectionMatrix() }
    if (!talking) cameraView = moveCameraView(cameraView, cameraKeys, delta)
    const { alpha, beta, gamma } = orientation
    // Tilt is manual look, but it follows body movement. Reduced motion and the dialog turn it off.
    const tiltPoseNow = alpha.value !== null && beta.value !== null && gamma.value !== null && touchScreen.value
      && tiltAccess.value._tag === 'Granted' && !talking && !settings.value.motionOff && reduced.value !== 'reduce'
      ? tiltPose({ alpha: alpha.value, beta: beta.value, gamma: gamma.value }, screenAngle.value ?? 0) : undefined
    tiltRest = tiltPoseNow ? followTiltRest(tiltRest, tiltPoseNow, delta) : undefined
    const tiltTarget = tiltPoseNow && tiltRest ? resolveTiltView(tiltPoseNow, tiltRest) : { yaw: 0, pitch: 0 }
    const tiltEase = reduced.value === 'reduce' ? 1 : Math.min(1, delta * 8)
    tilt.yaw += (tiltTarget.yaw - tilt.yaw) * tiltEase
    tilt.pitch += (tiltTarget.pitch - tilt.pitch) * tiltEase
    // The open dialog covers part of the picture. On a journey the wide view turns a little, so he walks in the area the dialog leaves free.
    lift = faceMotion ? lift + (Number(paused && journey) - lift) * Math.min(1, delta * 4) : Number(paused && journey)
    const clear = resolveDialogClearance(renderWidth, renderHeight, fieldOfView)
    const lifted = { ...cameraView, yaw: cameraView.yaw + lift * clear.yaw, pitch: cameraView.pitch + lift * clear.pitch }
    const view = resolveCameraView(tiltCameraView(lifted, tilt), framing, layout.camera.target, settings.value.zoom)
    basePosition.set(...view.position)
    baseTarget.set(...view.target)
    // Frame his face clear of the dialog, so his mouth stays visible while he speaks.
    const face = mascot._tag === 'Mesh' ? mascot.facePoint(new Vector3()) : figure.localToWorld(new Vector3(0.23, 0.8, 0))
    if (staging) {
      // Between talks the shot takes the side he faces and starts from rest. During a talk it keeps that side, so the camera never crosses him.
      const resting = !talking && focusProgress === 0
      if (resting) { staging.side = turn.side; staging.drift = 0 }
      // His head turns to the camera, and the camera frames his head. A slow follow keeps that loop calm and leaves his head free to act in the frame.
      // A still frame has no later frame to catch up in, so it takes his face as it is.
      const eyes = staging.eyeLine(new Vector3())
      if (resting || !faceMotion || !staging.placed) staging.face.copy(eyes)
      else {
        // His head moves as he acts, and it bobs as he stops from a walk. The frame holds still for a small move
        // and follows only the part of a larger one. A frame that chased every move swung for seconds after the shot landed.
        const reach = staging.face.distanceTo(eyes)
        if (reach > 0.1) staging.face.lerp(eyes, (1 - 0.1 / reach) * (1 - Math.exp(-delta / 0.5)))
      }
      staging.placed = true
      if (talking && faceMotion) staging.drift += delta
      // At rest the key holds a low level above his head. It falls off toward his feet, which gives his body its shape.
      staging.key.intensity = 6 + blend * 18
      staging.rim.intensity = blend * 4
      // The key stands on the side his body faces. That follows his turn smoothly, so the light never jumps across him.
      const keySide = Math.max(-1, Math.min(1, turn.heading / staging.rest))
      staging.key.position.set(staging.face.x + keySide * 1.5, staging.face.y + 1.3, staging.face.z + 2.4)
      staging.key.target.position.copy(staging.face)
      // The rim sits low and wide on his far side. It edges his jaw and shoulder, and stays far from the pale wing above them.
      staging.rim.position.set(staging.face.x - staging.side * 1.9, staging.face.y, staging.face.z - 0.9)
    }
    const focus = staging ? resolveConversationCloseUp(staging.face, renderWidth, renderHeight, camera.fov, staging.side, staging.drift)
      : resolveConversationFocus(face, renderWidth, renderHeight, camera.fov)
    const shot = blendCameraShot({ position: basePosition, target: baseTarget }, focus, blend)
    camera.position.copy(shot.position)
    camera.quaternion.copy(shot.quaternion)
    camera.updateMatrixWorld()
    // The dialog and a hovering visitor both stop him. He eases out of the stride instead of snapping.
    // A mesh without the relief rig's joints stands where the relief rig starts.
    // He walks a journey faster than his loop: he has somewhere to be.
    const walkSpeed = settings.value.walkSpeed * walkPace * (journey ? 1.7 : 1)
    const attentionNow = journey ? 'free' as const : talking ? 'talking' as const : hovered.value ? 'noticed' as const : 'free' as const
    if (walks && faceMotion && visibility.value === 'visible') stroll = advanceStroll(stroll, { delta, route,
      pauses: journey ? [600] : layout.walkPauses, walkSpeed, attention: attentionNow,
      cadence: meshCadence, facing: meshPose ? turn.heading : undefined })
    if (mascot._tag === 'Mesh' && meshPose && visibility.value === 'visible') {
      const facing = { walkSpeed, rest: Math.abs(mascot.restHeading), limit: 1.3, attention: attentionNow }
      // With motion off he has no steps to turn with, so he stands where the turn would end.
      turn = faceMotion ? advanceTurn(turn, stroll, { ...facing, delta }) : settleTurn(turn, { ...stroll, speed: 0 }, facing)
    }
    const pose = faceMotion ? strollPose(stroll) : { gait: 0, walkPhase: stroll.phase, gaze: { yaw: 0, tilt: 0 } }
    figure.position.set(stroll.position[0], floorY, stroll.position[1])
    // The relief rig leans a little toward its travel. The mesh's turn already faces it.
    figure.rotation.y = meshPose ? 0 : stroll.heading
    // The audio hears scene time twice a second, so the office tube buzzes when its light flickers.
    if (environmentMotion.value) { elapsed += delta; if (Math.floor(elapsed * 2) !== Math.floor((elapsed - delta) * 2)) emit('time', elapsed) }
    world.update({ time: elapsed, pressure: talking ? 0.25 : 0, settings: settings.value })
    if (faceMotion) faceElapsed += delta
    if (lastReaction !== reaction) { lastReaction = reaction; reactionStarted = faceElapsed }
    // A hovering visitor or the dialog draws the mesh's head to the camera. A hover alone adds a curious tilt, as on the relief rig.
    // Reduced motion and Motion off keep the pose.
    const ease = Math.min(1, delta * 4)
    attention.weight = faceMotion ? attention.weight + (Number(talking || (hovered.value && !journey)) - attention.weight) * ease : 0
    attention.tilt = faceMotion ? attention.tilt + ((hovered.value && !paused && !journey ? 0.07 : 0) - attention.tilt) * ease : 0
    const look = { target: camera.position, weight: attention.weight, tilt: attention.tilt }
    if (mascot._tag === 'Mesh' && !meshPose) mascot.update(faceElapsed, look)
    else {
      // A dialog beat and a walk-pause habit can overlap. Reduced motion and Motion off show neither.
      const layers: MannerismLayer[] = faceMotion ? [{ mannerism: beatMannerism(beat), age: faceElapsed - reactionStarted }] : []
      // He performs no habit on a journey: its one stop is the way out.
      const habit = faceMotion && !journey ? pauseMannerism(stroll, layout.walkHabits) : undefined
      // A habit turns his head away: to the ceiling, to a palm, to the eggs. In a conversation he faces the visitor.
      // A habit that kept playing as the dialog opened left him tilted in the close shot, so it fades out with the dialog and back in after it.
      habitWeight = faceMotion ? habitWeight + ((talking ? 0 : 1) - habitWeight) * Math.min(1, delta * 5) : 1
      if (habit) layers.push({ ...habit, weight: habitWeight })
      // Directional habits turn toward the nearer egg cluster. Screen right is +x.
      const side = nearestEggs().x >= figure.position.x ? 1 : -1
      const mannerism = poseMannerisms(layers.map(layer => ({ ...layer, side })))
      // He looks around on his own. A hovering visitor or the dialog draws both pupils to the camera. A habit's cue wins while it lasts.
      const eyes = !faceMotion ? { _tag: 'Ahead' } as const
        : mannerism.eyes && mannerism.eyes.weight > 0.3 ? { _tag: 'Watch', target: cueTarget(mannerism.eyes.cue) } as const
          : talking || (hovered.value && !journey) ? { _tag: 'Watch', target: camera.position } as const : { _tag: 'Wander' } as const
      const input = { time: faceElapsed, pressure: 0, pointer, transform: 'squeeze' as const, ...pose, eyes, mannerism,
        speaking: faceMotion ? speaking : 0,
        brow: thinking ? 0.12 + (faceMotion ? Math.sin(faceElapsed * 1.6) * 0.025 : 0)
          : mood === 'curious' ? 0.2 : mood === 'wary' ? 0.14 : mood === 'amused' ? 0.08 : 0,
        squint: thinking ? 0.06 : mood === 'wary' ? 0.14 : mood === 'amused' ? 0.1 : mood === 'soft' ? 0.04 : 0 }
      if (meshPose) meshPose({ ...input, stepInPlace: turn.steps, stepPhase: turn.phase }, look, turn.heading)
      else if (mascot._tag === 'Relief') mascot.update(input)
    }
    shadow.position.x = figure.position.x
    shadow.position.z = figure.position.z
    if (mascot._tag === 'Mesh' && footShadows.length) {
      // The large shadow lies between his feet. A turn on his feet moves him off his route point, and the shadow goes with him.
      shadow.position.x = shadow.position.z = 0
      mascot.footContacts((place, planted, index) => {
        const patch = footShadows[index]!
        patch.position.x = place.x
        patch.position.z = place.z
        patch.material.uniforms.uStrength!.value = planted
        shadow.position.x += place.x / 2
        shadow.position.z += place.z / 2
      })
    }
    const reach = mascot._tag === 'Mesh' ? [new Vector3(mascot.extent.left, 0, 0), new Vector3(mascot.extent.right, mascot.extent.height, 0)]
      : [new Vector3(-1.1, -1.25, 0), new Vector3(1.1, 1.3, 0)]
    const corners = reach.map(value => figure.localToWorld(value).project(camera))
    bounds = { left: (corners[0]!.x + 1) * renderWidth / 2, right: (corners[1]!.x + 1) * renderWidth / 2,
      top: (1 - corners[1]!.y) * renderHeight / 2, bottom: (1 - corners[0]!.y) * renderHeight / 2 }
    reflection?.update(settings.value.wetness)
    if (finish) finish.render({ time: elapsed, focus: blend, focusDistance: camera.position.distanceTo(staging ? staging.face : face) })
    else renderer.render(scene, camera)
  }
  refresh = () => {
    const w = Math.max(1, width.value)
    const h = Math.max(1, height.value)
    if (w !== renderWidth || h !== renderHeight) {
      renderWidth = w; renderHeight = h
      renderer.setSize(w, h, false)
      standing.finish?.setSize(w, h)
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
    forget(incoming)
    strike(standing); mirror?.dispose(); mascot.dispose(); loadedTextures.forEach(value => value.dispose())
    staging?.key.dispose(); staging?.rim.dispose()
    shadowGeometry.dispose(); shadowMaterial.dispose(); renderer.dispose()
    footShadowGeometry.dispose(); footShadows.forEach(patch => patch.material.dispose())
  }
  status.value = { _tag: 'Ready' }
  refresh()
}, { flush: 'post', once: true })
</script>

<template>
  <div ref="host" class="world-scene" :data-set="shownSet" :data-travel="travelPhase" :data-renderer="status._tag" :data-mascot="shownMascot" :data-mascot-motion="mascotMotion" :data-quality="shownQuality" :aria-busy="status._tag === 'Loading'">
    <canvas ref="canvas" aria-hidden="true" />
    <div v-if="status._tag === 'Ready'" class="world-vignette" :class="{ 'world-vignette-close': paused && travelPhase === 'Home' && shownMascot === 'mesh' }" aria-hidden="true" />
    <div v-if="status._tag === 'Ready'" class="world-dark" :style="{ opacity: shade }" aria-hidden="true" />
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
/* A staged talk darkens the lair around his head. The dark ring rises with the camera. */
.world-vignette::after { content: ''; position: absolute; inset: 0; opacity: 0; transition: opacity .65s ease-in-out;
  background: radial-gradient(ellipse 58% 62% at 50% 32%, transparent 38%, rgb(8 11 8 / 0.5) 78%, rgb(8 11 8 / 0.82) 100%); }
.world-vignette-close::after { opacity: 1; }
@media (orientation: landscape) and (max-height: 540px) { .world-vignette::after { background: radial-gradient(ellipse 46% 80% at 26% 44%, transparent 38%, rgb(8 11 8 / 0.5) 78%, rgb(8 11 8 / 0.82) 100%); } }
@media (prefers-reduced-motion: reduce) { .world-vignette::after { transition: none; } }
/* A journey to another set darkens the whole picture. The scene sets how dark, frame by frame. */
.world-dark { position: absolute; inset: 0; pointer-events: none; background: var(--color-night); }
.world-interaction { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; cursor: default; touch-action: none; }
.world-interaction.mascot-hover { cursor: pointer; }
.world-interaction:focus-visible { outline: 2px solid var(--color-cream); outline-offset: -8px; }
.world-fallback { position: absolute; inset: 10% 0; margin: auto; height: 80%; width: 80%; object-fit: contain; image-rendering: pixelated; }
.world-status { position: absolute; bottom: 1rem; left: 1rem; right: 1rem; text-align: center; font: 12px var(--font-mono); color: var(--color-wing); }
</style>
