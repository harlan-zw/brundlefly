import assert from 'node:assert/strict'
import { test } from 'node:test'
import { beatAt, formatClock, lateFade, parseClock, partyDefaults, partyLength, partyLevel, partyLimits, partyPlan, readPartyTrack, stopLevel, tapTempo } from '../shared/party-track.ts'
import type { PartyPlan, PartyTrack } from '../shared/party-track.ts'

const track = (settings: Partial<PartyTrack> = {}): PartyTrack => ({ name: 'Test tone.wav', ...partyDefaults, chorusAt: 72, ...settings })
/** The file position at the hit: the plan starts at `startAt` after `startIn`, and the file then runs at normal speed. */
const positionAtHit = (plan: PartyPlan, secondsUntilHit: number) => plan.startAt + secondsUntilHit - plan.startIn
const near = (actual: number, expected: number, message: string) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual}, not ${expected}.`)

const leadIns = [0.5, 2, 8, 14, 30, 60]
const chorusTimes = [0, 0.2, 3, 13.9, 14, 72, 3600]
const hitDistances = [-50, -12, -0.3, 0, 0.2, 0.5, 1, 7.25, 14, 14.01, 40, 300]

test('the file position is the chorus exactly at the hit, for every lead in, chorus time, and hit distance', () => {
  let plans = 0
  for (const leadIn of leadIns) {
    for (const chorusAt of chorusTimes) {
      for (const hit of hitDistances) {
        const plan = partyPlan(track({ leadIn, chorusAt }), hit)
        if (!plan) continue
        plans++
        const where = `lead in ${leadIn}, chorus at ${chorusAt}, hit in ${hit}`
        near(positionAtHit(plan, hit), chorusAt, where)
        assert.ok(plan.startAt >= 0, `${where}: starts at ${plan.startAt}`)
        assert.ok(plan.startIn >= 0, `${where}: waits ${plan.startIn}`)
        assert.ok(plan.fadeIn <= Math.max(leadIn, lateFade) + 1e-9, `${where}: fades over ${plan.fadeIn}`)
      }
    }
  }
  // The test must not pass on plans that never exist.
  assert.ok(plans > leadIns.length * chorusTimes.length * 8)
})

test('when the hit is far enough away, the fade in ends exactly at the hit at full level', () => {
  for (const leadIn of leadIns) {
    for (const chorusAt of chorusTimes.filter(time => time >= lateFade)) {
      for (const hit of hitDistances.filter(distance => distance >= lateFade)) {
        const plan = partyPlan(track({ leadIn, chorusAt }), hit)!
        const where = `lead in ${leadIn}, chorus at ${chorusAt}, hit in ${hit}`
        near(plan.startIn + plan.fadeIn, hit, where)
        near(partyLevel(plan, hit - plan.startIn), 1, `${where}, level at the hit`)
        assert.ok(partyLevel(plan, hit - plan.startIn - 0.05) < 1, `${where}: full before the hit`)
      }
    }
  }
})

test('a hit nearer than the lead in starts at once and fades over the time that is left', () => {
  const plan = partyPlan(track({ leadIn: 14, chorusAt: 72 }), 9)!
  assert.deepEqual(plan, { startIn: 0, startAt: 63, fadeIn: 9, hold: 45, fadeOut: 8 })
})

test('a chorus nearer the file start than the lead in starts later, at the start of the file, with a shorter fade', () => {
  const plan = partyPlan(track({ leadIn: 14, chorusAt: 5 }), 14)!
  assert.deepEqual(plan, { startIn: 9, startAt: 0, fadeIn: 5, hold: 45, fadeOut: 8 })
  // A chorus at the very start has no music before it. The chorus starts at full level on the hit.
  assert.deepEqual(partyPlan(track({ chorusAt: 0 }), 14), { startIn: 14, startAt: 0, fadeIn: 0, hold: 45, fadeOut: 8 })
})

test('a late page joins at the position the song has by now, with a short fade, and ends when it would have ended', () => {
  const settings = track({ chorusAt: 72, playFor: 45, fadeOut: 8 })
  const plan = partyPlan(settings, -3)!
  assert.equal(plan.startIn, 0)
  assert.equal(plan.startAt, 75)
  assert.equal(plan.fadeIn, lateFade)
  // The end is 45 + 8 seconds after the hit, so 50 seconds from now.
  near(partyLength(plan), 50, 'length of a late plan')
  // A page that is later than the full part stays silent.
  assert.equal(partyPlan(settings, -45), undefined)
  assert.equal(partyPlan(settings, Number.NaN), undefined)
})

/** Levels every 10 ms from the start of the plan to one second after its end. */
const levels = (plan: PartyPlan) => Array.from({ length: Math.round((partyLength(plan) + 1) / 0.01) + 1 }, (_, index) => ({ at: index * 0.01, level: partyLevel(plan, index * 0.01) }))

test('the level starts at 0, is full from the hit through the hold, ends at 0, never jumps, and never passes 1', () => {
  for (const leadIn of leadIns) {
    for (const hit of [-2, 0.2, 3, 14, 40]) {
      const plan = partyPlan(track({ leadIn, chorusAt: 72, playFor: 6, fadeOut: 4 }), hit)!
      const where = `lead in ${leadIn}, hit in ${hit}`
      const samples = levels(plan)
      assert.equal(samples[0]!.level, 0, where)
      assert.equal(partyLevel(plan, -1), 0, where)
      for (const at of [plan.fadeIn, plan.fadeIn + plan.hold / 2, plan.fadeIn + plan.hold]) assert.equal(partyLevel(plan, at), 1, `${where}, at ${at}`)
      assert.equal(partyLevel(plan, partyLength(plan)), 0, where)
      assert.equal(samples.at(-1)!.level, 0, where)
      for (const [index, { at, level }] of samples.entries()) {
        assert.ok(level >= 0 && level <= 1, `${where}: level ${level} at ${at}`)
        // The shortest fade is half a second, and the cubed curve of the fade in is never steeper than 3 per fade. That bounds a 10 ms step.
        if (index > 0) assert.ok(Math.abs(level - samples[index - 1]!.level) <= 3 * 0.01 / lateFade + 1e-9, `${where}: jump at ${at}`)
      }
    }
  }
})

test('a long fade in rises over its whole length: still quiet at the halfway point, and still rising just before the hit', () => {
  const plan = partyPlan(track({ leadIn: 14, chorusAt: 72 }), 14)!
  // The fade in stays under the scene: a murmur at the halfway point, and under half its level two thirds of the way in.
  assert.ok(partyLevel(plan, 7) <= 0.15, 'Too loud at half the fade')
  assert.ok(partyLevel(plan, 14 * 2 / 3) < 0.5, 'Too loud at two thirds of the fade')
  assert.ok(partyLevel(plan, 3) > 0, 'Silent three seconds in')
  assert.ok(partyLevel(plan, 12.6) < 0.9, 'Nearly full long before the hit')
  // Each second of the fade is louder than the one before it.
  for (let second = 1; second <= 14; second++) assert.ok(partyLevel(plan, second) > partyLevel(plan, second - 1), `No rise in second ${second}`)
})

test('a stop fades from the level it had to silence, without a jump', () => {
  assert.equal(stopLevel(0.6, 2, 0), 0.6)
  assert.equal(stopLevel(0.6, 2, 2), 0)
  assert.equal(stopLevel(0.6, 2, 5), 0)
  let last = 0.6
  for (let since = 0.01; since <= 2; since += 0.01) {
    const level = stopLevel(0.6, 2, since)
    assert.ok(level <= last && last - level <= 0.6 * 2 * 0.01 / 2 + 1e-9, `jump at ${since}`)
    last = level
  }
})

test('a clock reads as seconds, and the seconds write back as the same clock', () => {
  assert.equal(parseClock('83'), 83)
  assert.equal(parseClock('1:23'), 83)
  assert.equal(parseClock('1:23.5'), 83.5)
  assert.equal(parseClock(' 0:07 '), 7)
  assert.equal(parseClock('12.25'), 12.25)
  assert.equal(parseClock('61:05'), 3665)
  assert.equal(formatClock(83), '1:23')
  assert.equal(formatClock(83.5), '1:23.5')
  assert.equal(formatClock(7), '0:07')
  for (const seconds of [0, 0.001, 5, 59.999, 60, 61.3, 83.25, 599.5, 3600]) assert.equal(parseClock(formatClock(seconds)), seconds, `${seconds} s`)
})

test('a clock that is negative, empty, or not a time reads as nothing', () => {
  for (const text of ['', ' ', '-3', '-0:05', '1:60', '1:5', '1:75', 'abc', '1e3', '0x10', 'Infinity', 'NaN', '1:23:45', '1,5', '.5', '1:', ':30', '83s']) assert.equal(parseClock(text), undefined, `"${text}"`)
  assert.equal(formatClock(-4), '0:00')
})

const steady = (bpm: number, count: number, from = 1000) => Array.from({ length: count }, (_, index) => from + index * 60_000 / bpm)

test('steady taps give their tempo', () => {
  assert.equal(tapTempo(steady(120, 4)), 120)
  assert.equal(tapTempo(steady(128, 12)), 128)
  assert.equal(tapTempo(steady(87, 8)), 87)
})

test('jittered taps give a tempo within one beat per minute of the real one', () => {
  // Taps at 100 BPM, each off by up to 10 ms.
  const jitter = [0, 8, -6, 10, -9, 4, -10, -3, 7, -5]
  const taps = steady(100, jitter.length).map((time, index) => time + jitter[index]!)
  assert.ok(Math.abs(tapTempo(taps)! - 100) <= 1, `${tapTempo(taps)} BPM`)
})

test('a missed beat does not move the tempo, because the median interval sets it', () => {
  // One beat of ten has no tap. A mean interval would read about 91 BPM.
  const taps = steady(100, 11).filter((_, index) => index !== 5)
  assert.equal(tapTempo(taps), 100)
})

test('a gap of more than two seconds starts a new count', () => {
  const first = steady(90, 6)
  const second = steady(140, 5, first.at(-1)! + 3000)
  assert.equal(tapTempo([...first, ...second]), 140)
  // Three taps after the gap are too few, even with many before it.
  assert.equal(tapTempo([...first, ...second.slice(0, 3)]), undefined)
})

test('fewer than four taps give no tempo', () => {
  assert.equal(tapTempo([]), undefined)
  assert.equal(tapTempo([1000]), undefined)
  assert.equal(tapTempo(steady(120, 3)), undefined)
})

test('a tempo outside the limits is clamped', () => {
  assert.equal(tapTempo(steady(400, 6)), partyLimits.bpm.most)
  assert.equal(tapTempo([0, 1900, 3800, 5700]), partyLimits.bpm.least)
})

test('beats count from the hit, and are negative before it', () => {
  assert.equal(beatAt(120, 0), 0)
  assert.equal(beatAt(120, 2), 4)
  assert.equal(beatAt(90, -4), -6)
})

test('a stored track reads back with its settings', () => {
  const stored = { name: 'Chorus.mp3', chorusAt: 61.5, bpm: 124, leadIn: 20, playFor: 30, fadeOut: 6 }
  assert.deepEqual(readPartyTrack(stored), stored)
})

test('a track with missing settings takes the defaults, and settings outside the limits are clamped', () => {
  assert.deepEqual(readPartyTrack({ name: 'Song.ogg' }), { name: 'Song.ogg', ...partyDefaults })
  assert.deepEqual(readPartyTrack({ name: '  Song.ogg ', leadIn: 500, bpm: 2, chorusAt: -10, playFor: Infinity, fadeOut: 3 }), {
    name: 'Song.ogg', chorusAt: 0, bpm: partyLimits.bpm.least, leadIn: partyLimits.leadIn.most, playFor: partyLimits.playFor.most, fadeOut: 3,
  })
})

test('hostile data gives no track, or a track with safe settings', () => {
  for (const value of [undefined, null, 'Song.mp3', 42, [], ['Song.mp3'], {}, { name: '' }, { name: '   ' }, { name: 7 }, { name: { toString: () => 'x' } }]) {
    assert.equal(readPartyTrack(value), undefined, JSON.stringify(value) ?? String(value))
  }
  // Settings of the wrong type take their defaults. A number in a string is not a number.
  assert.deepEqual(readPartyTrack({ name: 'Song.mp3', bpm: '120', leadIn: null, playFor: 'NaN', fadeOut: {}, chorusAt: [30] }), { name: 'Song.mp3', ...partyDefaults })
  const long = readPartyTrack({ name: 'x'.repeat(5000), chorusAt: Number.NaN })!
  assert.equal(long.name.length, 200)
  assert.equal(long.chorusAt, partyDefaults.chorusAt)
})
