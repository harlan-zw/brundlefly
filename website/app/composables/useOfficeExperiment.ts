import { computed, onMounted, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useIntervalFn, useLocalStorage } from '@vueuse/core'
import { emptyRun, phase, release, specimenCount, voteIntervalMs } from '#shared/office-experiment'
import type { Command, Creature, RoomMessage, Run, Station } from '#shared/office-experiment'

export function useOfficeExperiment(office: () => boolean, mode: () => 'present' | 'rehearse' | 'guest') {
  const room = shallowRef<Run | null>(null)
  const readyAt = ref(0)
  const connected = ref(0)
  const online = ref(false)
  const host = ref(false)
  const error = ref('')
  const station = ref<Station>('desk')
  const device = useLocalStorage('brundlefly-office-device', '')
  const now = ref(0)
  let offset = 0
  let key = ''
  let retry: ReturnType<typeof setTimeout> | undefined
  let socket: WebSocket | undefined
  const clock = () => Date.now() + offset
  const stage = computed(() => phase(room.value, now.value))
  const count = computed(() => specimenCount(room.value))
  const rehearsal = computed(() => mode() === 'rehearse')
  const send = (command: Command) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(command))
  }
  const take = (message: RoomMessage) => {
    switch (message.op) {
      case 'snapshot':
        offset = message.now - Date.now()
        now.value = clock()
        room.value = message.run
        connected.value = message.connected
        break
      case 'drop':
        if (room.value?.id === message.run && message.drop.first === count.value + 1)
          room.value = { ...room.value, drops: [...room.value.drops, message.drop] }
        break
      case 'presence': connected.value = message.connected; break
      case 'host': host.value = true; error.value = ''; break
      case 'error': key = ''; error.value = message.message; break
    }
  }
  function disconnect() {
    clearTimeout(retry)
    if (socket) {
      socket.onclose = null
      socket.onmessage = null
      socket.close()
      socket = undefined
    }
    online.value = false
  }
  function connect() {
    if (!device.value) device.value = crypto.randomUUID()
    const endpoint = new URL('/api/office', location.href)
    endpoint.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    endpoint.searchParams.set('device', device.value)
    socket = new WebSocket(endpoint)
    socket.onopen = () => {
      online.value = true
      if (key) send({ op: 'host', key })
    }
    socket.onmessage = event => take(JSON.parse(event.data) as RoomMessage)
    socket.onclose = () => {
      online.value = false
      host.value = false
      retry = setTimeout(connect, 2500)
    }
  }
  const { pause, resume } = useIntervalFn(() => {
    now.value = clock()
    if (rehearsal.value && room.value && phase(room.value, now.value) === 'running') {
      const kinds = ['beetle', 'fly', 'cricket', 'snail'] as const
      const turn = room.value.drops.length
      room.value = release(room.value, kinds[turn % kinds.length]!, 'rehearsal-' + turn, false, now.value)
    }
  }, 100, { immediate: false })
  watch(() => room.value?.id, id => {
    readyAt.value = 0
    now.value = clock()
    if (id) resume()
    else pause()
    station.value = room.value?.drops.length ? 'desk' : mode() === 'guest' ? 'computer' : 'board'
  })
  let stop: (() => void) | undefined
  onMounted(() => {
    stop = watch([() => office() || Boolean(room.value), mode], ([active]) => {
      disconnect()
      if (!active) return
      if (rehearsal.value) { host.value = online.value = true; return }
      connect()
    }, { immediate: true })
  })
  onScopeDispose(() => { stop?.(); disconnect() })
  function authenticate(value: string) { key = value; send({ op: 'host', key }) }
  function open() {
    if (rehearsal.value) { room.value = emptyRun(crypto.randomUUID()); now.value = clock() }
    else send({ op: 'open' })
  }
  function close() {
    if (!room.value) return
    if (rehearsal.value) room.value = null
    else send({ op: 'close', run: room.value.id })
  }
  function tap(kind: Creature) {
    if (!room.value || !online.value || clock() < readyAt.value) return
    readyAt.value = clock() + voteIntervalMs
    const id = crypto.randomUUID()
    if (rehearsal.value) room.value = release(room.value, kind, id, true, clock())
    else send({ op: 'tap', kind, id, run: room.value.id })
  }
  watch(stage, next => {
    if (next === 'running' || next === 'critical') station.value = 'desk'
  })
  return { room, readyAt, host, stage, station, count, connected, online, error, now, clock, rehearsal, authenticate, open, close, tap }
}
