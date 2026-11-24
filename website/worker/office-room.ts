import { DurableObject } from 'cloudflare:workers'
import { addTaps, defaultParty, emptyExperiment, goCritical, readCommand, readExperiment, readPartySettings, resetExperiment, setTarget, specimenCount, tapsPerSecond } from '../shared/office-experiment.ts'
import type { Command, Experiment, PartySettings, RoomMessage } from '../shared/office-experiment.ts'

const socketLimit = 400
const broadcastEveryMs = 80
const criticalLifeMs = 30 * 60_000
const idleLifeMs = 2 * 3600_000

type Attachment = { watcher: boolean }
/** The taps one socket spent in one clock second. */
type Spent = { second: number, taps: number }

/** When the run clears itself. A critical run lasts 30 minutes. A counting run lasts 2 hours after its last tap. A quiet run never clears. */
const clearsAt = (experiment: Experiment, lastTap: number) => {
  if (experiment.criticalAt !== null) return experiment.criticalAt + criticalLifeMs
  return specimenCount(experiment) > 0 ? lastTap + idleLifeMs : null
}

/** One socket gets at most `tapsPerSecond` taps in one clock second. The server drops the rest. */
const spendTaps = (spent: Spent | undefined, taps: number, now: number) => {
  const second = Math.floor(now / 1000)
  const used = spent?.second === second ? spent.taps : 0
  const accepted = Math.min(taps, tapsPerSecond - used)
  return { spent: { second, taps: used + accepted }, accepted }
}

const applyCommand = (experiment: Experiment, command: Exclude<Command, { op: 'tap' | 'party' }>, now: number) => {
  if (command.op === 'reset') return resetExperiment(experiment)
  if (command.op === 'target') return setTarget(experiment, command.value, now)
  return goCritical(experiment, now)
}

/** Read stored text with a parser. Text that is not JSON gives nothing, so a spoiled row starts from the defaults. */
const readJson = <T>(text: string, read: (value: unknown) => T | undefined) => {
  let data: unknown
  try { data = JSON.parse(text) }
  catch { return } // A spoiled row is no value.
  return read(data)
}
/** The stored experiment has the wire shape, so the wire parser checks it. */
const readSaved = (text: string) => readJson(text, readExperiment)

/**
 * The one shared experiment of the office. Every change lands in memory at once.
 * A flush saves the state and sends all of it to every socket.
 */
export class OfficeRoom extends DurableObject<Env> {
  private experiment: Experiment
  /** The time of the last accepted tap. The idle deadline counts from it. */
  private lastTap: number
  /** The celebration settings. A reset keeps them: they belong to the presenter's song, not to a run. */
  private party: PartySettings
  private spent = new Map<WebSocket, Spent>()
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    const storage = ctx.storage.sql
    storage.exec('CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK (id = 1), experiment TEXT NOT NULL, last_tap INTEGER NOT NULL, party TEXT)')
    const row = storage.exec<{ experiment: string, last_tap: number, party: string | null }>('SELECT experiment, last_tap, party FROM room WHERE id = 1').toArray()[0]
    this.experiment = (row && readSaved(row.experiment)) ?? emptyExperiment()
    this.lastTap = row?.last_tap ?? 0
    this.party = (row?.party ? readJson(row.party, readPartySettings) : undefined) ?? defaultParty
  }

  private state(): RoomMessage {
    const connected = this.ctx.getWebSockets()
      .filter(socket => socket.readyState === WebSocket.OPEN && !(socket.deserializeAttachment() as Attachment).watcher).length
    return { op: 'state', experiment: this.experiment, connected, now: Date.now(), party: this.party }
  }

  /** Save the state and send it to every socket now. */
  private flush() {
    clearTimeout(this.flushTimer)
    this.flushTimer = null
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO room (id, experiment, last_tap, party) VALUES (1, ?, ?, ?)', JSON.stringify(this.experiment), this.lastTap, JSON.stringify(this.party))
    const message = JSON.stringify(this.state())
    for (const socket of this.ctx.getWebSockets()) if (socket.readyState === WebSocket.OPEN) socket.send(message)
  }

  /** Flush soon. Changes that arrive before then go out in the same message. */
  private scheduleFlush() {
    this.flushTimer ??= setTimeout(() => this.flush(), broadcastEveryMs)
  }

  /** Make sure an alarm fires at or before the time the run clears. An earlier alarm stays, and `alarm` checks again. */
  private async arm() {
    const due = clearsAt(this.experiment, this.lastTap)
    if (due === null) return
    const armed = await this.ctx.storage.getAlarm()
    if (armed === null || armed > due) await this.ctx.storage.setAlarm(due)
  }

  fetch(request: Request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Connect with a WebSocket.', { status: 400 })
    if (this.ctx.getWebSockets().length >= socketLimit) return new Response('The office is full.', { status: 503 })
    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ watcher: new URL(request.url).searchParams.has('watch') } satisfies Attachment)
    server.send(JSON.stringify(this.state()))
    this.scheduleFlush()
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    const command = typeof message === 'string' ? readCommand(message) : undefined
    // An invalid message changes nothing. The socket stays open.
    if (!command) return
    const now = Date.now()
    const before = this.experiment
    if (command.op === 'party') {
      // The presenter's page sends the settings of its song. They are public, as the other presenter commands are.
      this.party = command.settings
      this.flush()
      return
    }
    if (command.op !== 'tap') {
      // Reset, target and critical are public on purpose. The presenter page has no key.
      this.experiment = applyCommand(before, command, now)
      this.flush()
      await this.arm()
      return
    }
    const { spent, accepted } = spendTaps(this.spent.get(socket), command.taps, now)
    this.spent.set(socket, spent)
    this.experiment = addTaps(before, command.kind, accepted, now)
    if (this.experiment === before) return
    this.lastTap = now
    // The tap that reaches the target goes out at once. Other taps wait for the next flush.
    if (this.experiment.criticalAt !== null) this.flush()
    else this.scheduleFlush()
    // Only the first specimen and the critical tap move the deadline earlier. Later taps move it later, and `alarm` checks again.
    if (specimenCount(before) === 0 || this.experiment.criticalAt !== null) await this.arm()
  }

  async alarm() {
    const due = clearsAt(this.experiment, this.lastTap)
    if (due === null) return
    if (Date.now() < due) {
      await this.ctx.storage.setAlarm(due)
      return
    }
    this.experiment = resetExperiment(this.experiment)
    this.flush()
  }

  private drop(socket: WebSocket) {
    this.spent.delete(socket)
    this.scheduleFlush()
    // A close from the visitor needs a close in reply. The runtime can send it first.
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CLOSING) socket.close(1000, 'Goodbye')
  }

  webSocketClose(socket: WebSocket) {
    this.drop(socket)
  }

  webSocketError(socket: WebSocket) {
    this.drop(socket)
  }
}
