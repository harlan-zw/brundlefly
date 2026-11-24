import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMeshMascot } from '../layers/brand/shared/mascot-mesh.ts'
import { advanceStroll, advanceTurn, startStroll, startTurn } from '../layers/brand/shared/mascot-stroll.ts'
import { officePlan } from '../layers/brand/shared/office-layout.ts'
import { criticalAct, criticalPace, criticalSpurtAt, criticalStruckAt, keysFacingSlack } from '../shared/office-critical.ts'
import { criticalLines } from '../shared/office-script.ts'
import { loadMascotModel } from './mascot-model.ts'
import { frame, meshCadence, meshWalk } from './walk-sim.ts'
import type { Point } from './walk-sim.ts'

/**
 * His part in the critical scene, walked at real speed. A capture holds the clock and lets him settle, so it cannot show a mark he reaches too late.
 * This replays the scene's own loop for the real model: `criticalAct` gives the place and the work, and his feet carry him there.
 */
type Marks = { facesChamber: number | undefined, typesFrom: number | undefined, typed: number, facesVisitor: number | undefined }
async function act(from: Point, heading: number): Promise<Marks> {
  const made = createMeshMascot(await loadMascotModel(), 2.5)
  assert.equal(made._tag, 'Ok')
  const { strideLength } = (made as Extract<typeof made, { _tag: 'Ok' }>).mascot
  assert.ok(strideLength)
  const cadence = meshCadence(strideLength)
  const walkSpeed = meshWalk.speed * criticalPace
  const chamber = officePlan.stops.find(stop => stop.habit === 'TendJar')!
  let stroll = startStroll(from, 0), turn = startTurn(heading), held = ''
  const marks: Marks = { facesChamber: undefined, typesFrom: undefined, typed: 0, facesVisitor: undefined }
  for (let step = 0; step * frame < criticalStruckAt; step++) {
    const age = step * frame
    const { place, work } = criticalAct(age)
    const spot = place === 'Computer' ? officePlan.keys.stand : chamber.position
    // A new place sends him off at once, as the scene does.
    if (spot.join() !== held) { held = spot.join(); stroll = { ...stroll, destination: 0, activity: { _tag: 'Walking' } } }
    stroll = advanceStroll(stroll, { delta: frame, route: [spot], pauses: [600], walkSpeed, attention: 'free', cadence, facing: turn.heading })
    const stand = work === 'Type' ? officePlan.keys.facing : place === 'Chamber' ? chamber.facing : undefined
    turn = advanceTurn(turn, stroll, { delta: frame, walkSpeed, rest: meshWalk.rest, limit: meshWalk.limit, attention: 'free', stand })
    const stands = stroll.activity._tag === 'Pausing'
    if (place === 'Chamber' && stands && Math.abs(turn.heading - chamber.facing!) < keysFacingSlack) marks.facesChamber ??= age
    if (work === 'Type' && stands && Math.abs(turn.heading - officePlan.keys.facing) < keysFacingSlack) { marks.typesFrom ??= age; marks.typed += frame }
    // He faces the visitor when he is back at his three-quarter turn.
    if (work === 'Address' && Math.abs(Math.abs(turn.heading) - meshWalk.rest) < 0.2) marks.facesVisitor ??= age
  }
  return marks
}

// The scene can begin with him anywhere on his round: at its start, at any stop, or at the light switch.
const starts: readonly (readonly [name: string, from: Point, heading: number])[] = [
  ['his start', officePlan.start, meshWalk.rest],
  ...officePlan.stops.map((stop, index) => [`stop ${index}`, stop.position, stop.facing ?? meshWalk.rest] as const),
  ['the light switch', officePlan.entrance.stand, officePlan.entrance.facing],
]
const line = (words: RegExp) => criticalLines.find(({ text }) => words.test(text))!

test('from anywhere on his round he stands at the chamber and faces it before it spits its first snail', async () => {
  for (const [name, from, heading] of starts) {
    const { facesChamber } = await act(from, heading)
    assert.ok(facesChamber !== undefined && facesChamber < criticalSpurtAt - 0.5, `From ${name} he faces the chamber at ${facesChamber} s. It spits at ${criticalSpurtAt} s.`)
  }
})

test('he works the keys before he says that they do nothing, and for long enough to be seen', async () => {
  const says = line(/not stopping/).at
  for (const [name, from, heading] of starts) {
    const { typesFrom, typed } = await act(from, heading)
    assert.ok(typesFrom !== undefined && typesFrom < says - 0.5, `From ${name} he types from ${typesFrom} s. He speaks at ${says} s.`)
    assert.ok(typed >= 3, `From ${name} he types for ${typed} s.`)
  }
})

test('he has turned back to the visitor while the tubes still burn, so they see his face for his last line', async () => {
  for (const [name, from, heading] of starts) {
    const { facesVisitor } = await act(from, heading)
    assert.ok(facesVisitor !== undefined && facesVisitor < criticalStruckAt - 0.8, `From ${name} he faces the visitor at ${facesVisitor} s. The strike is at ${criticalStruckAt} s.`)
  }
})
