import assert from 'node:assert/strict'
import test from 'node:test'
import { lookToward, pupilDirection, wanderingLook } from '../layers/brand/shared/eye-gaze.ts'

const frame = 1 / 60
const sweep = (seconds: number) => Array.from({ length: Math.ceil(seconds / frame) }, (_, index) => wanderingLook(index * frame))

test('wandering eyes look left, right, up, and down, and stay inside the socket', () => {
  const looks = sweep(30)
  const xs = looks.map(look => look.x), ys = looks.map(look => look.y)
  assert.ok(Math.min(...xs) < -0.6 && Math.max(...xs) > 0.6, 'He must glance to both sides.')
  assert.ok(Math.min(...ys) < -0.2 && Math.max(...ys) > 0.3, 'He must glance up and down.')
  assert.ok(looks.every(({ x, y }) => Math.abs(x) <= 1 && Math.abs(y) <= 1), 'The pupil must stay within its travel.')
})

test('each glance is a quick jump followed by a hold', () => {
  const looks = sweep(30)
  let moving = 0, longest = 0, still = 0
  looks.slice(1).forEach((look, index) => {
    const step = Math.hypot(look.x - looks[index]!.x, look.y - looks[index]!.y)
    moving = step > 1e-4 ? moving + 1 : 0
    longest = Math.max(longest, moving)
    if (step <= 1e-4) still++
  })
  assert.ok(longest * frame <= 0.1, `A saccade must land within 0.1 s, measured ${(longest * frame).toFixed(3)} s.`)
  assert.ok(still / looks.length > 0.9, 'The eyes must hold most fixations instead of drifting constantly.')
})

test('watching aims the pupil at the target and clamps beyond the socket', () => {
  assert.deepEqual(lookToward({ x: 0, y: 0, z: 3 }), { x: 0, y: 0 })
  const side = lookToward({ x: 0.6, y: 0.3, z: 2 })
  assert.ok(side.x > 0 && side.y > 0, 'A target to the upper right must turn the pupil up and right.')
  const aim = pupilDirection(side)
  const length = Math.hypot(0.6, 0.3, 2)
  assert.ok(Math.abs(aim.x - 0.6 / length) < 1e-6 && Math.abs(aim.y - 0.3 / length) < 1e-6 && Math.abs(aim.z - 2 / length) < 1e-6,
    'A reachable target must sit exactly on the pupil axis.')
  assert.deepEqual(lookToward({ x: 5, y: -5, z: 0.1 }), { x: 1, y: -1 }, 'A target behind the head must clamp to the socket edge.')
})
