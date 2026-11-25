import assert from 'node:assert/strict'
import { test } from 'node:test'
import { actionSounds, chamberHum, jarBubbles, keyClick, markerSqueak } from '../shared/action-sounds.ts'
import { criticalStruckAt } from '../shared/office-critical.ts'
import { shotLevelAt, shotPeak } from '../shared/audio-shot.ts'
import { assertPlayable } from './playable.ts'

test('a key click is a very short sound, and no two keys in a row sound the same', () => {
  for (let index = 0; index < 30; index++) {
    const click = keyClick(index)
    assertPlayable(click, 'key click')
    assert.ok(click.duration <= 0.08)
    assert.ok(shotPeak(click) < 0.2)
    assert.notDeepEqual(click, keyClick(index + 1))
    assert.deepEqual(click, keyClick(index))
  }
  // Fast typing: a click is silent again before the next key, at twelve keys a second.
  assert.equal(shotLevelAt(keyClick(3).voices[0]!.level, 1 / 12), 0)
})

test('a marker squeak is high, wavers in pitch, and lasts a stroke', () => {
  for (let index = 0; index < 30; index++) {
    const squeak = markerSqueak(index)
    assertPlayable(squeak, 'marker squeak')
    assert.ok(squeak.duration > 0.15 && squeak.duration < 0.4)
    assert.ok(shotPeak(squeak) < 0.2)
    const tone = squeak.voices[0]!
    assert.ok(tone._tag === 'Tone')
    const pitches = tone.pitch.map(point => point[1])
    assert.ok(Math.min(...pitches) > 1500)
    assert.ok(Math.max(...pitches) > Math.min(...pitches) * 1.1)
  }
  assert.notDeepEqual(markerSqueak(0), markerSqueak(1))
})

test('jar bubbles are a few small bubbles, each rising in pitch and higher than the water cooler', () => {
  for (let index = 0; index < 30; index++) {
    const sound = jarBubbles(index)
    assertPlayable(sound, 'jar bubbles')
    assert.ok(shotPeak(sound) < 0.2)
    const tone = sound.voices[0]!
    assert.ok(tone._tag === 'Tone')
    const count = tone.pitch.length / 2
    assert.ok(count >= 3 && count <= 5)
    for (let bubble = 0; bubble < count; bubble++) {
      assert.ok(tone.pitch[bubble * 2 + 1]![1] > tone.pitch[bubble * 2]![1])
      assert.ok(tone.pitch[bubble * 2]![1] >= 420)
    }
  }
  assert.notDeepEqual(jarBubbles(0), jarBubbles(1))
})

test('each action has its sound', () => {
  assert.deepEqual(actionSounds.KeyClick(4), keyClick(4))
  assert.deepEqual(actionSounds.MarkerSqueak(4), markerSqueak(4))
  assert.deepEqual(actionSounds.JarBubbles(4), jarBubbles(4))
})

test('the chamber hum lasts the length it is given, rises all the way, and stops dead', () => {
  const hum = chamberHum(6.1)
  assert.equal(hum.duration, 6.1)
  assert.ok(shotPeak(hum) < 0.2, 'The hum stays under his voice, as the other action sounds do')
  for (const voice of hum.voices) {
    assert.ok(voice._tag === 'Tone')
    assert.equal(voice.level[0]![1], 0)
    assert.equal(voice.level.at(-1)![1], 0)
    // It never falls before its end: each level and each pitch is at least the one before.
    const rising = (curve: readonly (readonly [number, number])[]) => curve.every(([, value], index) => index === 0 || value >= curve[index - 1]![1])
    assert.ok(rising(voice.level.slice(0, -1)) && rising(voice.pitch))
    for (const curve of [voice.level, voice.pitch]) curve.forEach(([time], index) => assert.ok(time >= 0 && time <= hum.duration && (index === 0 || time > curve[index - 1]![0])))
    // The last step to silence takes a twentieth of a second.
    assert.ok(hum.duration - voice.level.at(-2)![0] <= 0.051)
  }
  // The scene's hum ends as the last tube goes out.
  assert.equal(actionSounds.ChamberHum(0).duration, criticalStruckAt)
})

test('a thump on the vending machine is low and short, stays under his voice, and no two blows in a row sound the same', () => {
  // The scene asks for the thump by name, once for each blow.
  for (let index = 0; index < 30; index++) {
    const thump = actionSounds.MachineThump(index)
    assertPlayable(thump, 'machine thump')
    assert.ok(shotPeak(thump) < 0.2)
    const tone = thump.voices.find(voice => voice._tag === 'Tone')
    assert.ok(tone && tone._tag === 'Tone' && Math.max(...tone.pitch.map(point => point[1])) < 200, 'A thump is a low sound')
    assert.notDeepEqual(thump, actionSounds.MachineThump(index + 1))
    assert.deepEqual(thump, actionSounds.MachineThump(index))
  }
})

test('an arc cracks short and sharp, falls in pitch, and no two arcs in a row sound the same', () => {
  for (let index = 0; index < 20; index++) {
    const zap = actionSounds.ArcZap(index)
    assertPlayable(zap, 'arc zap')
    assert.ok(zap.duration <= 0.4)
    assert.ok(shotPeak(zap) < 0.2)
    const tone = zap.voices[0]!
    assert.ok(tone._tag === 'Tone')
    assert.ok(tone.pitch[0]![1] > tone.pitch.at(-1)![1] * 4, 'The crack falls a long way')
    assert.notDeepEqual(zap, actionSounds.ArcZap(index + 1))
  }
})
