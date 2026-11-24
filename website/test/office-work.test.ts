import assert from 'node:assert/strict'
import { test } from 'node:test'
import { officePlan } from '../layers/brand/shared/office-layout.ts'
import { jarLift, keyTaps, machineSmacks, mannerismDuration, markerStrokes, poseMannerisms, roundHabits, stationMannerism } from '../layers/brand/shared/mannerism.ts'
import { advanceTurn, settleTurn, startStroll, startTurn, workLimit } from '../layers/brand/shared/mascot-stroll.ts'
import type { Stroll } from '../layers/brand/shared/mascot-stroll.ts'
import { headCounterTurn, neckLimit } from '../layers/brand/shared/mascot-mesh.ts'

const turning = { walkSpeed: 1, rest: 0.5, limit: 1.3, attention: 'free' as const }
const standingAt = (waypoint: number): Stroll => ({ ...startStroll([0, 0], waypoint), activity: { _tag: 'Pausing', remaining: 5, duration: 6, waypoint, age: 1 } })
const near = (value: number, wanted: number, slack: number) => assert.ok(Math.abs(value - wanted) <= slack, `${value} is not within ${slack} of ${wanted}`)

test('a stop at his work turns him past the walking limit, and no further than the work limit', () => {
  const stand = standingAt(0)
  near(settleTurn(startTurn(0.5), stand, { ...turning, stand: -2.35 }).heading, -2.35, 1e-9)
  near(settleTurn(startTurn(0.5), stand, { ...turning, stand: 3.1 }).heading, workLimit, 1e-9)
  assert.ok(Math.abs(settleTurn(startTurn(0.5), stand, turning).heading) <= turning.limit)
})

test('he steps round to his work at a stop, and back when a visitor has his attention, with no jump', () => {
  let turn = startTurn(0.5)
  const stand = standingAt(0)
  let largest = 0
  const run = (seconds: number, input: Parameters<typeof advanceTurn>[2]) => {
    for (let time = 0; time < seconds; time += 1 / 60) {
      const next = advanceTurn(turn, stand, input)
      largest = Math.max(largest, Math.abs(next.heading - turn.heading))
      turn = next
    }
  }
  run(12, { ...turning, stand: -2.35, delta: 1 / 60 })
  near(turn.heading, -2.35, 0.13)
  run(12, { ...turning, attention: 'noticed', delta: 1 / 60 })
  assert.ok(Math.abs(turn.heading) <= turning.limit + 0.01, `he stays turned away at ${turn.heading}`)
  // A sixtieth of a second never carries more of the turn than his steps in place allow.
  assert.ok(largest < 0.05, `one frame turned him ${largest}`)
})

test('the typing habit strikes its keys in bursts, with pauses between', () => {
  assert.equal(keyTaps(0.5), 0)
  assert.ok(keyTaps(mannerismDuration({ _tag: 'TypeKeys' })) > 20)
  let last = 0
  for (let age = 0; age <= 6.4; age += 0.05) { assert.ok(keyTaps(age) >= last); last = keyTaps(age) }
  // Between the first and the second burst he reads, and strikes no key.
  assert.equal(keyTaps(2.85), keyTaps(2.35))
})

test('typing lifts both long arms, and tending a jar lifts the arm on the side the jar stands', () => {
  const typing = poseMannerisms([{ mannerism: { _tag: 'TypeKeys' }, age: 1.5 }]).turns
  assert.ok(typing['left-shoulder']![0] < -0.4 && typing['right-shoulder']![0] < -0.4)
  const right = poseMannerisms([{ mannerism: { _tag: 'TendJar' }, age: 2.5, side: 1 }]).turns
  const left = poseMannerisms([{ mannerism: { _tag: 'TendJar' }, age: 2.5, side: -1 }]).turns
  assert.ok(right['left-shoulder']![0] < -0.3)
  assert.equal(right['right-shoulder'], undefined)
  assert.ok(left['right-shoulder']![0] < -0.3)
})

test('he stays longest at the stations of his round, where he turns to his work', () => {
  const stations = officePlan.stops.filter(stop => stop.facing !== undefined)
  assert.ok(stations.length > 0)
  const others = officePlan.stops.filter(stop => stop.facing === undefined)
  assert.ok(Math.min(...stations.map(stop => stop.pause)) > Math.max(...others.map(stop => stop.pause)))
})

test('a walk point with a second habit takes it on every second visit, and the others keep theirs', () => {
  const habits = ['TypeKeys', 'TendJar'] as const
  const alternates = ['WriteBoard', undefined] as const
  assert.deepEqual(roundHabits(habits, alternates, []), ['TypeKeys', 'TendJar'])
  assert.deepEqual(roundHabits(habits, alternates, [1, 1]), ['TypeKeys', 'TendJar'])
  assert.deepEqual(roundHabits(habits, alternates, [2, 2]), ['WriteBoard', 'TendJar'])
  assert.deepEqual(roundHabits(habits, alternates, [3, 4]), ['TypeKeys', 'TendJar'])
  assert.deepEqual(roundHabits(habits, undefined, [2, 2]), ['TypeKeys', 'TendJar'])
})

test('he writes four lines on the board, and lifts the writing arm higher than for a jar', () => {
  assert.equal(markerStrokes(0.5), 0)
  assert.equal(markerStrokes(1), 1)
  assert.equal(markerStrokes(mannerismDuration({ _tag: 'WriteBoard' })), 4)
  let last = 0
  for (let age = 0; age <= 6.2; age += 0.05) { assert.ok(markerStrokes(age) >= last); last = markerStrokes(age) }
  const board = poseMannerisms([{ mannerism: { _tag: 'WriteBoard' }, age: 2.5, side: -1 }]).turns
  const jar = poseMannerisms([{ mannerism: { _tag: 'TendJar' }, age: 2.5, side: -1 }]).turns
  assert.ok(board['right-shoulder']![0] < jar['right-shoulder']![0])
  assert.equal(board['left-shoulder'], undefined)
})

test('his head stays on the viewer up to the neck limit, and goes with his body when he turns to his work', () => {
  // Inside the walking limit the head undoes the whole turn, as before.
  for (const heading of [-1.3, -0.6, 0, 0.5, 1.3]) assert.ok(Math.abs(headCounterTurn(heading, 0) - heading) < 1e-9)
  // At a station the neck does not twist: the head keeps only a small turn back to the viewer.
  for (const heading of [2.3, -2.35, 2.5]) {
    const counter = headCounterTurn(heading, 0)
    assert.ok(Math.abs(counter) <= 0.25 && Math.sign(counter) === Math.sign(heading), `the neck twists ${counter} at ${heading}`)
  }
  // No heading asks more of the neck than its limit, and the turn has no jump.
  let last = headCounterTurn(-3, 0)
  for (let heading = -3; heading <= 3; heading += 0.01) {
    const counter = headCounterTurn(heading, 0)
    assert.ok(Math.abs(counter) <= neckLimit + 1e-9)
    assert.ok(Math.abs(counter - last) < 0.03, `the head jumps ${counter - last} at ${heading}`)
    last = counter
  }
  // While he walks the head keeps half of the turn.
  assert.ok(Math.abs(headCounterTurn(1, 1) - 0.5) < 1e-9)
})

test('at a station his habit waits until he faces his work, then fits the time the stop has left', () => {
  const habits = ['WriteBoard'] as const
  const stop = (age: number): Stroll => ({ ...startStroll([0, 0], 0), activity: { _tag: 'Pausing', remaining: 9 - age, duration: 9, waypoint: 0, age } })
  // While he still turns, no habit plays.
  assert.equal(stationMannerism(stop(1), habits, undefined, 1), undefined)
  // He faced his work 2 seconds into the stop. The habit starts from its beginning there.
  const begun = stationMannerism(stop(2), habits, 2, 1)!
  assert.equal(begun.age, 0)
  // It ends before he walks on, however late he began.
  for (const ready of [1, 2, 4, 6]) {
    const last = stationMannerism(stop(9 - 0.15), habits, ready, 1)!
    assert.ok(last.age >= mannerismDuration({ _tag: 'WriteBoard' }) - 1e-9, `the habit is cut short when he is ready at ${ready}`)
  }
  // A visitor who turns him away fades the habit out.
  assert.equal(stationMannerism(stop(4), habits, 2, 0.4)!.weight, 0.4)
  assert.equal(stationMannerism(stop(4), habits, 2, -1)!.weight, 0)
  assert.equal(poseMannerisms([stationMannerism(stop(4), habits, 2, -1)!]).turns['right-shoulder'], undefined)
})

test('the jar and the board keep his working arm bent and in front of him', () => {
  // A straight arm at shoulder height read as broken: the shoulder lifted 0.95 and the elbow bent 0.42. For a jar the elbow carries the reach and the lift.
  // Through the whole habit it bends at least half as far again as the shoulder lifts, and the shoulder never lifts as far as that broken arm.
  for (let age = 0.1; age < mannerismDuration({ _tag: 'TendJar' }); age += 0.1) {
    const jar = poseMannerisms([{ mannerism: { _tag: 'TendJar' }, age, side: 1 }]).turns
    const [shoulder, elbow] = [jar['left-shoulder']![0], jar['left-elbow']![0]]
    assert.ok(elbow <= shoulder * 1.5 && shoulder > -0.95, `at ${age.toFixed(1)} s the shoulder lifts ${shoulder.toFixed(2)} and the elbow bends ${elbow.toFixed(2)}`)
  }
  // At the board the arm lifts forward and the elbow bends, so the hand writes in front of his face and never behind his head.
  const board = poseMannerisms([{ mannerism: { _tag: 'WriteBoard' }, age: 3.2, side: -1 }]).turns
  assert.ok(board['right-shoulder']![0] > -1.3 && board['right-elbow']![0] < -0.6)
  assert.ok(Math.abs(board['right-shoulder']![2]) < 0.2)
})

test('at a station he turns side-on, far enough to work and not so far that his face is hidden', () => {
  for (const stop of officePlan.stops.filter(stop => stop.facing !== undefined)) {
    const turn = Math.abs(stop.facing!)
    assert.ok(turn > 1.3 && turn <= 1.6, `the stop for ${stop.habit} turns him ${turn}`)
    // His head still turns most of the way back to the viewer.
    assert.ok(Math.abs(headCounterTurn(stop.facing!, 0)) > 1)
  }
})

/** Ages through a habit, a hundredth of a second apart. */
const agesOf = (tag: 'TendJar' | 'SmackMachine' | 'TrackFly') => Array.from({ length: Math.floor(mannerismDuration({ _tag: tag }) * 100) + 1 }, (_, index) => index / 100)

test('tending a jar, he takes it from the shelf, lifts it to his eyes, and puts it back', () => {
  const hand = (age: number) => poseMannerisms([{ mannerism: { _tag: 'TendJar' }, age, side: 1 }]).hands.left
  const duration = mannerismDuration({ _tag: 'TendJar' })
  // His hand is on the jar only in the middle of the habit. As he reaches for it, and after he lets it go, the hand is empty.
  assert.ok(hand(0.9) && hand(0.9)!.holds === undefined, 'He holds the jar before he takes it.')
  assert.ok(hand(duration - 0.7) && hand(duration - 0.7)!.holds === undefined, 'He still holds the jar after he puts it back.')
  assert.equal(hand(duration / 2)?.holds, 'Jar')
  // The jar leaves the shelf, reaches his eyes, and comes back to the shelf. While it is off the shelf, it is in his hand.
  assert.equal(jarLift(0), 0)
  assert.equal(jarLift(duration), 0)
  assert.ok(Math.max(...agesOf('TendJar').map(jarLift)) > 0.999)
  for (const age of agesOf('TendJar')) if (jarLift(age) > 0) assert.equal(hand(age)?.holds, 'Jar', `the jar floats at ${age} s`)
  // With the jar at his eyes, his working arm is higher than when he reaches for it.
  const shoulder = (age: number) => poseMannerisms([{ mannerism: { _tag: 'TendJar' }, age, side: 1 }]).turns['left-shoulder']![0]
  const lifted = agesOf('TendJar').find(age => jarLift(age) > 0.999)!
  assert.ok(shoulder(lifted) < shoulder(1.2) - 0.2, `the lifted arm turns ${shoulder(lifted)} and the reaching arm ${shoulder(1.2)}`)
})

test('at the vending machine he smacks it twice, the second blow harder, and draws his arm back before each', () => {
  const ages = agesOf('SmackMachine')
  // The moments the count of blows rises. It never falls.
  const blows = ages.filter((age, index) => index > 0 && machineSmacks(age) > machineSmacks(ages[index - 1]!))
  assert.equal(machineSmacks(0), 0)
  assert.equal(blows.length, 2)
  assert.equal(machineSmacks(mannerismDuration({ _tag: 'SmackMachine' })), 2)
  // The shoulder of the arm on the machine's side. Its first turn lifts the arm forward, and its last swings it out toward the machine.
  const arm = (age: number) => poseMannerisms([{ mannerism: { _tag: 'SmackMachine' }, age, side: 1 }]).turns['left-shoulder']!
  // The hand lands a moment after the count rises. The second blow swings further out than the first.
  const [first, second] = blows.map(age => arm(age + 0.08)[2])
  assert.ok(second! > first! + 0.05, `the second blow swings out ${second}, the first ${first}`)
  // Just before each blow he draws the arm back: further back than it was a moment before, and far behind and inside where the blow lands.
  for (const age of blows) {
    const [ready, drawn, landed] = [arm(age - 0.6), arm(age - 0.05), arm(age + 0.08)]
    assert.ok(drawn[0] > ready[0] + 0.2, `at ${age} s the arm is drawn to ${drawn} from ${ready}`)
    assert.ok(drawn[0] > landed[0] + 0.2 && drawn[2] < landed[2] - 0.2, `at ${age} s the arm is drawn to ${drawn} and lands at ${landed}`)
  }
})

test('following a fly, his head turns both ways, and his jaw opens only around the snap', () => {
  const poses = agesOf('TrackFly').map(age => ({ age, pose: poseMannerisms([{ mannerism: { _tag: 'TrackFly' }, age }]) }))
  const turns = poses.map(({ pose }) => pose.turns.head?.[1] ?? 0)
  assert.ok(Math.max(...turns) > 0.3 && Math.min(...turns) < -0.3, `his head turns only from ${Math.min(...turns)} to ${Math.max(...turns)}`)
  // The jaw opens wide once. Every moment it is open lies within a third of a second of that snap.
  const snap = poses.reduce((widest, entry) => entry.pose.jaw > widest.pose.jaw ? entry : widest)
  assert.ok(snap.pose.jaw > 0.5)
  for (const { age, pose } of poses) if (pose.jaw > 0) assert.ok(Math.abs(age - snap.age) < 0.3, `his jaw is open at ${age} s, far from the snap at ${snap.age} s`)
})
