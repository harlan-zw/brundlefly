import { DurableObject } from 'cloudflare:workers'
import { emptyRun, readCommand, release, voteIntervalMs } from '../shared/office-experiment.ts'
import type { RoomMessage, Run } from '../shared/office-experiment.ts'

type Visitor = { device: string, host: boolean }
const send = (socket: WebSocket, data: RoomMessage) => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data))
}

export class OfficeRoom extends DurableObject<Env> {
  private run: Run | null
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    const storage = ctx.storage.sql
    storage.exec('CREATE TABLE IF NOT EXISTS experiment (id INTEGER PRIMARY KEY, run TEXT NOT NULL)')
    const row = storage.exec<{ run: string }>('SELECT run FROM experiment WHERE id=1').toArray()[0]
    this.run = row ? JSON.parse(row.run) as Run : null
  }

  private broadcast(message: RoomMessage, omit?: WebSocket) {
    for (const socket of this.ctx.getWebSockets()) if (socket !== omit) send(socket, message)
  }
  private connected(omit?: WebSocket) {
    const guests = this.ctx.getWebSockets().filter(socket => socket !== omit && socket.readyState === WebSocket.OPEN)
      .map(socket => socket.deserializeAttachment() as Visitor)
    const audience = new Set(guests.map(guest => guest.device))
    for (const guest of guests) if (guest.host) audience.delete(guest.device)
    return audience.size
  }
  private snapshot(): RoomMessage {
    return { op: 'snapshot', run: this.run, now: Date.now(), connected: this.connected() }
  }
  private save(run: Run | null) {
    this.run = run
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO experiment VALUES (1, ?)', JSON.stringify(run))
  }
  fetch(request: Request) {
    const device = new URL(request.url).searchParams.get('device')
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket' || !device || !/^[\w-]{1,80}$/.test(device))
      return new Response('Invalid office connection.', { status: 400 })
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ device, host: false } satisfies Visitor)
    send(server, this.snapshot())
    this.broadcast({ op: 'presence', connected: this.connected() }, server)
    return new Response(null, { status: 101, webSocket: client })
  }
  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer) {
    const command = typeof raw === 'string' && readCommand(raw)
    if (!command) { socket.close(1008, 'Invalid command'); return }
    const guest = socket.deserializeAttachment() as Visitor
    if (command.op === 'host') {
      const encode = new TextEncoder()
      const expected = this.env.OFFICE_PRESENTER_KEY
      const supplied = encode.encode(command.key)
      const secret = encode.encode(expected)
      if (!expected || supplied.byteLength !== secret.byteLength || !crypto.subtle.timingSafeEqual(supplied, secret)) {
        send(socket, { op: 'error', message: 'Check the presenter key.' })
        return
      }
      socket.serializeAttachment({ ...guest, host: true })
      send(socket, { op: 'host' })
      this.broadcast({ op: 'presence', connected: this.connected() })
      return
    }
    if (command.op === 'open' && guest.host && !this.run) {
      this.save(emptyRun(crypto.randomUUID()))
      await this.ctx.storage.setAlarm(Date.now() + 30 * 60_000)
      this.broadcast(this.snapshot())
    } else if (command.op === 'close' && guest.host && command.run === this.run?.id) {
      this.save(null)
      this.broadcast(this.snapshot())
    } else if (command.op === 'tap' && this.run && command.run === this.run.id) {
      const now = Date.now()
      const prefix = guest.device + ':'
      const previous = this.run.drops.findLast(drop => drop.id.startsWith(prefix))
      if (previous && now - previous.at < voteIntervalMs) return
      const next = release(this.run, command.kind, prefix + command.id, guest.host, now)
      if (next === this.run) return
      this.save(next)
      this.broadcast({ op: 'drop', run: next.id, drop: next.drops.at(-1)! })
    }
  }
  alarm() {
    this.save(null)
    this.broadcast(this.snapshot())
  }
  webSocketClose(socket: WebSocket, code: number) {
    socket.close(code === 1000 ? 1000 : 1001)
    this.broadcast({ op: 'presence', connected: this.connected(socket) }, socket)
  }
}
