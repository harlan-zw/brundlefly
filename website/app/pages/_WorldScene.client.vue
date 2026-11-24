<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useDeviceOrientation, useDocumentVisibility, useElementSize, useEventListener, useMediaQuery, usePreferredReducedMotion, useScreenOrientation, useSessionStorage } from '@vueuse/core'
import { useRoute } from '#app'
import {
  ACESFilmicToneMapping, ClampToEdgeWrapping, Color, FogExp2, Group, LinearFilter, Matrix4, Mesh, MirroredRepeatWrapping, NearestFilter,
  PerspectiveCamera, PlaneGeometry, PointLight, Quaternion, Raycaster, Scene, ShaderMaterial, SpotLight, SRGBColorSpace, TextureLoader,
  Vector2, Vector3, WebGLRenderer,
} from 'three'
import { createMascotModel } from '@brundlefly/brand/shared/mascot'
import { loadMeshMascot } from '@brundlefly/brand/shared/mascot-mesh'
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
import { mascotInLight } from '@brundlefly/brand/shared/scene-set'
import type { BuiltSet, SceneSet, SetArt, SetMascot, SetName } from '@brundlefly/brand/shared/scene-set'
import { advanceEntrance, entranceAct, entranceLight, startEntrance } from '@brundlefly/brand/shared/office-entrance'
import type { Entrance } from '@brundlefly/brand/shared/office-entrance'
import { advanceTravel, startTravel, travelShade } from '@brundlefly/brand/shared/set-travel'
import type { Travel } from '@brundlefly/brand/shared/set-travel'
import { beatMannerism, keyTaps, machineSmacks, markerStrokes, pauseMannerism, poseMannerisms, roundHabits, stationMannerism } from '@brundlefly/brand/shared/mannerism'
import type { EyeCue, MannerismLayer } from '@brundlefly/brand/shared/mannerism'
import { advanceConversationFocus, blendCameraShot, defaultCameraView, followTiltRest, moveCameraView, resolveCameraView, resolveConversationCloseUp, resolveConversationFocus, resolveDialogClearance, resolveFollowYaw, resolveResponsiveCameraFraming, resolveTiltView, rotateCameraView, tiltCameraView, tiltPose } from '@brundlefly/brand/shared/camera-view'
import type { CameraKey } from '@brundlefly/brand/shared/camera-view'
import type { SceneAudioMix } from '#shared/scene-audio'
import type { ActionSound } from '#shared/action-sounds'
import type { ConversationMood } from '#shared/conversation'
import { criticalSceneSeconds, specimenCount } from '#shared/office-experiment'
import type { Creature, Experiment } from '#shared/office-experiment'
import { crashSeconds, criticalAct, criticalAddressAt, criticalArc, criticalFrame, criticalSpurtAt } from '#shared/office-critical'
import { createCaveSnails } from '../cave-snails'
import { createExperimentStage } from '../office-stage'
import type { Station } from '../office-stage'
import SceneControls from './_SceneControls.vue'
import SceneLoading from './_SceneLoading.vue'

// `experiment` is the shared office experiment, or nothing without a connection. `station` is where the visitor looks in the office.
// `serverClock` gives server time, so every device plays the critical scene at one moment. `joined` is a visitor who came by the join code: the office is lit for them.
// `cut` makes the next journey a cut in the dark, with no walk to the way out. `caveSnails` puts the snails of the experiment in the cave.
// `covered` says the computer's screen fills the whole page, as it does on a phone: the scene then keeps its state and draws nothing, which leaves the phone free for the keys.
// `party` is the celebration in the cave: the server time when the music's chorus hits, and its tempo. He and the snails dance to it from that moment.
const { set = 'lair', paused = false, speaking = 0, mood = 'neutral', thinking = false, beat = '', reaction = 0, experiment = null, station = 'room', serverClock = Date.now, connected = 0, joined = false, cut = false, caveSnails = false, party = null, covered = false } = defineProps<{ set?: SetName, paused?: boolean, speaking?: number, mood?: ConversationMood, thinking?: boolean, beat?: string, reaction?: number,
  experiment?: Experiment | null, station?: Station, serverClock?: () => number, connected?: number, joined?: boolean, cut?: boolean, caveSnails?: boolean, party?: { at: number, bpm: number } | null, covered?: boolean }>()
// `set` is the place the page wants him in. The scene reports the set that stands, and travels when the two differ.
const shownSet = ref<SetName>(set)
const travelPhase = ref<Travel['_tag']>('Home')
// The phase of the entrance in the dark. `Lit` is the room as it stands at every other time.
const entrancePhase = ref<Entrance['_tag']>('Lit')
// The entrance shows once in a browser session. A browser that refuses the session store keeps this for the page only, so its next load shows the entrance again.
const entranceSeen = useSessionStorage('brundlefly-office-entrance', false, { onError: cause => console.warn('The session store is unavailable. The office entrance can show again.', cause) })
// The dark edge of the picture, as the set that stands asks for it.
const vignette = ref<SetMascot['vignette']>(sceneSets[set].mascot.vignette)
// How dark a journey or the critical scene makes the picture, from 0 to 1.
const shade = ref(0)
// How much of the picture the test chamber's light covers in the critical scene, from 0 to 1.
const flash = ref(0)
const requestedMascot = useRoute().query.mascot
const mascotMode = resolveMascotMode(requestedMascot)
const spriteMascot = mascotMode === 'sprite'
// `?quality=low`, `medium`, or `high` overrides the tier that the device would get.
const requestedQuality = useRoute().query.quality
// The look of the join code can be tried from the address: `?glass=0.3&bugs=0.8` sets how solid the light behind the code is and how bright the beetles are, each from 0 to 1.
// `?tune` also lets the arrow keys change them while the code shows: up and down for the glass, left and right for the beetles.
const share = (value: unknown, otherwise: number) => { const read = typeof value === 'string' && value !== '' ? Number(value) : Number.NaN; return Number.isFinite(read) ? Math.max(0, Math.min(1, read)) : otherwise }
const codeLook = ref({ glass: share(useRoute().query.glass, 1), bugs: share(useRoute().query.bugs, 0) })
const tuning = 'tune' in useRoute().query
let tuneCode: ((look: { glass: number, bugs: number }) => void) | undefined
useEventListener('keydown', (event: KeyboardEvent) => {
  if (!tuning || station !== 'code' || !event.key.startsWith('Arrow')) return
  event.preventDefault()
  const step = (value: number, by: number) => Math.round(Math.max(0, Math.min(1, value + by)) * 100) / 100
  const { glass, bugs } = codeLook.value
  codeLook.value = event.key === 'ArrowUp' ? { glass: step(glass, 0.05), bugs } : event.key === 'ArrowDown' ? { glass: step(glass, -0.05), bugs }
    : event.key === 'ArrowRight' ? { glass, bugs: step(bugs, 0.05) } : { glass, bugs: step(bugs, -0.05) }
  tuneCode?.(codeLook.value)
  refresh?.()
})
const shownQuality = ref<string>()
// The scene reports the mascot it shows. A mesh that cannot load shows the relief rig.
const shownMascot = ref<MascotMode>()
// How the visible mascot moves: the relief rig's pose code, the file's own clip, or a whole-body sway.
const mascotMotion = ref<'posed' | 'clip' | 'sway'>()
// `shown` names the set that stands: at the first picture, and after a journey. `stayed` means the other set's artwork did not load.
// `entrance` says whether this visit found the set dark. `action` names a short sound for something he does.
// `station` asks for another view of the office. `landed` names a specimen that reached the pile. `view` says the picture is back after a journey.
const emit = defineEmits<{ talk: [], mix: [value: SceneAudioMix], shown: [set: SetName, outcome: 'arrived' | 'stayed'], time: [seconds: number],
  entrance: [dark: boolean], action: [sound: ActionSound], station: [station: Station], landed: [kind: Creature], view: [set: SetName] }>()
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
// The pointer rests on the computer or the chamber window.
const overProp = ref(false)
const pointer = new Vector2()
let alive = true
let cleanup: (() => void) | undefined
let refresh: (() => void) | undefined
let hit: ((pointer: Vector2) => boolean) | undefined
let stationAt: ((point: Vector2) => Station | undefined) | undefined
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
  hovered.value = station === 'room' && overMascot(x, y)
  overProp.value = !hovered.value && stationAt?.(new Vector2(x / rect.width * 2 - 1, 1 - y / rect.height * 2)) !== undefined
}
function select(event: MouseEvent) {
  askForTilt()
  if (suppressClick) { suppressClick = false; if (event.detail !== 0) return }
  if (paused) return
  const rect = host.value?.getBoundingClientRect()
  if (!rect) return
  // The keyboard has no pointer. It talks to him in the room, and returns to the room from a station.
  if (event.detail === 0) {
    if (station === 'room') emit('talk')
    else emit('station', 'room')
    return
  }
  const position = new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2)
  const prop = stationAt?.(position)
  // At a station, a click on the other prop goes there, and a click on the room goes back to it.
  if (station !== 'room') { if (prop !== station) emit('station', prop ?? 'room'); return }
  // He stands in front of the props, so a click on him is for him.
  if (status.value._tag !== 'Ready' || hit?.(position)) emit('talk')
  else if (prop) emit('station', prop)
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
  stationAt = undefined
  status.value = { _tag: 'Fallback', reason: 'context' }
})
watch(() => [experiment, station, cut, caveSnails, party, covered], () => refresh?.())
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
  if (paused || visibility.value !== 'visible') { cameraKeys.clear(); endView(); hovered.value = false; overProp.value = false }
  refresh?.()
})
onScopeDispose(() => { alive = false; cleanup?.() })

watch(canvas, async (element) => {
  if (!element) return
  const context = element.getContext('webgl2', { alpha: false, antialias: true })
  if (!context) { status.value = { _tag: 'Fallback', reason: 'context' }; return }
  // The page can ask for another set while the artwork loads. The scene raises the set it loaded, and travels to the other from there.
  const first = set
  // A missing or broken model file is an error value. The relief rig then takes its place.
  const [results, setArt, meshResult] = await Promise.all([Promise.allSettled([
    new TextureLoader().loadAsync('/brand/character.png'),
    new TextureLoader().loadAsync('/brand/kit/lair/face-skin-diffuse.png'),
    new TextureLoader().loadAsync('/brand/kit/lair/head-projection.png'),
    new TextureLoader().loadAsync('/brand/kit/lair/body-projection.png'),
  ]), sceneSets[first].load(), mascotMode === 'mesh' ? loadMeshMascot(undefined, undefined, sceneSets[first].mascot.shading) : undefined])
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
  let standing = raise(sceneSets[first], setArt)
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
  const shadowMaterial = new ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uStrength: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform float uStrength;varying vec2 vUv;void main(){float r=length((vUv-.5)*2.0);gl_FragColor=vec4(0.0,0.0,0.0,max(0.0,1.0-r*r)*uStrength);}',
  })
  const shadow = new Mesh(shadowGeometry, shadowMaterial)
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = standing.stage.layout.floorLevel + 0.01
  scene.add(shadow)
  // The mesh has real feet. A small dark patch under each one ties it to the floor, and fades as the foot lifts.
  const footShadowGeometry = new PlaneGeometry(0.66, 0.5)
  const footShadows = mascot._tag === 'Mesh' ? [0, 1].map(() => {
    const patch = new Mesh(footShadowGeometry, new ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uStrength: { value: 0 }, uDark: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform float uStrength;uniform float uDark;varying vec2 vUv;void main(){float r=length((vUv-.5)*2.0);gl_FragColor=vec4(0.0,0.0,0.0,max(0.0,1.0-r*r)*uDark*uStrength);}',
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
  let workTaps = 0
  let workStrokes = 0
  let workSmacks = 0
  // His stops at each walk point so far. A point with a second habit takes it on every second visit.
  let stopVisits: number[] = []
  let stoppedAt: number | undefined
  // The age of his stop at a station when he first faced his work there. His habit waits for it.
  let stationReady: number | undefined
  // The walk point he stands at, or nothing while he walks.
  const stopNow = () => stroll.activity._tag === 'Pausing' ? stroll.activity.waypoint % standing.stage.layout.walkPauses.length : undefined
  let workTending = false
  // The way he faces at the stop he stands at, when the set gives one and nothing else has his attention.
  const workFacing = (attention: 'free' | 'noticed' | 'talking') => attention === 'free' && stroll.activity._tag === 'Pausing'
    ? standing.stage.layout.walkFacings?.[stroll.activity.waypoint % standing.stage.layout.walkPauses.length] : undefined
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
    key: new SpotLight('#FFFFFF', 0, 7, 0.34, 0.9, 2), rim: new PointLight('#FFFFFF', 0, 3.5, 2) } : undefined
  const lamps = staging ? [staging.key, staging.key.target, staging.rim] : []
  if (lamps.length) scene.add(...lamps)
  // Each set lights him as it lights its own room. The scene applies the set's look each time a set rises: here, and after every journey.
  // The mesh takes its shading from its own colours every time, so no tint stacks on another.
  // The levels of his lights, his shadows, and the dark edge follow the set's light in every frame.
  const present = ({ mascot: look }: SceneSet) => {
    if (mascot._tag === 'Mesh') mascot.shade(look.shading)
    staging?.key.color.set(look.key.colour)
    staging?.rim.color.set(look.rim.colour)
  }
  present(standing.stage)
  // A journey to another set. He walks `way` during it: to the way out, then in from it.
  let travel: Travel = { _tag: 'Home' }
  let way: readonly (readonly [number, number])[] | undefined
  let swapped = false
  // The journey has made the picture dark, and the visitor has not seen the new set yet.
  let hidden = false
  // Seconds since the scene raised the cave after the critical scene, while that arrival still plays. It is slower than a walk between the sets:
  // the picture takes `reveal` seconds to come up, and the view takes `settle` seconds to draw back.
  let arrival: number | undefined
  const arrivalTimes = { reveal: 3.6, settle: 8 }
  // A celebration waits in the dark for the chorus, and then the cave is there at once.
  const partyReveal = 0.7
  const smoothShare = (value: number) => { const share = Math.max(0, Math.min(1, value)); return share * share * (3 - 2 * share) }
  // The other set's artwork loads while he walks out, so the dark is short.
  let incoming: { name: SetName, art: Promise<SetArt> } | undefined
  const forget = (pending: typeof incoming) => { void pending?.art.then((art) => { if (art._tag === 'Ok') art.release() }) }
  // How far the wide view has turned to keep him clear of the open dialog during a journey, from 0 to 1.
  let lift = 0
  // A visitor who loads a set with an entrance finds it dark, once in a browser session. He waits in the dark and walks to the switch.
  // A journey from another set arrives in a lit room, and so does every later load.
  const entry = standing.stage.layout.entrance
  let entrance = startEntrance({ offered: entry !== undefined, arrival: joined ? 'Travel' : 'Load', seen: entranceSeen.value, still: !moving(), walks })
  if (entry && entrance._tag === 'Dark') {
    entranceSeen.value = true
    stroll = startStroll(entry.start, 0)
    way = [entry.stand]
  }
  entrancePhase.value = entrance._tag
  emit('entrance', entrance._tag === 'Dark')
  // A narrow screen cannot show the switch. From the dark until he is back in the picture, the wide view turns to keep him in sight.
  let following = entrance._tag !== 'Lit'
  let follow: number | undefined
  // The side of him that the switch is on.
  const switchSide = entry && entry.facing < 0 ? -1 : 1
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
        present(standing.stage)
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
    // A cut is the journey out of the critical scene. The page clears `cut` when it hears of the new set, so the scene reads it first.
    if (cut && outcome === 'arrived' && moving()) arrival = party ? Math.min(0, (serverClock() - party.at) / 1000) : 0
    emit('shown', standing.stage.name, outcome)
    swapped = true
    refresh?.()
  }
  const basePosition = new Vector3()
  const baseTarget = new Vector3()
  let tiltRest: Quaternion | undefined
  const tilt = { yaw: 0, pitch: 0 }
  // The office experiment: the specimens, the join code, and the counter's screen. The scene builds it when the first state arrives in the office.
  let stage: ReturnType<typeof createExperimentStage> | undefined
  // The snails that came out of the chamber. They are in the cave after the experiment, for as long as the page stays open.
  let snails: ReturnType<typeof createCaveSnails> | undefined
  let stageBusy = false
  // During the count he keeps his round, on the right of the room. Two moments take him off it, to one stop where he waits:
  // in the critical scene he stands at the jars, under the chamber window, and while the join code shows he waits at the stop nearest the viewer,
  // behind the camera at the window, so no arm of his crosses the code.
  // The spot he is sent to and holds, as text, so a new spot is seen as a change. It is empty while he walks his round.
  let heldAt = ''
  // The scene time when the count last rose. While specimens fall he stops where he is and counts them.
  let tallyAt = Number.NEGATIVE_INFINITY
  let tallySeen = -1
  let busyPlace: readonly [number, number] | undefined
  let busyAge = 0
  // His work in the critical scene: which work it is, and for how long he has done it since he arrived.
  let workKey = ''
  let workAge = 0
  let typeTaps = 0
  // The moment of the last green arc. A wing of his jumps at each one.
  let arcAt = Number.NEGATIVE_INFINITY
  let partyHeld = false
  // How far the view has moved from the room to a station, from 0 to 1, and the station's shot as the view moves to it.
  let stationShare = 0
  const stationPlace = new Vector3()
  const stationTurn = new Quaternion()
  let stationPlaced = false
  const lookTurn = (position: Vector3, target: Vector3) => new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position, target, camera.up))
  const projected = new Vector3()
  const propRay = new Raycaster()
  stationAt = (point) => {
    if (!stage?.group.visible) return
    propRay.setFromCamera(point, camera)
    return stage.stationAt(propRay.ray)
  }
  // The page reads these to place the counter's keys on the screen and his line over his head.
  const anchors = new Map<string, string>()
  const anchor = (name: string, value: string) => {
    if (anchors.get(name) === value) return
    anchors.set(name, value)
    host.value?.parentElement?.style.setProperty(name, value)
  }
  // A journey needs frames to its end, even without motion: its dark hold is counted in frames.
  const needsFrames = () => visibility.value === 'visible' && (animate.value || (!paused && cameraKeys.size > 0)
    || (paused && moving()) || travel._tag !== 'Home' || set !== standing.stage.name || entrance._tag !== 'Lit'
    || Math.abs((paused ? 1 : 0) - focusProgress) > 0.001 || stageBusy || (stationShare > 0 && stationShare < 1) || (station !== 'room') !== (stationShare === 1) || arrival !== undefined)
  function render(delta: number) {
    renderer.toneMappingExposure = settings.value.exposure
    const aspect = renderWidth / renderHeight
    const faceMotion = moving()
    // The entrance in the dark. A visitor who asks for him, or who leaves for another set, ends it at once: the light comes and he is free.
    const entered = entranceAct(entrance)
    const phaseBefore = entrance._tag
    entrance = advanceEntrance(entrance, { delta, arrived: stroll.activity._tag === 'Pausing', skip: paused || Boolean(experiment) || set !== standing.stage.name, still: !faceMotion })
    const act = entranceAct(entrance)
    if (entrance._tag !== phaseBefore) {
      entrancePhase.value = entrance._tag
      // The switch clicks as the light comes. The tubes ring only when they strike.
      if (entrance._tag === 'Striking' || entrance._tag === 'Hurrying') emit('action', 'LightSwitch')
      if (entrance._tag === 'Striking') emit('action', 'TubeStrike')
    }
    // Free again, he takes up his loop from where he stands.
    if (entered.held && !act.held) { way = undefined; stroll = { ...stroll, destination: 0, activity: { _tag: 'Walking' } } }
    // The experiment belongs to the office. Its critical scene dims the tubes, and every device times it from the server's clock.
    const run = standing.stage.name === 'office' ? experiment : null
    const criticalAge = run && run.criticalAt !== null ? Math.max(0, (serverClock() - run.criticalAt) / 1000) : undefined
    const critical = criticalAge !== undefined && criticalAge < criticalSceneSeconds ? criticalFrame(criticalAge, !faceMotion) : undefined
    const over = criticalAge !== undefined && !critical
    const light = entranceLight(entrance) * (critical?.light ?? 1)
    // The critical scene ends in the cave. Its artwork loads from the middle of the count, so the dark is short on a phone.
    if (run && !over && (critical || specimenCount(run) >= run.target / 2) && set === 'office' && !incoming) incoming = { name: 'lair', art: sceneSets.lair.load() }
    const look = mascotInLight(standing.stage.mascot, light)
    shadowMaterial.uniforms.uStrength!.value = look.shadow.body
    for (const patch of footShadows) patch.material.uniforms.uDark!.value = look.shadow.foot
    if (vignette.value !== look.vignette) vignette.value = look.vignette
    // His wet skin shows the room's lamps. With the lamps out it shows none.
    scene.environmentIntensity = settings.value.reflections * light
    // The page wants another set: a journey begins. He leaves his loop and walks straight to the way out.
    if (travel._tag === 'Home' && set !== standing.stage.name) {
      travel = startTravel(travel)
      swapped = false
      if (incoming?.name !== set) { forget(incoming); incoming = { name: set, art: sceneSets[set].load() } }
      way = [standing.stage.layout.exit]
      stroll = { ...stroll, destination: 0, activity: { _tag: 'Walking' } }
    }
    const phase = travel._tag
    // A cut has no walk to the way out: the picture is dark already.
    travel = advanceTravel(travel, { delta, still: !faceMotion || (cut && travel._tag === 'Leaving'), swapped, settled: stroll.activity._tag === 'Pausing' })
    if (travel._tag === 'Dark' && phase !== 'Dark') void changeSet()
    // At home again he takes up his loop from where he stands.
    if (travel._tag === 'Home' && phase !== 'Home') { way = undefined; stroll = { ...stroll, destination: 0, activity: { _tag: 'Walking' } } }
    if (travelPhase.value !== travel._tag) travelPhase.value = travel._tag
    // After the critical scene the cave comes up slowly out of the dark.
    if (arrival !== undefined) { arrival += delta; if (arrival >= arrivalTimes.settle || !faceMotion) arrival = undefined }
    const dark = Math.max(cut && travel._tag === 'Leaving' ? 1 : travelShade(travel, !faceMotion), critical?.shade ?? 0, arrival === undefined ? 0 : 1 - smoothShare(arrival / (party ? partyReveal : arrivalTimes.reveal)))
    // The beats of the celebration since the chorus hit. He dances in the cave from the hit on.
    const beats = party && standing.stage.name === 'lair' ? (serverClock() - party.at) / 1000 * party.bpm / 60 : undefined
    const dancing = beats !== undefined && beats >= 0 && faceMotion
    if (shade.value !== dark) shade.value = dark
    if (flash.value !== (critical?.flash ?? 0)) flash.value = critical?.flash ?? 0
    // The visitor sees the new set from here. The page waits for this before he speaks to them.
    if (travel._tag === 'Leaving' || travel._tag === 'Dark') hidden = true
    else if (hidden && dark < 0.3) { hidden = false; emit('view', standing.stage.name) }
    const journey = travel._tag !== 'Home'
    // The conversation holds him and the close shot only while he is at home. On a journey the dialog stays open and the view goes wide.
    const talking = paused && !journey
    const layout = standing.stage.layout
    const { fog, world, finish, reflection } = standing
    // A run with specimens takes him off his round. He walks to the whiteboard and keeps the count there.
    const chamberStop = Math.max(0, layout.walkHabits.indexOf('TendJar'))
    const awayStop = layout.walk.reduce((best, point, index) => point[1] > layout.walk[best]![1] ? index : best, 0)
    // The critical scene moves him: to the chamber, and then to the computer.
    const scripted = critical && criticalAge !== undefined ? criticalAct(criticalAge) : undefined
    // While specimens fall he stops where he is and counts them. A few quiet seconds send him back to his round.
    const counted = run && !over ? specimenCount(run) : 0
    if (counted !== tallySeen) { if (tallySeen >= 0 && counted > tallySeen) tallyAt = elapsed; tallySeen = counted }
    const busy = Boolean(run && !critical && !over && counted > 0 && elapsed - tallyAt < 4)
    if (!busy) busyPlace = undefined
    else busyPlace ??= [stroll.position[0], stroll.position[1]]
    const spot = !run || journey || act.held ? undefined
      : scripted ? scripted.place === 'Computer' && stage ? stage.deskSpot : layout.walk[chamberStop]!
        : station === 'code' && !over ? layout.walk[awayStop]! : busyPlace
    const spotKey = spot ? spot.join() : ''
    if (spotKey !== heldAt) {
      heldAt = spotKey
      stroll = faceMotion || !spot ? { ...stroll, destination: 0, activity: { _tag: 'Walking' } } : startStroll(spot, 0)
    }
    // He dances where he stands in the cave, and waits there in the dark for the music.
    const partying = beats !== undefined
    if (partying !== partyHeld) { partyHeld = partying; stroll = partying ? startStroll(layout.mascot, 0) : { ...stroll, destination: 0, activity: { _tag: 'Walking' } } }
    const counting = spot !== undefined || partying
    const route = partying ? [layout.mascot] : spot ? [spot] : way ?? loop()
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
    // A journey takes him out of the picture on purpose, so the view lets him go.
    if (journey) following = false
    // The picture holds his body and the arm he stretches to the switch.
    const halfWidth = (mascot._tag === 'Mesh' ? (mascot.extent.right - mascot.extent.left) / 2 : 1.1) * figure.scale.x * 1.5
    const turnTo = following ? resolveFollowYaw([framing[0] + cameraView.x, framing[2] / settings.value.zoom + cameraView.z], cameraView.yaw, stroll.position, halfWidth, fieldOfView, aspect) : 0
    // He is free again and in the picture: the view is the visitor's alone from here.
    if (!act.held && turnTo === 0) following = false
    follow = follow === undefined || !faceMotion ? turnTo : follow + (turnTo - follow) * Math.min(1, delta * 4)
    const lifted = { ...cameraView, yaw: cameraView.yaw + lift * clear.yaw + follow, pitch: cameraView.pitch + lift * clear.pitch }
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
      const { key, rim } = look
      staging.key.intensity = key.rest + blend * key.talk
      staging.rim.intensity = rim.rest + blend * rim.talk
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
    const snailed = caveSnails && standing.stage.name === 'lair'
    // He dances in one place and walks a set loop, so the snails can come nearer than a body's width.
    if (snailed && !snails) { snails = createCaveSnails(standing.stage.layout, { count: 14, clearance: 0.9 }); scene.add(snails.group) }
    if (snails) {
      snails.group.visible = snailed
      if (snailed) snails.update({ delta, still: !faceMotion, avoid: stroll.position, dance: dancing ? beats : undefined })
    }
    // A station of the office takes the view from the room: the computer's screen, or the chamber window. A talk and the critical scene give it back.
    if (run && !stage) { stage = createExperimentStage(undefined, codeLook.value); scene.add(stage.group); tuneCode = stage.setCodeLook }
    if (stage) stage.group.visible = run !== null
    // The critical scene takes the view back to the room. A visitor at the computer first sees its screen fail.
    const atStation = stage && run && station !== 'room' && !talking && !journey && (!critical || (station === 'computer' && criticalAge !== undefined && criticalAge < crashSeconds)) ? station : undefined
    if (stage && atStation) {
      const to = stage.shot(atStation, renderWidth, renderHeight, camera.fov)
      const turnTo = lookTurn(to.position, to.target)
      // A change from one station to the other moves the shot, so the view glides between them.
      const ease = stationPlaced && faceMotion ? 1 - Math.exp(-delta * 6) : 1
      stationPlace.lerp(to.position, ease)
      stationTurn.slerp(turnTo, ease)
      stationPlaced = true
    }
    stationShare = faceMotion ? Math.max(0, Math.min(1, stationShare + (atStation ? delta : -delta) / 0.9)) : Number(Boolean(atStation))
    if (stationShare === 0) stationPlaced = false
    else {
      const share = stationShare * stationShare * (3 - 2 * stationShare)
      camera.position.lerp(stationPlace, share)
      camera.quaternion.slerp(stationTurn, share)
    }
    // The view starts close to the ground of the cave and draws back to the place it keeps.
    if (arrival !== undefined) camera.position.lerp(baseTarget, 0.2 * (1 - smoothShare(Math.max(0, arrival) / arrivalTimes.settle)))
    if (critical && criticalAge !== undefined && stage) {
      // The view leans toward the chamber as it wakes, and the room shakes.
      const lean = critical.chamber * 0.3
      camera.position.lerp(projected.set(stage.glass.centre.x + 2.6, 0.2, 5.2), lean)
      camera.quaternion.slerp(lookTurn(camera.position, standing.world.cues.light), lean)
      camera.rotateZ(Math.sin(criticalAge * 31) * 0.014 * critical.shake)
      camera.rotateX(Math.sin(criticalAge * 23 + 1) * 0.006 * critical.shake)
    }
    camera.updateMatrixWorld()
    if (stage && run) {
      const frame = stage.update({ experiment: run, connected, station: atStation ?? 'room', critical, arc: criticalAge === undefined ? undefined : criticalArc(criticalAge, !faceMotion), eye: camera.position, over, delta, still: !faceMotion, mascot: stroll.position, marks: standing.world.marks })
      stageBusy = frame.busy
      if (frame.landed) emit('landed', frame.landed)
      if (frame.struck) { emit('action', 'ArcZap'); arcAt = faceElapsed }
      // The counter's keys lie on the glass of the monitor. The page hides them until the view has reached the screen.
      const { centre, width: glassWidth, height: glassHeight } = stage.glass
      projected.set(centre.x - glassWidth / 2, centre.y - glassHeight / 2, centre.z).project(camera)
      const left = (1 + projected.x) * renderWidth / 2
      const bottom = (1 - projected.y) * renderHeight / 2
      projected.set(centre.x + glassWidth / 2, centre.y + glassHeight / 2, centre.z).project(camera)
      const top = (1 - projected.y) * renderHeight / 2
      anchor('--crt-left', `${left.toFixed(1)}px`)
      anchor('--crt-top', `${top.toFixed(1)}px`)
      anchor('--crt-width', `${((1 + projected.x) * renderWidth / 2 - left).toFixed(1)}px`)
      anchor('--crt-height', `${(bottom - top).toFixed(1)}px`)
      anchor('--crt-ready', atStation === 'computer' && stationShare > 0.92 ? '1' : '0')
    }
    else stageBusy = false
    // The dialog and a hovering visitor both stop him. He eases out of the stride instead of snapping.
    // A mesh without the relief rig's joints stands where the relief rig starts.
    // He walks a journey faster than his loop: he has somewhere to be.
    // He walks to the switch at that pace too.
    // In the critical scene he runs.
    const walkSpeed = settings.value.walkSpeed * walkPace * (critical ? 2.3 : journey || act.held ? 1.7 : 1)
    // In the dark he has noticed the visitor, and he waits. On his way to the switch a pointer that rests on him does not stop him.
    const attentionNow = journey ? 'free' as const : talking ? 'talking' as const
      : entrance._tag === 'Dark' ? 'noticed' as const : act.held ? 'free' as const : hovered.value ? 'noticed' as const : 'free' as const
    if (walks && faceMotion && visibility.value === 'visible') stroll = advanceStroll(stroll, { delta, route,
      pauses: journey || act.held || counting ? [600] : layout.walkPauses, walkSpeed, attention: attentionNow,
      cadence: meshCadence, facing: meshPose ? turn.heading : undefined })
    if (mascot._tag === 'Mesh' && meshPose && visibility.value === 'visible') {
      // At a station of his round he faces his work, until a visitor has his attention. At the switch he faces it. After the strike he turns back to the visitor on his feet.
      const facing = { walkSpeed, rest: Math.abs(mascot.restHeading), limit: 1.3, attention: attentionNow, stand: act.facesSwitch ? entry?.facing
        // Where he waits he keeps his own three-quarter turn. A turn to the wall there put his head through his shoulder when he looked round.
        : scripted?.work === 'Type' && stage && attentionNow === 'free' ? stage.deskFacing
          // At the chamber he turns side-on to it, as he does for a jar, so he watches the machine and the visitor still sees his face.
          : scripted?.place === 'Chamber' && attentionNow === 'free' ? layout.walkFacings?.[chamberStop]
            : counting ? undefined : workFacing(attentionNow) }
      // With motion off he has no steps to turn with, so he stands where the turn would end.
      turn = faceMotion ? advanceTurn(turn, stroll, { ...facing, delta }) : settleTurn(turn, { ...stroll, speed: 0 }, facing)
    }
    const pose = faceMotion ? strollPose(stroll) : { gait: 0, walkPhase: stroll.phase, gaze: { yaw: 0, tilt: 0 } }
    // His whole body bounces once a beat as he dances.
    figure.position.set(stroll.position[0], floorY + (dancing && beats !== undefined ? Math.abs(Math.sin(beats * Math.PI)) * 0.07 : 0), stroll.position[1])
    // The relief rig leans a little toward its travel. The mesh's turn already faces it.
    figure.rotation.y = meshPose ? 0 : stroll.heading
    // The audio hears scene time twice a second, so the office tube buzzes when its light flickers.
    if (environmentMotion.value) { elapsed += delta; if (Math.floor(elapsed * 2) !== Math.floor((elapsed - delta) * 2)) emit('time', elapsed) }
    world.update({ time: elapsed, pressure: talking ? 0.25 : 0, settings: settings.value, light })
    if (faceMotion) faceElapsed += delta
    if (lastReaction !== reaction) { lastReaction = reaction; reactionStarted = faceElapsed }
    // A hovering visitor or the dialog draws the mesh's head to the camera. A hover alone adds a curious tilt, as on the relief rig.
    // Reduced motion and Motion off keep the pose.
    const ease = Math.min(1, delta * 4)
    // At the end of the critical scene he turns from the keys and speaks to the visitor.
    const addressing = scripted?.work === 'Address'
    attention.weight = faceMotion ? attention.weight + (Number(talking || (hovered.value && !journey) || act.watches || addressing) - attention.weight) * ease : 0
    attention.tilt = faceMotion ? attention.tilt + ((hovered.value && !paused && !journey ? 0.07 : 0) - attention.tilt) * ease : 0
    const watch = { target: camera.position, weight: attention.weight, tilt: attention.tilt }
    if (mascot._tag === 'Mesh' && !meshPose) mascot.update(faceElapsed, watch)
    else {
      // A dialog beat and a walk-pause habit can overlap. Reduced motion and Motion off show neither.
      const layers: MannerismLayer[] = faceMotion ? [{ mannerism: beatMannerism(beat), age: faceElapsed - reactionStarted }] : []
      // He performs no habit on a journey: its one stop is the way out.
      // His stop at the switch is no stop of his loop, so it has no habit either.
      const stop = journey || act.held || counting ? undefined : stopNow()
      if (stop !== stoppedAt) {
        if (stop !== undefined) stopVisits = Object.assign([...stopVisits], { [stop]: (stopVisits[stop] ?? 0) + 1 })
        stoppedAt = stop
        stationReady = undefined
      }
      // At a station he is turned to his work, so his working arm is the one on the side he turned to.
      const station = stop === undefined || !meshPose ? undefined : layout.walkFacings?.[stop]
      // He begins his work only when he faces it. Before that his body still turns, and a lifted arm would cross his head.
      const away = station === undefined ? 0 : Math.abs(turn.heading - station)
      if (station !== undefined && stationReady === undefined && away < 0.2 && stroll.activity._tag === 'Pausing') stationReady = stroll.activity.age
      const habits = roundHabits(layout.walkHabits, layout.walkAlternates, stopVisits)
      const habit = !faceMotion || journey || act.held ? undefined
        : station === undefined ? pauseMannerism(stroll, habits) : stationMannerism(stroll, habits, stationReady, 1 - (away - 0.2) / 0.5)
      // A habit turns his head away: to the ceiling, to a palm, to the eggs. In a conversation he faces the visitor.
      // A habit that kept playing as the dialog opened left him tilted in the close shot, so it fades out with the dialog and back in after it.
      habitWeight = faceMotion ? habitWeight + ((talking ? 0 : 1) - habitWeight) * Math.min(1, delta * 5) : 1
      if (habit) layers.push({ ...habit, weight: habitWeight * (habit.weight ?? 1), side: station === undefined ? undefined : station < 0 ? -1 : 1 })
      // His work makes its own sound: a click for each key, and the jar bubbles once as he turns it.
      const taps = habit?.mannerism._tag === 'TypeKeys' && !talking ? keyTaps(habit.age) : 0
      if (taps > workTaps) emit('action', 'KeyClick')
      workTaps = taps
      const tending = habit?.mannerism._tag === 'TendJar' && !talking && habit.age > 1.2
      if (tending && !workTending) emit('action', 'JarBubbles')
      workTending = tending
      const strokes = habit?.mannerism._tag === 'WriteBoard' && !talking ? markerStrokes(habit.age) : 0
      if (strokes > workStrokes) emit('action', 'MarkerSqueak')
      workStrokes = strokes
      const smacks = habit?.mannerism._tag === 'SmackMachine' && !talking ? machineSmacks(habit.age) : 0
      if (smacks > workSmacks) emit('action', 'MachineThump')
      workSmacks = smacks
      // Directional habits turn toward the nearer egg cluster. Screen right is +x.
      const side = nearestEggs().x >= figure.position.x ? 1 : -1
      const sided: MannerismLayer[] = layers.map(layer => ({ ...layer, side: layer.side ?? side }))
      // The entrance has two gestures of its own: his reach for the switch, and his greeting after the turn.
      if (faceMotion && act.reach !== undefined) sided.push({ mannerism: { _tag: 'ReachSwitch' }, age: act.reach, side: switchSide })
      if (faceMotion && act.greet !== undefined) sided.push({ mannerism: { _tag: 'Greet' }, age: act.greet, side: switchSide })
      if (dancing && beats !== undefined) sided.push({ mannerism: { _tag: 'Dance' }, age: beats, weight: habitWeight, side })
      // The critical scene gives his body work at every moment, so he never stands idle while it runs.
      const arrived = stroll.activity._tag === 'Pausing'
      const working = scripted && arrived ? scripted.work : ''
      if (working !== workKey) { workKey = working; workAge = 0; typeTaps = 0 }
      else workAge += delta
      if (faceMotion && scripted && criticalAge !== undefined) {
        // A wing of his jumps at each green arc, wherever he is.
        if (faceElapsed - arcAt < 0.8) sided.push({ mannerism: { _tag: 'WingTwitch' }, age: faceElapsed - arcAt, side })
        // He leans in to the chamber and looks into it as it draws the specimens in.
        if (working === 'Peer') sided.push({ mannerism: { _tag: 'LeanIn' }, age: Math.min(workAge, 1.2), side }, { mannerism: { _tag: 'GlanceEggs' }, age: Math.min(workAge, 1.1), side })
        // It spits snails at him. His jaw catches, and his wings buzz again and again.
        if (scripted.work === 'Flinch') {
          const since = criticalAge - criticalSpurtAt
          sided.push({ mannerism: { _tag: 'JawCatch' }, age: since, side }, { mannerism: { _tag: 'WingBuzz' }, age: since % 1.2, side }, { mannerism: { _tag: 'GlanceEggs' }, age: 1.1, side })
        }
        // At the computer he hammers the keys to stop it, once he faces them. Each key clicks.
        if (working === 'Type' && stage && Math.abs(turn.heading - stage.deskFacing) < 0.35) {
          const age = 0.6 + workAge % 5.2
          const taps = keyTaps(age)
          if (taps > typeTaps) emit('action', 'KeyClick')
          typeTaps = taps
          sided.push({ mannerism: { _tag: 'TypeKeys' }, age, side })
        }
        // The keys did nothing. He turns to the visitor and leans to them for his last line.
        if (scripted.work === 'Address') sided.push({ mannerism: { _tag: 'LeanIn' }, age: Math.min(criticalAge - criticalAddressAt, 1.2), side })
      }
      // During the count he counts: he looks up at what falls, reads his palm, writes in the air, glances at the chamber, and rubs his small hands, one after the other.
      // A line of his has its own gesture, and the count waits for it.
      else if (faceMotion && busyPlace && arrived && !talking && faceElapsed - reactionStarted > 3) {
        busyAge += delta
        const turns = ['ListenCeiling', 'CheckPalm', 'AirWriting', 'GlanceEggs', 'RubHands'] as const
        sided.push({ mannerism: { _tag: turns[Math.floor(busyAge / 2.8) % turns.length]! }, age: busyAge % 2.8, weight: habitWeight, side })
      }
      const mannerism = poseMannerisms(sided)
      // He looks around on his own. A hovering visitor or the dialog draws both pupils to the camera. A habit's cue wins while it lasts.
      const eyes = !faceMotion ? { _tag: 'Ahead' } as const
        : mannerism.eyes && mannerism.eyes.weight > 0.3 ? { _tag: 'Watch', target: cueTarget(mannerism.eyes.cue) } as const
          : talking || (hovered.value && !journey) || act.watches || addressing ? { _tag: 'Watch', target: camera.position } as const : { _tag: 'Wander' } as const
      const input = { time: faceElapsed, pressure: 0, pointer, transform: 'squeeze' as const, ...pose, eyes, mannerism,
        speaking: faceMotion ? speaking : 0,
        brow: thinking ? 0.12 + (faceMotion ? Math.sin(faceElapsed * 1.6) * 0.025 : 0)
          : mood === 'curious' ? 0.2 : mood === 'wary' ? 0.14 : mood === 'amused' ? 0.08 : 0,
        squint: thinking ? 0.06 : mood === 'wary' ? 0.14 : mood === 'amused' ? 0.1 : mood === 'soft' ? 0.04 : 0 }
      if (meshPose) meshPose({ ...input, stepInPlace: turn.steps, stepPhase: turn.phase }, watch, turn.heading)
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
    // The page puts his spoken line over his head. It hides the line while he is out of the picture.
    anchor('--head-x', `${((bounds.left + bounds.right) / 2).toFixed(0)}px`)
    anchor('--head-y', `${Math.max(0, bounds.top).toFixed(0)}px`)
    anchor('--head-shown', bounds.right > 0 && bounds.left < renderWidth && bounds.top < renderHeight * 0.75 && stationShare < 0.5 ? '1' : '0')
    reflection?.update(settings.value.wetness)
    // Under a screen that covers the page, a new picture is work nobody sees.
    if (covered && stationShare === 1) return
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
    stage?.dispose(); snails?.dispose(); stationAt = undefined
    strike(standing); mirror?.dispose(); mascot.dispose(); loadedTextures.forEach(value => value.dispose())
    staging?.key.dispose(); staging?.rim.dispose()
    shadowGeometry.dispose(); shadowMaterial.dispose(); renderer.dispose()
    footShadowGeometry.dispose(); footShadows.forEach(patch => patch.material.dispose())
  }
  status.value = { _tag: 'Ready' }
  // The page can change the set it wants before the first picture, so the scene says which set it raised and that the visitor sees it.
  emit('shown', standing.stage.name, 'arrived')
  emit('view', standing.stage.name)
  refresh()
}, { flush: 'post', once: true })
</script>

<template>
  <div ref="host" class="world-scene" :data-set="shownSet" :data-vignette="vignette" :data-travel="travelPhase" :data-entrance="entrancePhase" :data-renderer="status._tag" :data-mascot="shownMascot" :data-mascot-motion="mascotMotion" :data-quality="shownQuality" :aria-busy="status._tag === 'Loading'">
    <canvas ref="canvas" aria-hidden="true" />
    <div v-if="status._tag === 'Ready'" class="world-vignette" :class="{ 'world-vignette-close': paused && travelPhase === 'Home' && shownMascot === 'mesh' }" aria-hidden="true" />
    <div v-if="status._tag === 'Ready' && flash > 0" class="world-flash" :style="{ opacity: flash }" aria-hidden="true" />
    <div v-if="status._tag === 'Ready'" class="world-dark" :style="{ opacity: shade }" aria-hidden="true" />
    <SceneLoading v-if="status._tag === 'Loading'" />
    <img v-if="status._tag === 'Fallback'" class="world-fallback" src="/brand/character.png" alt="" width="1199" height="1312">
    <button ref="interaction" class="world-interaction" :class="{ 'mascot-hover': hovered || overProp }" :disabled="status._tag === 'Loading'" :aria-label="station === 'room' ? 'Talk to Brundlefly' : 'Return to the room'" @pointerdown="beginView" @pointermove="move" @pointerup="endView" @pointercancel="endView" @lostpointercapture="endView" @pointerleave="hovered = false; overProp = false" @click="select" />
    <p v-if="status._tag === 'Fallback'" class="world-status" role="status">{{ status.reason === 'context' ? 'Static scene. WebGL is unavailable.' : 'The scene could not load.' }}</p>
    <p v-if="tuning && station === 'code'" class="world-tune" role="status">glass {{ codeLook.glass.toFixed(2) }} · bugs {{ codeLook.bugs.toFixed(2) }} · arrow keys change them</p>
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
/* A lit room needs only a faint dark edge, at rest and in a talk. */
.world-scene[data-vignette="Light"] .world-vignette { background: radial-gradient(ellipse 80% 76% at 50% 50%, transparent 60%, rgb(8 11 8 / 0.3) 100%); }
.world-scene[data-vignette="Light"] .world-vignette::after { background: radial-gradient(ellipse 64% 68% at 50% 34%, transparent 46%, rgb(8 11 8 / 0.3) 100%); }
/* A journey to another set darkens the whole picture. The scene sets how dark, frame by frame. */
.world-dark { position: absolute; inset: 0; pointer-events: none; background: var(--color-night); }
/* The light of the test chamber takes the picture in the critical scene. The dark that follows lies over it. */
.world-flash { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 90% 90% at 62% 40%, #F2FFFA, #BFF3E8 70%, #7FD8CC); }
.world-tune { position: absolute; left: 16px; bottom: 16px; margin: 0; padding: 6px 10px; color: var(--color-cream); background: #080b08cc; font: 13px var(--font-mono); pointer-events: none; }
.world-interaction { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; cursor: default; touch-action: none; }
.world-interaction.mascot-hover { cursor: pointer; }
.world-interaction:focus-visible { outline: 2px solid var(--color-cream); outline-offset: -8px; }
.world-fallback { position: absolute; inset: 10% 0; margin: auto; height: 80%; width: 80%; object-fit: contain; image-rendering: pixelated; }
.world-status { position: absolute; bottom: 1rem; left: 1rem; right: 1rem; text-align: center; font: 12px var(--font-mono); color: var(--color-wing); }
</style>
