import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { advanceConversationFocus, blendCameraShot, defaultCameraView, followTiltRest, moveCameraView, resolveCameraView, resolveConversationCloseUp, resolveConversationFocus, resolveDialogClearance, resolveResponsiveCameraFraming, resolveTiltView, rotateCameraView, tiltCameraView, tiltPose } from '../layers/brand/shared/camera-view.ts'

test('mouse look permits a full turn and limits pitch before the view flips', () => {
  const view = rotateCameraView(defaultCameraView, Math.PI * 2 / 0.0028, 10000)
  assert.ok(Math.abs(view.yaw) < 1e-10)
  assert.equal(view.pitch, 1.15)
  const reverse = rotateCameraView(view, 0, -10000)
  assert.equal(reverse.pitch, -1.15)
})

test('opposite keys cancel, diagonal travel keeps the same slow ground speed', () => {
  assert.deepEqual(moveCameraView(defaultCameraView, new Set(['KeyW', 'KeyS']), 0.05), defaultCameraView)
  const straight = moveCameraView(defaultCameraView, new Set(['KeyW']), 0.05)
  const diagonal = moveCameraView(defaultCameraView, new Set(['KeyW', 'KeyD']), 0.05)
  assert.ok(straight.z < 0)
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - Math.abs(straight.z)) < 1e-10)
})

test('held movement remains inside travel bounds', () => {
  let view = { ...defaultCameraView }
  for (let index = 0; index < 1000; index++) view = moveCameraView(view, new Set(['KeyW', 'KeyD']), 0.05)
  assert.equal(view.x, 1.4)
  assert.equal(view.z, -1.4)
})

test('looking turns the view while the camera remains at the player position', () => {
  const standing = { ...defaultCameraView, x: 0.5, z: -0.75 }
  const turned = rotateCameraView(standing, 90, 30)
  const before = resolveCameraView(standing, [0, 0.75, 10.4], [0, -0.35, -2.1], 1)
  const after = resolveCameraView(turned, [0, 0.75, 10.4], [0, -0.35, -2.1], 1)
  assert.deepEqual(before.position, after.position)
  assert.notDeepEqual(before.target, after.target)
  assert.ok(after.target[0] > before.target[0])
})

test('forward movement follows the direction the player faces', () => {
  const view = { ...defaultCameraView, yaw: 0.35 }
  const moved = moveCameraView(view, new Set(['KeyW']), 0.05)
  assert.ok(moved.x > 0)
  assert.ok(moved.z < 0)
  assert.ok(Math.abs(moved.x / -moved.z - Math.tan(view.yaw)) < 1e-10)
})

test('zoom and portrait framing retain player travel without orbiting the position', () => {
  const view = { yaw: 0.3, pitch: -0.1, x: 1, z: -1 }
  const desktop = resolveCameraView(view, [0, 0.75, 10.4], [0, -0.35, -2.1], 1)
  const portrait = resolveCameraView(view, [0, 1.1, 15.2], [0, -0.35, -2.1], 0.85)
  assert.equal(desktop.position[0], view.x)
  assert.equal(portrait.position[0], view.x)
  assert.equal(desktop.position[2], 10.4 + view.z)
  assert.equal(portrait.position[2], 15.2 / 0.85 + view.z)
  assert.ok(desktop.position[1] >= 0.15 && portrait.position[1] >= 0.15)
})

test('mobile staging brings the character closer and reduces optical fog without changing desktop staging', () => {
  const desktop = [0, 0.75, 10.4] as const
  const portrait = [0, 1.1, 15.2] as const
  const wide = resolveResponsiveCameraFraming(desktop, portrait, 1440 / 1000)
  assert.deepEqual(wide, { framing: desktop, fieldOfView: 44, fogScale: 1 })
  const narrow = resolveResponsiveCameraFraming(desktop, portrait, 375 / 812)
  const view = { ...defaultCameraView, x: 0.5, z: -0.75 }
  const camera = resolveCameraView(view, narrow.framing, [0, -0.35, -2.1], 0.9)
  assert.equal(camera.position[0], view.x)
  assert.equal(camera.position[2], 8.32 / 0.9 + view.z)
  assert.equal(narrow.framing[1], desktop[1])
  assert.ok(narrow.fogScale > 0.8 && narrow.fogScale < 0.9)
  // Fog transmission at the character grows from near-black to readable tissue.
  const oldTransmission = Math.exp(-Math.pow(0.075 * (portrait[2] / 0.9 + 0.8), 2))
  const newTransmission = Math.exp(-Math.pow(0.075 * narrow.fogScale * (narrow.framing[2] / 0.9 + 0.8), 2))
  assert.ok(newTransmission > oldTransmission * 3)
})

const pose = (alpha: number, beta: number, gamma: number, screenAngle = 0) => tiltPose({ alpha, beta, gamma }, screenAngle)

test('turning a phone like a window looks the same way', () => {
  const rest = pose(0, 60, 0)
  assert.ok(resolveTiltView(pose(-20, 60, 0), rest).yaw > 0.2, 'Turning right must look right.')
  assert.ok(resolveTiltView(pose(20, 60, 0), rest).yaw < -0.2, 'Turning left must look left.')
  assert.ok(resolveTiltView(pose(0, 80, 0), rest).pitch < -0.2, 'Raising the phone must look up.')
  assert.deepEqual(resolveTiltView(rest, rest), { yaw: 0, pitch: 0 })
})

test('an upright phone turns smoothly where its tilt angles flip', () => {
  const rest = pose(0, 90, 0)
  const turns = [-10, -5, 0, 5, 10].map(alpha => resolveTiltView(pose(alpha, 90, 0), rest).yaw)
  turns.slice(1).forEach((yaw, index) => assert.ok(yaw < turns[index]! && turns[index]! - yaw < 0.1, 'Each small turn must move the view a small step.'))
  assert.ok(Math.abs(resolveTiltView(pose(0, 95, 0), rest).yaw) < 0.01, 'Leaning past upright must not swing the view sideways.')
})

test('landscape phones look the same way as they turn', () => {
  for (const screenAngle of [90, 270]) {
    const rest = pose(0, 0, screenAngle === 90 ? -80 : 80, screenAngle)
    const turned = pose(-20, 0, screenAngle === 90 ? -80 : 80, screenAngle)
    assert.ok(resolveTiltView(turned, rest).yaw > 0.2, `Turning right at ${screenAngle} degrees must look right.`)
  }
})

test('tilt looks around gently and composes with the dragged view', () => {
  assert.ok(resolveTiltView(pose(-80, 60, 0), pose(0, 60, 0)).yaw === 0.45, 'A large turn must stay within a gentle look range.')
  const view = tiltCameraView({ ...defaultCameraView, yaw: 1, pitch: 1.1 }, { yaw: 0.2, pitch: 0.3 })
  assert.equal(view.yaw, 1.2)
  assert.equal(view.pitch, 1.15)
})

test('a held phone pose slowly becomes the new rest pose, and a flip rebases at once', () => {
  const turned = pose(-20, 60, 0)
  let rest = followTiltRest(undefined, pose(0, 60, 0), 0)
  rest = followTiltRest(rest, turned, 0.016)
  assert.ok(resolveTiltView(turned, rest).yaw > 0.2, 'A fresh turn must still look aside.')
  for (let frame = 0; frame < 60 * 30; frame++) rest = followTiltRest(rest, turned, 1 / 60)
  assert.ok(Math.abs(resolveTiltView(turned, rest).yaw) < 0.01, 'Holding the turn must recentre the view.')
  const flipped = pose(-20, 60, 0, 90)
  assert.ok(followTiltRest(rest, flipped, 1 / 60).angleTo(flipped) < 1e-6, 'A screen rotation must rebase at once.')
})

const talkingFace = (width: number, height: number) => {
  const face = new Vector3(0.9, -0.4, -0.7)
  const { fieldOfView } = resolveResponsiveCameraFraming([0, 0.75, 10.4], [0, 1.1, 15.2], width / height)
  const focus = resolveConversationFocus(face, width, height, fieldOfView)
  const camera = new PerspectiveCamera(fieldOfView, width / height, 0.1, 50)
  camera.position.copy(focus.position)
  camera.lookAt(focus.target)
  camera.updateMatrixWorld()
  const point = face.clone().project(camera)
  return { x: (point.x + 1) / 2 * width, y: (1 - point.y) / 2 * height }
}

test('a talking face stays above the bottom dialog on portrait phones and desktops', () => {
  for (const [width, height] of [[360, 640], [390, 844], [1440, 900]] as const) {
    const face = talkingFace(width, height)
    assert.ok(face.y > height * 0.15 && face.y < height * 0.38, `${width}x${height}: face at ${face.y}`)
    assert.ok(Math.abs(face.x - width / 2) < 1, `${width}x${height}: face must stay centred`)
  }
})

test('a talking face moves left of the side dialog on short landscape screens', () => {
  for (const [width, height] of [[667, 375], [844, 390], [1280, 500]] as const) {
    const face = talkingFace(width, height)
    // The dialog takes up to 400px of the right side, plus its 12px edge.
    const free = width - Math.min(400, width / 2) - 12
    assert.ok(Math.abs(face.x - free / 2) < free * 0.08, `${width}x${height}: face at ${face.x}, free area ${free}`)
    assert.ok(face.y > height * 0.3 && face.y < height * 0.55, `${width}x${height}: face at ${face.y}`)
  }
})

const closeFace = (width: number, height: number, side: 1 | -1, drift = 0) => {
  const face = new Vector3(0.9, -0.4, -0.7)
  const { fieldOfView } = resolveResponsiveCameraFraming([0, 0.75, 10.4], [0, 1.1, 15.2], width / height)
  const shot = resolveConversationCloseUp(face, width, height, fieldOfView, side, drift)
  const camera = new PerspectiveCamera(fieldOfView, width / height, 0.1, 50)
  camera.position.copy(shot.position)
  camera.lookAt(shot.target)
  camera.updateMatrixWorld()
  const [point, crown, mouth] = [0, 0.5, -0.5].map(rise => face.clone().add(new Vector3(0, rise, 0)).project(camera))
  const row = (y: number) => (1 - y) / 2 * height
  return { x: (point!.x + 1) / 2 * width, y: row(point!.y), top: row(crown!.y), bottom: row(mouth!.y), shot, face }
}

test('the head-and-shoulders shot keeps his eyes, and the half unit of head above and below them, in the area the dialog leaves free', () => {
  for (const side of [1, -1] as const) {
    // Drift 7.5 s is the widest swing of the camera's angle.
    for (const drift of [0, 7.5]) {
      for (const [width, height] of [[1280, 800], [1440, 900], [1280, 600], [720, 560], [375, 812], [360, 640]] as const) {
        const face = closeFace(width, height, side, drift)
        assert.ok(Math.abs(face.x - width / 2) < 1, `${width}x${height}: face must stay centred`)
        // The dialog is about 270 pixels tall, or 300 on a phone, and never more than 46% or 52% of the height.
        // It stands 20 or 10 pixels off the bottom edge, and its seam rises 16 pixels. His head and mouthparts must clear all of it.
        const free = height - 16 - (width <= 600 ? 10 + Math.min(300, height * 0.52) : 20 + Math.min(270, height * 0.46))
        assert.ok(face.top > 0 && face.bottom < free, `${width}x${height}: head from ${face.top} to ${face.bottom}, free to ${free}`)
      }
      for (const [width, height] of [[667, 375], [844, 390], [1280, 500]] as const) {
        const face = closeFace(width, height, side, drift)
        const free = width - Math.min(400, width / 2) - 12
        assert.ok(Math.abs(face.x - free / 2) < free * 0.08, `${width}x${height}: face at ${face.x}, free area ${free}`)
        assert.ok(face.y > height * 0.3 && face.y < height * 0.55, `${width}x${height}: face at ${face.y}`)
      }
    }
  }
})

test('the head-and-shoulders shot stands near him, in front, on the side he faces', () => {
  for (const side of [1, -1] as const) {
    const { shot, face } = closeFace(1280, 800, side)
    const wide = resolveConversationFocus(face, 1280, 800, 44)
    assert.ok(shot.position.distanceTo(face) < wide.position.distanceTo(face) * 0.7, 'The close shot must stand well inside the full-body shot.')
    assert.equal(Math.sign(shot.position.x - face.x), side)
    assert.ok(shot.position.z > face.z + 2, 'The camera must stay in front of him.')
    // His head turns 0.6 rad at most. From a 0.5 rad stance the camera must stay inside that reach.
    const bearing = Math.atan2(shot.position.x - face.x, shot.position.z - face.z)
    assert.ok(Math.abs(side * 0.5 - bearing) < 0.6, `The camera stands ${bearing} rad to the side.`)
  }
})

test('the head-and-shoulders shot drifts slowly and stays near its first frame', () => {
  const still = closeFace(1280, 800, 1).shot
  let farthest = 0
  for (let time = 0; time < 120; time += 0.5) {
    const now = closeFace(1280, 800, 1, time).shot
    const next = closeFace(1280, 800, 1, time + 1 / 60).shot
    farthest = Math.max(farthest, now.position.distanceTo(still.position))
    assert.ok(next.position.distanceTo(now.position) < 0.0006, `The camera moves too fast at ${time} s.`)
  }
  assert.ok(farthest > 0.05 && farthest < 0.2, `The camera drifts ${farthest} units.`)
})

test('the conversation close-up settles and holds still while the dialog stays open', () => {
  let progress = 0
  const opened: number[] = []
  for (let frame = 0; frame < 90; frame++) opened.push(progress = advanceConversationFocus(progress, true, 1 / 60, false))
  assert.ok(opened.slice(1).every((value, index) => value >= opened[index]!), 'Opening must never ease back out.')
  assert.deepEqual(opened.slice(60), Array(30).fill(1), 'An open dialog must hold the close-up exactly.')
  const closed: number[] = []
  for (let frame = 0; frame < 90; frame++) closed.push(progress = advanceConversationFocus(progress, false, 1 / 60, false))
  assert.deepEqual(closed.slice(60), Array(30).fill(0), 'A closed dialog must hold the free view exactly.')
  assert.equal(advanceConversationFocus(0, true, 1 / 60, true), 1, 'Reduced motion must cut straight to the close-up.')
})

test('a view turned away from the mascot swings to his face without a snap', () => {
  const face = new Vector3(0.9, 0.7, -0.3)
  const focus = resolveConversationFocus(face, 1440, 900, 44)
  for (const view of [{ ...defaultCameraView, yaw: 3 }, { ...defaultCameraView, yaw: -2.2, pitch: -1.1 }, { ...defaultCameraView, pitch: 1.15 }]) {
    const free = resolveCameraView(view, [0, 0.75, 10.4], [0, -0.35, -2.1], 1.2)
    const from = { position: new Vector3(...free.position), target: new Vector3(...free.target) }
    const shots = Array.from({ length: 40 }, (_, step) => {
      const progress = step / 39
      return blendCameraShot(from, focus, progress * progress * (3 - 2 * progress))
    })
    const turns = shots.slice(1).map((shot, index) => shot.quaternion.angleTo(shots[index]!.quaternion))
    const mean = turns.reduce((sum, value) => sum + value, 0) / turns.length
    // A smoothstep ease peaks at 1.5 times its mean speed. A snap concentrates the turn in a few steps.
    assert.ok(Math.max(...turns) < mean * 1.6, `The turn must stay eased, measured peak ${Math.max(...turns)} against mean ${mean}.`)
    const facing = (shot: { quaternion: Quaternion }) => new Vector3(0, 0, -1).applyQuaternion(shot.quaternion)
    assert.ok(facing(shots.at(-1)!).angleTo(focus.target.clone().sub(focus.position)) < 1e-6, 'The blend must finish looking at his face.')
    assert.ok(facing(shots[0]!).angleTo(from.target.clone().sub(from.position)) < 1e-6, 'The blend must start from the free view.')
  }
})

test('a journey with the dialog open moves the wide view by half of what the dialog covers', () => {
  // A phone: the dialog covers 326 of 844 pixels. The middle of the view must move up by 163 pixels.
  const phone = resolveDialogClearance(390, 844, 50)
  assert.ok(Math.abs(Math.tan(phone.pitch) / Math.tan(50 * Math.PI / 360) * 844 / 2 - 163) < 0.5)
  assert.equal(phone.yaw, 0)
  // A short landscape screen has its dialog at the right: 412 of 844 pixels. The view turns right, so its middle moves 206 pixels left.
  const sideways = resolveDialogClearance(844, 390, 44)
  assert.equal(sideways.pitch, 0)
  assert.ok(Math.abs(Math.tan(sideways.yaw) / (Math.tan(44 * Math.PI / 360) * 844 / 390) * 844 / 2 - 206) < 0.5)
  const desktop = resolveDialogClearance(1280, 720, 44)
  assert.ok(desktop.pitch > 0 && desktop.yaw === 0)
})
