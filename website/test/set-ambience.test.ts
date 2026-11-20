import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ambienceFadeSeconds, ambienceForSet, ambienceShares, audioTimeAt, fadeEnd, fadeProgress, restingFade, sceneClockRuns, sceneTimeAt, syncSceneClock, turnFade } from '../shared/set-ambience.ts'
import { travelTimes } from '../layers/brand/shared/set-travel.ts'

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`)
const power = (shares: Partial<Record<'Cave' | 'Office', number>>) => (shares.Cave ?? 0) ** 2 + (shares.Office ?? 0) ** 2

test('each set names its ambience', () => {
  assert.equal(ambienceForSet('lair'), 'Cave')
  assert.equal(ambienceForSet('office'), 'Office')
})

test('a resting ambience plays alone at its full level', () => {
  assert.deepEqual(ambienceShares(restingFade('Cave'), 12), { Cave: 1 })
  const rest = restingFade('Office')
  assert.equal(turnFade(rest, 'Office', 3), rest)
})

test('a journey cross-fades the two ambiences over the time the picture returns', () => {
  const fade = turnFade(restingFade('Cave'), 'Office', 10)
  near(fadeEnd(fade) - 10, travelTimes.fadeIn)
  assert.deepEqual(ambienceShares(fade, 10), { Cave: 1, Office: 0 })
  assert.deepEqual(ambienceShares(fade, 10 + ambienceFadeSeconds + 1e-9), { Office: 1 })
  const middle = ambienceShares(fade, 10 + ambienceFadeSeconds / 2)
  assert.ok(Math.abs(middle.Cave! - middle.Office!) < 1e-9)
  let last = 1
  for (let time = 10; time <= 10 + ambienceFadeSeconds; time += 0.01) {
    const shares = ambienceShares(fade, time)
    // Equal power: two unrelated sounds never sum above the louder one.
    assert.ok(Math.abs(power(shares) - 1) < 1e-9)
    assert.ok((shares.Cave ?? 0) <= last)
    last = shares.Cave ?? 0
  }
})

test('a journey that turns back fades from where the sound is, in less time', () => {
  const out = turnFade(restingFade('Cave'), 'Office', 10)
  const turned = 10 + ambienceFadeSeconds * 0.3
  const back = turnFade(out, 'Cave', turned)
  const before = ambienceShares(out, turned)
  const after = ambienceShares(back, turned)
  assert.ok(Math.abs(before.Cave! - after.Cave!) < 1e-9 && Math.abs(before.Office! - after.Office!) < 1e-9)
  assert.ok(Math.abs(fadeEnd(back) - turned - ambienceFadeSeconds * 0.3) < 1e-9)
  assert.deepEqual(ambienceShares(back, fadeEnd(back) + 1e-9), { Cave: 1 })
})

test('a journey after a finished journey is a whole new fade', () => {
  const out = turnFade(restingFade('Cave'), 'Office', 0)
  const back = turnFade(out, 'Cave', 5)
  assert.equal(fadeProgress(back, 5), 0)
  assert.deepEqual(ambienceShares(back, 5), { Office: 1, Cave: 0 })
})

test('the scene clock follows a scene that runs slower than the audio', () => {
  const first = syncSceneClock(undefined, 4, 100)
  assert.equal(sceneTimeAt(first, 100.5), 4.5)
  // A slow device: half a scene second passed in one audio second.
  const slow = syncSceneClock(first, 4.5, 101)
  assert.equal(slow.rate, 0.5)
  near(sceneTimeAt(slow, 101.4), 4.7)
  assert.ok(Math.abs(audioTimeAt(slow, sceneTimeAt(slow, 101.37)) - 101.37) < 1e-9)
  // A scene that went back or jumped ahead, or a report after a long pause, starts again at the audio's rate.
  assert.equal(syncSceneClock(slow, 2, 102).rate, 1)
  assert.equal(syncSceneClock(slow, 9, 102).rate, 1)
  assert.equal(syncSceneClock(slow, 30, 140).rate, 1)
})

test('a scene clock with no recent report stands still', () => {
  const clock = syncSceneClock(undefined, 4, 100)
  assert.equal(sceneClockRuns(undefined, 100), false)
  assert.equal(sceneClockRuns(clock, 101), true)
  assert.equal(sceneClockRuns(clock, 102), false)
})
