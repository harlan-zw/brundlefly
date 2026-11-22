import { DurableObject } from 'cloudflare:workers'
import { emptyRun, readCommand, release, voteIntervalMs } from '../shared/office-experiment.ts'
import type { RoomMessage, Run } from '../shared/office-experiment.ts'

type Visitor = { participant: string, network: string, host: boolean }
const participantCookie = 'brundlefly-office-participant'
const networkLimit = 100
type Enrollment = { participant: string, last_vote: number | null }
const send = (socket: WebSocket, data: RoomMessage) => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data))
}

export class OfficeRoom extends DurableObject<Env> {
  private run: Run | null
  private identityKey: Promise<CryptoKey>
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    const storage = ctx.storage.sql
    storage.exec('CREATE TABLE IF NOT EXISTS identity_key (id INTEGER PRIMARY KEY, secret TEXT NOT NULL)')
    storage.exec('INSERT OR IGNORE INTO identity_key VALUES (1, ?)', crypto.randomUUID())
    const secret = storage.exec<{ secret: string }>('SELECT secret FROM identity_key WHERE id=1').toArray()[0]!.secret
    this.identityKey = crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    storage.exec(`CREATE TABLE IF NOT EXISTS participants (
      token TEXT PRIMARY KEY, participant TEXT UNIQUE NOT NULL, network TEXT NOT NULL,
      enrolled INTEGER NOT NULL, last_vote INTEGER, last_network TEXT)`)
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
    const audience = new Set(guests.map(guest => guest.participant))
    for (const guest of guests) if (guest.host) audience.delete(guest.participant)
    return audience.size
  }
  private snapshot(): RoomMessage {
    return { op: 'snapshot', run: this.run, now: Date.now(), connected: this.connected() }
  }
  private save(run: Run | null) {
    this.run = run
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO experiment VALUES (1, ?)', JSON.stringify(run))
  }
  async fetch(request: Request) {
    const device = new URL(request.url).searchParams.get('device')
    // Cloudflare sets this header at ingress. Forwarding headers cannot select the network quota.
    const address = request.headers.get('CF-Connecting-IP')
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket' || !address || !device || !/^[\w-]{1,80}$/.test(device))
      return new Response('Invalid office connection.', { status: 400 })
    // Keep addresses out of socket attachments, broadcasts, and saved runs. Persist the key across object restarts.
    const signature = await crypto.subtle.sign('HMAC', await this.identityKey, new TextEncoder().encode(address))
    const network = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('')
    const storage = this.ctx.storage.sql
    const now = Date.now()
    storage.exec('DELETE FROM participants WHERE enrolled <= ?', now - 86400_000)
    const token = request.headers.get('Cookie')?.split(';').map(part => part.trim())
      .find(part => part.startsWith(participantCookie + '='))?.slice(participantCookie.length + 1)
    let enrollment = token && storage.exec<Enrollment>('SELECT participant, last_vote FROM participants WHERE token = ?', token).toArray()[0]
    const headers = new Headers()
    if (!enrollment) {
      // Allow a venue audience, but bound fresh identities even when cookies are discarded.
      const recent = storage.exec<{ count: number }>('SELECT COUNT(*) AS count FROM participants WHERE network = ? AND enrolled > ?', network, now - 60_000).toArray()[0]!.count
      const total = storage.exec<{ count: number }>('SELECT COUNT(*) AS count FROM participants').toArray()[0]!.count
      if (recent >= networkLimit || total >= 5000) return new Response(null, { status: 429, headers: { 'Retry-After': '60' } })
      const credential = crypto.randomUUID()
      enrollment = { participant: crypto.randomUUID(), last_vote: null }
      storage.exec('INSERT INTO participants (token, participant, network, enrolled) VALUES (?, ?, ?, ?)', credential, enrollment.participant, network, now)
      // The bearer cookie differs from public drop IDs. Browsers retain cookies from the upgrade response.
      const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
      headers.set('Set-Cookie', `${participantCookie}=${credential}; Path=/api/office; HttpOnly; SameSite=Strict; Max-Age=86400${secure}`)
    }
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ participant: enrollment.participant, network, host: false } satisfies Visitor)
    send(server, this.snapshot())
    this.broadcast({ op: 'presence', connected: this.connected() }, server)
    return new Response(null, { status: 101, webSocket: client, headers })
  }
  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer) {
    const command = typeof raw === 'string' && readCommand(raw)
    if (!command) { socket.close(1008, 'Invalid command'); return }
    const guest = socket.deserializeAttachment() as Visitor
    // Connections accepted before identity binding must reconnect before sending commands.
    if (!guest.participant || !guest.network) { socket.close(1008, 'Invalid command'); return }
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
      const prefix = guest.participant + ':'
      const storage = this.ctx.storage.sql
      const enrollment = storage.exec<Enrollment>('SELECT participant, last_vote FROM participants WHERE participant = ?', guest.participant).toArray()[0]
      if (!enrollment) { socket.close(1008, 'Invalid command'); return }
      if (enrollment.last_vote !== null && now - enrollment.last_vote < voteIntervalMs) return
      const recent = storage.exec<{ count: number }>('SELECT COUNT(*) AS count FROM participants WHERE last_network = ? AND last_vote > ?', guest.network, now - voteIntervalMs).toArray()[0]!.count
      if (recent >= networkLimit) return
      const next = release(this.run, command.kind, prefix + command.id, guest.host, now)
      if (next === this.run) return
      storage.exec('UPDATE participants SET last_vote = ?, last_network = ? WHERE participant = ?', now, guest.network, guest.participant)
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
