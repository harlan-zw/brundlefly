import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tubeFlicker } from '../layers/brand/shared/office-flicker.ts'
import { flickerBuzz } from '../shared/office-ambience.ts'
import { createSceneAudio } from '../shared/scene-audio.ts'
import { ambienceFadeSeconds } from '../shared/set-ambience.ts'

type Target = { value: number, time: number, constant: number }
// What a gain is set to do, in the order it was set. `live` is false once the graph has released the gain's node.
type Plan = { events: { value: number, time: number, constant?: number }[], live: () => boolean }
// Where a gain ends: its latest event, and the later one of two at the same time.
const ending = (plan: Plan) => plan.events.reduce((last, event) => event.time >= last.time ? event : last)
// A context that counts what the graph builds and starts. `steady` counts the layers that run until they are stopped.
// `shots` counts the short sounds, which start at a set time. `clock` moves audio time and runs the graph's 50 ms tick.
function stage() {
  const targets: Target[] = []
  const plans: Plan[] = []
  const timers = new Map<number, { callback: () => void, delay: number }>()
  const count = { steady: 0, shots: 0, rooms: 0, timer: 0 }
  let state = 'suspended'
  const param = (live: () => boolean = () => true) => {
    const plan: Plan = { events: [], live }
    plans.push(plan)
    return {
      value: 0, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setValueCurveAtTime() {},
      setValueAtTime(value: number, time: number) { plan.events.push({ value, time }) },
      cancelScheduledValues(time: number) { plan.events = plan.events.filter(event => event.time < time) },
      setTargetAtTime(value: number, time: number, constant: number) { plan.events.push({ value, time, constant }); targets.push({ value, time, constant }) },
    }
  }
  const node = () => {
    let steady = false
    let connected = true
    return {
      gain: param(() => connected), frequency: param(), Q: param(), pan: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
      connect(next: unknown) { return next }, disconnect() { connected = false },
      start(at?: number) { if (at === undefined) { steady = true; count.steady++ } else count.shots++ },
      stop(at?: number) { if (at === undefined && steady) { steady = false; count.steady-- } },
    }
  }
  const context = {
    currentTime: 0, sampleRate: 20, destination: node(), get state() { return state },
    createGain: node, createDynamicsCompressor: node, createBiquadFilter: node, createOscillator: node,
    createBufferSource: node, createStereoPanner: node, createWaveShaper: node,
    createConvolver: () => { count.rooms++; return node() },
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    async resume() { state = 'running' }, async suspend() { state = 'suspended' }, async close() { state = 'closed' },
  }
  const audio = createSceneAudio({
    createContext: () => context as unknown as AudioContext, random: () => 0.5,
    schedule: (callback, delay) => { timers.set(++count.timer, { callback, delay }); return count.timer },
    cancel: id => { timers.delete(id) },
    onState: () => {}, onVoice: () => {}, onError: (error) => { throw error },
  })
  const clock = (seconds: number) => {
    for (let step = 0; step < Math.round(seconds / 0.05); step++) {
      context.currentTime += 0.05
      for (const [id, timer] of [...timers]) if (timer.delay === 50) { timers.delete(id); timer.callback() }
    }
  }
  // Runs the short fade before a suspend, and lets the graph settle.
  const flush = async () => {
    for (const [id, timer] of [...timers]) if (timer.delay === 45) { timers.delete(id); timer.callback() }
    for (let turn = 0; turn < 6; turn++) await Promise.resolve()
  }
  return { audio, context, count, targets, plans, clock, flush }
}
// The gains of a cross-fade move with a 30 ms constant. The tube's buzz moves with a 4 ms constant.
const shares = (targets: Target[]) => targets.filter(target => target.constant === 0.03)
const buzzes = (targets: Target[]) => targets.filter(target => target.constant === 0.004)

test('a visit that starts in the office builds the office and never the cave', async () => {
  const { audio, count } = stage()
  audio.setAmbience('Office')
  await audio.activate()
  assert.equal(count.rooms, 1)
  const office = count.steady
  assert.ok(office > 0)
  await audio.dispose()

  const cave = stage()
  await cave.audio.activate()
  assert.equal(cave.count.rooms, 1)
  assert.notEqual(cave.count.steady, office, 'The cave and the office have their own layers.')
  await cave.audio.dispose()
})

test('a journey plays both ambiences through the cross-fade, then stops the one he left', async () => {
  const { audio, count, targets, clock } = stage()
  await audio.activate()
  const cave = count.steady
  clock(1)
  assert.equal(shares(targets).length, 0, 'A resting ambience needs no fade.')
  audio.setAmbience('Office')
  assert.equal(count.rooms, 2, 'Each ambience has its own room.')
  const both = count.steady
  assert.ok(both > cave)
  clock(ambienceFadeSeconds / 2)
  assert.equal(count.steady, both, 'Both ambiences play in the middle of the fade.')
  for (const target of shares(targets)) assert.ok(target.value >= 0 && target.value <= 1)
  assert.ok(shares(targets).some(target => target.value > 0.3 && target.value < 0.9))
  clock(ambienceFadeSeconds)
  assert.equal(count.steady, both - cave, 'Only the office plays after the fade.')
  const settled = targets.length
  clock(1)
  assert.equal(shares(targets.slice(settled)).length, 0, 'The fade is over.')
  // The way back builds the cave again.
  audio.setAmbience('Cave')
  assert.equal(count.rooms, 3)
  clock(ambienceFadeSeconds + 1)
  assert.equal(count.steady, cave)
  await audio.dispose()
  assert.equal(count.steady, 0)
})

test('a page that stalls as the set changes cannot hold the fade', async () => {
  const { audio, count, targets, clock, context } = stage()
  await audio.activate()
  const cave = count.steady
  clock(1)
  audio.setAmbience('Office')
  // No tick has run. The whole fade is on the audio clock already.
  const set = shares(targets)
  assert.ok(set.some(target => target.value === 0 && target.time >= context.currentTime + ambienceFadeSeconds - 0.06))
  assert.ok(set.some(target => target.value === 1 && target.time >= context.currentTime + ambienceFadeSeconds - 0.06))
  assert.ok(set.every(target => target.time <= context.currentTime + ambienceFadeSeconds + 0.06))
  // The page stalls for three seconds. Its next tick finds the fade done, and stops the cave.
  context.currentTime += 3
  clock(0.05)
  assert.ok(count.steady > 0 && count.steady !== cave)
  assert.equal(count.rooms, 2)
  await audio.dispose()
})

test('a journey that turns back in the fade keeps both ambiences and builds nothing new', async () => {
  const { audio, count, clock } = stage()
  await audio.activate()
  const cave = count.steady
  audio.setAmbience('Office')
  clock(0.3)
  audio.setAmbience('Cave')
  assert.equal(count.rooms, 2)
  clock(2)
  assert.equal(count.steady, cave)
  assert.equal(count.rooms, 2)
  await audio.dispose()
})

test('a change of set while sound is off needs no fade: sound starts again in the new ambience', async () => {
  const { audio, count, targets, clock, flush } = stage()
  await audio.activate()
  const cave = count.steady
  audio.setMuted(true)
  await flush()
  audio.setAmbience('Office')
  assert.equal(count.steady, cave, 'Sound that is off builds nothing.')
  audio.setMuted(false)
  await flush()
  assert.equal(count.rooms, 2)
  const office = count.steady
  assert.notEqual(office, cave)
  clock(2)
  assert.equal(shares(targets).length, 0)
  assert.equal(count.steady, office, 'The office plays alone.')
  await audio.dispose()
})

test('sound that goes off in a fade, and comes back in the other set, plays that set at its full level', async () => {
  const { audio, count, plans, clock, flush } = stage()
  await audio.activate()
  const cave = count.steady
  clock(1)
  audio.setAmbience('Office')
  clock(0.3)
  // The rest of the fade waits on the audio clock when the sound goes off.
  audio.setMuted(true)
  await flush()
  audio.setAmbience('Cave')
  audio.setMuted(false)
  await flush()
  clock(0.5)
  assert.equal(count.steady, cave)
  const shares = plans.filter(plan => plan.live() && plan.events.some(event => event.constant === 0.03))
  assert.ok(shares.length >= 2, 'The cave has a share for its layers and a share for his voice.')
  for (const share of shares) assert.ok(ending(share).value > 0, 'No step of the old fade pulls the cave down.')
  await audio.dispose()
})

test('the office clock ticks through the graph, and the cave has no clock', async () => {
  const office = stage()
  office.audio.setAmbience('Office')
  await office.audio.activate()
  office.clock(0.5)
  const early = office.count.shots
  office.clock(2)
  // Two more whole seconds pass, so the wall clock ticks twice.
  assert.equal(office.count.shots - early, 2)
  await office.audio.dispose()
})

test('the tube buzzes at the scene times its light is down, and is silent when the scene stands still', async () => {
  const { audio, targets, clock, context } = stage()
  audio.setAmbience('Office')
  await audio.activate()
  // No scene time yet: no buzz.
  clock(1)
  assert.equal(buzzes(targets).length, 0)
  // The scene is 6.9 seconds old at audio second 1, so the tube stutters from audio second 1.5 to 3.1.
  const offset = 6.9 - context.currentTime
  for (let report = 0; report < 8; report++) { audio.setSceneTime(context.currentTime + offset); clock(0.5) }
  const heard = buzzes(targets)
  assert.ok(heard.length > 3)
  for (const buzz of heard) {
    const scene = buzz.time + offset
    // The last change is the return to silence, as the stutter ends.
    assert.ok(scene % 9 >= 7.4 - 1e-6 || (scene % 9 < 0.03 && buzz.value === 0), `a buzz at scene time ${scene} is in the stutter`)
    assert.equal(buzz.value, flickerBuzz(tubeFlicker(scene + 0.011)))
  }
  assert.equal(heard.at(-1)!.value, 0, 'The buzz ends with the stutter.')
  // The scene stops its reports, and the light stands still while it is down. A held buzz would annoy, so the buzz falls silent.
  const dim = Array.from({ length: 450 }, (_, step) => step / 5).find(time => time > 12 && [0.05, 0.25, 0.35].every(ahead => tubeFlicker(time + ahead) < 1))!
  const reported = context.currentTime
  const before = targets.length
  audio.setSceneTime(dim - 1.6)
  clock(5)
  const after = targets.slice(before)
  assert.ok(buzzes(after).length > 0)
  // The clock stands still 1.6 seconds after its last report. The graph had set the buzz at most 0.4 seconds ahead.
  assert.ok(buzzes(after).every(buzz => buzz.time < reported + 2), 'No buzz is set after the clock stands still.')
  const silence = after.findLast(target => target.constant === 0.02)
  assert.deepEqual(silence && { value: silence.value, late: silence.time > reported + 1.5 }, { value: 0, late: true })
  await audio.dispose()
})

test('an action sound plays in the room he is in, and only while sound runs', async () => {
  const { audio, count } = stage()
  audio.playAction('KeyClick')
  assert.equal(count.shots, 0)
  await audio.activate()
  audio.playAction('KeyClick')
  const click = count.shots
  assert.ok(click > 0)
  audio.playAction('MarkerSqueak')
  audio.playAction('JarBubbles')
  assert.ok(count.shots > click)
  audio.setMuted(true)
  const muted = count.shots
  audio.playAction('KeyClick')
  assert.equal(count.shots, muted)
  await audio.dispose()
})
