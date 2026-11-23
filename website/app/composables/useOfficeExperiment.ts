import { onMounted, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import { readRoomMessage, tapsPerSecond } from '#shared/office-experiment'
import type { Command, Creature, Experiment } from '#shared/office-experiment'

// Taps leave in small batches, so thirty fast phones send a few hundred messages a second and no more.
const sendEveryMs = 80

/**
 * The shared office experiment, as this visitor sees it. The connection stands while `active` is true.
 * `experiment` is the server's state. It is `null` until the first message, and again when `active` turns false.
 * A lost connection keeps the last state, and `online` says that it is not live.
 * A `watcher` reads and commands the room, and is not counted as a visitor in the office.
 */
export function useOfficeExperiment(active: () => boolean, role: 'visitor' | 'watcher' = 'visitor') {
  const experiment = shallowRef<Experiment | null>(null)
  const connected = ref(0)
  const online = ref(false)
  let offset = 0
  let socket: WebSocket | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  /** Server time. Every device times the critical scene from it. */
  const clock = () => Date.now() + (Number.isFinite(offset) ? offset : 0)
  const send = (command: Command) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(command))
  }
  // Taps the visitor made that have not left yet, by creature.
  const waiting = new Map<Creature, number>()
  const { pause, resume } = useIntervalFn(() => {
    for (const [kind, taps] of waiting) send({ op: 'tap', kind, taps })
    waiting.clear()
    pause()
  }, sendEveryMs, { immediate: false })
  function disconnect() {
    clearTimeout(retry)
    if (socket) {
      socket.onclose = socket.onmessage = socket.onopen = null
      socket.close()
      socket = undefined
    }
    waiting.clear()
    online.value = false
    experiment.value = null
  }
  function connect() {
    const endpoint = new URL('/api/office', location.href)
    endpoint.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    if (role === 'watcher') endpoint.searchParams.set('watch', '')
    const opened = socket = new WebSocket(endpoint)
    offset = -Infinity
    opened.onopen = () => { online.value = true }
    opened.onmessage = (event) => {
      const message = typeof event.data === 'string' ? readRoomMessage(event.data) : undefined
      if (!message) return
      // A message that waited in the network or behind a busy page reads the server's clock late. The least late message of the connection is the best reading.
      offset = Math.max(offset, message.now - Date.now())
      connected.value = message.connected
      experiment.value = message.experiment
    }
    // A lost connection keeps the last state on screen and tries again. The server sends the whole state on return.
    opened.onclose = () => {
      online.value = false
      retry = setTimeout(connect, 1500)
    }
  }
  let stop: (() => void) | undefined
  onMounted(() => {
    stop = watch(active, (wanted) => {
      disconnect()
      if (wanted) connect()
    }, { immediate: true })
  })
  onScopeDispose(() => { stop?.(); disconnect() })
  /** One tap on a creature. The server owns the rate limit and drops taps over `tapsPerSecond`. One message holds no more than that. */
  function tap(kind: Creature) {
    if (!online.value || experiment.value?.criticalAt !== null) return
    waiting.set(kind, Math.min(tapsPerSecond, (waiting.get(kind) ?? 0) + 1))
    resume()
  }
  return { experiment, connected, online, clock, tap,
    reset: () => send({ op: 'reset' }),
    setTarget: (value: number) => send({ op: 'target', value }),
    goCritical: () => send({ op: 'critical' }) }
}
