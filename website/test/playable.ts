import assert from 'node:assert/strict'
import type { Shot } from '../shared/audio-shot.ts'

/** A sound the graph can play: its points run forward inside its length, its pitches are real, and it starts and ends silent. */
export function assertPlayable(shot: Shot, name: string) {
  assert.ok(shot.duration > 0 && shot.duration < 1.2, `${name} is short`)
  assert.ok(Math.abs(shot.pan) <= 1)
  assert.ok(shot.voices.length > 0)
  for (const voice of shot.voices) {
    const curves = [voice.level, voice._tag === 'Tone' ? voice.pitch : [], voice.filter?.frequency ?? []]
    for (const curve of curves) curve.forEach(([time], index) => assert.ok(time >= 0 && time <= shot.duration && (index === 0 || time > curve[index - 1]![0]), `${name} runs forward inside its length`))
    for (const curve of curves.slice(1)) for (const [, hertz] of curve) assert.ok(hertz > 20 && hertz < 20000, `${name} has real pitches`)
    assert.equal(voice.level[0]![1], 0, `${name} starts silent`)
    assert.equal(voice.level.at(-1)![1], 0, `${name} ends silent`)
    for (const [, level] of voice.level) assert.ok(level >= 0)
  }
}
