import { computed, onMounted, onScopeDispose, shallowRef } from 'vue'
import { useEventListener } from '@vueuse/core'
import { partyDefaults, partyFileBytes, partyLength, partyLevel, partyPlan, readPartyTrack, stopLevel } from '#shared/party-track'
import type { PartyTrack } from '#shared/party-track'

/** `Unavailable`: the browser refused the track storage, or refused to play the stored file. */
export type PartyStatus = 'Idle' | 'Waiting' | 'Playing' | 'Unavailable'
export type PartyFailure = 'NotAudio' | 'TooLarge' | 'StorageRefused' | 'NoTrack'
export type PartyResult = { _tag: 'Ok' } | { _tag: 'Err', reason: PartyFailure }

export type PartyOptions = {
  /** A steady clock in milliseconds. */
  now?: () => number
  /** The browser's IndexedDB. */
  storage?: () => IDBFactory
  /** A new audio context, or `undefined` to fade by element volume. */
  createContext?: () => AudioContext | undefined
}

// One database with one store and one record: the file, its name, and the settings.
const databaseName = 'brundlefly-party'
const storeName = 'track'
const recordKey = 'current'
// Tabs of the same browser tell each other to read the record again.
const channelName = 'brundlefly-party'
// A file whose metadata does not load in this time is not playable here.
const probeMs = 15_000
// Gain values per second in a scheduled fade.
const curveRate = 60

type Stored = { file: Blob, track: PartyTrack, storedAt: number }
type Output = { _tag: 'Gain', context: AudioContext, gain: GainNode } | { _tag: 'Volume' }
/** One playback. The level is a function of the file position, so the fade follows the music. */
type Run = { hitAt: number, minLeadIn?: number, timer?: ReturnType<typeof setTimeout>, frame?: number, level?: (position: number) => number, end?: number }

const ok: PartyResult = { _tag: 'Ok' }
const err = (reason: PartyFailure): PartyResult => ({ _tag: 'Err', reason })

function readStored(value: unknown): Stored | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { file, track, storedAt } = value as Record<string, unknown>
  const parsed = readPartyTrack(track)
  return file instanceof Blob && parsed && typeof storedAt === 'number' ? { file, track: parsed, storedAt } : undefined
}

/**
 * Opens the database. Without `create`, a browser that has no database gets `undefined`, and no new database.
 * The open aborts the upgrade that would create it, so a phone in the room stores nothing.
 */
function openDatabase(factory: () => IDBFactory, create: boolean) {
  return new Promise<IDBDatabase | undefined>((resolve, reject) => {
    // A browser that refuses storage throws here. The promise turns that into a rejection.
    const request = factory().open(databaseName, 1)
    let skipped = false
    request.onupgradeneeded = (event) => {
      if (create || event.oldVersion > 0) request.result.createObjectStore(storeName)
      else {
        skipped = true
        request.transaction?.abort()
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = (event) => {
      if (!skipped) return reject(request.error)
      // The abort above is the expected end of this open, not a failure.
      event.preventDefault()
      resolve(undefined)
    }
  })
}

function transact(database: IDBDatabase, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest) {
  return new Promise<unknown>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const request = work(transaction.objectStore(storeName))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onabort = () => reject(transaction.error ?? new Error('The browser stopped the track storage.'))
  })
}

/** True when this browser can read the file's metadata as media. */
function playable(file: Blob) {
  return new Promise<boolean>((resolve) => {
    const element = new Audio()
    const source = URL.createObjectURL(file)
    const done = (result: boolean) => {
      clearTimeout(timer)
      element.onloadedmetadata = element.onerror = null
      element.removeAttribute('src')
      element.load()
      URL.revokeObjectURL(source)
      resolve(result)
    }
    const timer = setTimeout(done, probeMs, false)
    element.preload = 'metadata'
    element.onloadedmetadata = () => done(true)
    element.onerror = () => done(false)
    element.src = source
  })
}

/** The level from `from` to `to` seconds of file position, as gain values for `setValueCurveAtTime`. */
function curve(level: (position: number) => number, from: number, to: number) {
  const count = Math.max(2, Math.ceil((to - from) * curveRate) + 1)
  return Float32Array.from({ length: count }, (_, index) => level(from + (to - from) * index / (count - 1)))
}

/**
 * The celebration track of this browser. The presenter page stores it. The office page plays it when the cave appears.
 * The file stays in this browser's IndexedDB. A browser with no stored file plays nothing, so phones in the room stay silent.
 * The browser lets a page play sound only after a person selects something on it. A first gesture on the page prepares the sound.
 */
export function usePartyTrack(options: PartyOptions = {}) {
  const now = options.now ?? (() => performance.now())
  const storage = options.storage ?? (() => indexedDB)
  const createContext = options.createContext ?? (() => typeof AudioContext === 'function' ? new AudioContext() : undefined)

  const track = shallowRef<PartyTrack | null>(null)
  const status = shallowRef<PartyStatus>('Idle')
  const duration = shallowRef<number | null>(null)

  let stored: Stored | undefined
  let url: string | undefined
  let audio: HTMLAudioElement | undefined
  let output: Output | undefined
  let channel: BroadcastChannel | undefined
  let connection: Promise<IDBDatabase> | undefined
  let run: Run | undefined
  let storageRefused = false
  let ready = false
  let loaded = Promise.resolve()

  const resting = () => storageRefused ? 'Unavailable' : 'Idle'

  /** The open database. Without `create`, a browser that never stored a track gets `undefined`. A failed open rejects, and a later call tries again. */
  async function open(create: boolean) {
    if (connection) return connection
    const database = await openDatabase(storage, create)
    if (!database) return undefined
    // Two opens can race. The first one to finish is kept.
    if (connection) {
      database.close()
      return connection
    }
    // A newer version in another tab needs this connection closed.
    database.onversionchange = () => { database.close(); connection = undefined }
    connection = Promise.resolve(database)
    return database
  }
  // With `create`, the open never gives `undefined`.
  const connect = () => open(true) as Promise<IDBDatabase>

  function finish(current: Run) {
    if (run !== current) return
    run = undefined
    clearTimeout(current.timer)
    if (current.frame !== undefined) cancelAnimationFrame(current.frame)
    if (audio && !audio.paused) audio.pause()
    if (output?._tag === 'Gain') {
      output.gain.gain.cancelScheduledValues(0)
      output.gain.gain.value = 0
    }
    status.value = resting()
  }
  const halt = () => { if (run) finish(run) }
  function refuse(current: Run | undefined, message: string, error: unknown) {
    if (current) finish(current)
    console.warn(message, error)
    status.value = 'Unavailable'
  }

  function element() {
    if (audio) return audio
    const created = audio = new Audio()
    created.preload = 'auto'
    const measure = () => { duration.value = Number.isFinite(created.duration) ? created.duration : null }
    created.addEventListener('loadedmetadata', measure)
    created.addEventListener('durationchange', measure)
    // A file can end before the plan does.
    created.addEventListener('ended', halt)
    created.addEventListener('error', () => {
      if (created.getAttribute('src')) refuse(run, 'The browser cannot play the stored celebration track. Choose another file.', created.error)
    })
    return created
  }
  function release() {
    if (!url) return
    audio?.removeAttribute('src')
    audio?.load()
    URL.revokeObjectURL(url)
    url = undefined
    duration.value = null
  }
  /** Shows a record. A new file stops the old one at once. A change of settings alone keeps a playback going. */
  function apply(next: Stored | undefined) {
    if (next?.storedAt !== stored?.storedAt) {
      halt()
      release()
      if (next) {
        url = URL.createObjectURL(next.file)
        element().src = url
      }
    }
    stored = next
    track.value = next?.track ?? null
  }
  async function reload() {
    const database = await open(false)
    const record = database ? readStored(await transact(database, 'readonly', store => store.get(recordKey))) : undefined
    if (storageRefused && !run) status.value = 'Idle'
    storageRefused = false
    apply(record)
  }
  const load = () => reload().catch((error: unknown) => {
    storageRefused = true
    refuse(run, 'The celebration track cannot load. The browser refused its storage.', error)
  })

  // Writes run one after another, so each change merges into the record the one before it left.
  let writes: Promise<unknown> = Promise.resolve()
  function queued(work: () => Promise<PartyResult>) {
    const result = writes.then(work)
    writes = result
    return result
  }

  async function write(next: Stored): Promise<PartyResult> {
    return connect()
      .then(database => transact(database, 'readwrite', store => store.put(next, recordKey)))
      .then(() => {
        apply(next)
        channel?.postMessage('changed')
        return ok
      }, (error: unknown) => {
        console.warn('The browser refused to store the celebration track.', error)
        return err('StorageRefused')
      })
  }

  /** Stores a file the presenter chose. Settings that are not given take their defaults. */
  async function choose(file: File, settings: Partial<PartyTrack> = {}): Promise<PartyResult> {
    if (file.type && !/^(?:audio|video)\//.test(file.type)) return err('NotAudio')
    if (file.size > partyFileBytes) return err('TooLarge')
    if (!(await playable(file))) return err('NotAudio')
    const parsed = readPartyTrack({ ...partyDefaults, ...settings, name: file.name || file.type || 'audio' })!
    return queued(() => write({ file, track: parsed, storedAt: Date.now() }))
  }
  /** Changes the settings of the stored track. The name stays the file's name. */
  function update(settings: Partial<PartyTrack>): Promise<PartyResult> {
    return queued(async () => {
      if (!stored) return err('NoTrack')
      const parsed = readPartyTrack({ ...stored.track, ...settings, name: stored.track.name })!
      return write({ ...stored, track: parsed })
    })
  }
  /** Removes the stored file. */
  function remove(): Promise<PartyResult> {
    halt()
    return queued(() => connect()
      .then(database => transact(database, 'readwrite', store => store.delete(recordKey)))
      .then(() => {
        apply(undefined)
        channel?.postMessage('changed')
        return ok
      }, (error: unknown) => {
        console.warn('The browser refused to remove the celebration track.', error)
        return err('StorageRefused')
      }))
  }

  /** The route of the sound: a gain node, or element volume where Web Audio is refused. */
  function route(media: HTMLAudioElement): Output {
    if (output) return output
    try {
      const context = createContext()
      if (!context) return output = { _tag: 'Volume' }
      const gain = context.createGain()
      gain.gain.value = 0
      context.createMediaElementSource(media).connect(gain).connect(context.destination)
      return output = { _tag: 'Gain', context, gain }
    }
    catch (error) {
      console.warn('The celebration track fades by element volume. The browser refused Web Audio.', error)
      return output = { _tag: 'Volume' }
    }
  }
  /** True when the context runs. A context that waits for a gesture can keep its promise open, so the wait has a limit. */
  function running(sink: Output) {
    if (sink._tag === 'Volume' || sink.context.state === 'running') return Promise.resolve(true)
    const resumed = sink.context.resume().then(() => true, (error: unknown) => {
      console.warn('The browser refused to start the celebration track\'s audio.', error)
      return false
    })
    return Promise.race([resumed, new Promise<boolean>(resolve => setTimeout(resolve, 1000, false))])
  }

  /** Applies the run's level from the current file position to its end. */
  function shape(current: Run, sink: Output, media: HTMLAudioElement) {
    const { level, end } = current
    if (!level || end === undefined) return
    const position = media.currentTime
    if (current.frame !== undefined) cancelAnimationFrame(current.frame)
    if (sink._tag === 'Gain') {
      const param = sink.gain.gain
      param.cancelScheduledValues(0)
      if (end > position) param.setValueCurveAtTime(curve(level, position, end), sink.context.currentTime, end - position)
      else param.value = 0
    }
    else {
      const step = () => {
        media.volume = level(media.currentTime)
        current.frame = requestAnimationFrame(step)
      }
      step()
    }
    // The run ends at the end of its level. A file that stalls keeps the run open until it gets there.
    const watch = () => {
      clearTimeout(current.timer)
      const left = end - media.currentTime
      if (left <= 0.02 || media.paused) finish(current)
      else current.timer = setTimeout(watch, left * 1000 + 20)
    }
    watch()
  }

  function begin(current: Run) {
    current.timer = undefined
    if (run !== current || !audio) return
    const media = audio
    const sink = route(media)
    if (sink._tag === 'Gain') {
      sink.gain.gain.cancelScheduledValues(0)
      sink.gain.gain.value = 0
    }
    else media.volume = 0
    void running(sink).then((started) => {
      if (run !== current) return
      if (!started) return refuse(current, 'The browser refused to play the celebration track. Select anything on the page once, then try again.', sink._tag === 'Gain' ? `The audio context is ${sink.context.state}.` : undefined)
      // The plan comes again here, so a late timer or a slow start still lands the chorus on the hit.
      const effective = stored && current.minLeadIn !== undefined ? { ...stored.track, leadIn: Math.max(stored.track.leadIn, current.minLeadIn) } : stored?.track
      const plan = effective && partyPlan(effective, (current.hitAt - now()) / 1000)
      if (!plan) return finish(current)
      // The file waits near this position already. A seek costs start time, so a small difference stays. The level follows the file position anyway.
      if (Math.abs(media.currentTime - plan.startAt) > 0.05) media.currentTime = plan.startAt
      current.level = position => partyLevel(plan, position - plan.startAt)
      current.end = plan.startAt + partyLength(plan)
      media.play().then(() => {
        if (run !== current) return media.pause()
        status.value = 'Playing'
        shape(current, sink, media)
      }, (error: unknown) => refuse(current, 'The browser refused to play the celebration track. Select anything on the page once, then try again.', error))
    })
  }

  /**
   * Starts the celebration: the chorus hits `secondsUntilHit` seconds from now. It does nothing without a track.
   * When `fullFade` is true, the fade starts immediately across the entire swell even if the stored `leadIn` is shorter.
   * A second call while one waits or plays is ignored.
   */
  function play(secondsUntilHit: number, fullFade = false) {
    if (run || !Number.isFinite(secondsUntilHit) || (ready && !stored)) return
    const current: Run = { hitAt: now() + secondsUntilHit * 1000, minLeadIn: fullFade ? secondsUntilHit : undefined }
    run = current
    status.value = 'Waiting'
    void loaded.then(() => {
      if (run !== current) return
      const effective = stored && current.minLeadIn !== undefined ? { ...stored.track, leadIn: Math.max(stored.track.leadIn, current.minLeadIn) } : stored?.track
      const plan = effective && partyPlan(effective, (current.hitAt - now()) / 1000)
      if (!plan || !audio) return finish(current)
      // The file waits at its start position, so it starts at once.
      audio.currentTime = plan.startAt
      current.timer = setTimeout(begin, plan.startIn * 1000, current)
    })
  }
  /** Fades out over `seconds` (by default the track's fade out) and stops. It also cancels a playback that still waits. */
  function stop(seconds = stored?.track.fadeOut ?? partyDefaults.fadeOut) {
    const current = run
    if (!current) return
    const { level, end } = current
    if (!level || end === undefined || !audio || !output) return finish(current)
    const position = audio.currentTime
    const from = level(position)
    const length = Math.max(0, seconds)
    current.level = at => Math.min(level(at), stopLevel(from, length, at - position))
    current.end = Math.min(end, position + length)
    shape(current, output, audio)
  }

  // A first gesture on the page starts the audio context, so a later timed start can play.
  const prepare = () => {
    if (!audio || !stored) return
    const sink = route(audio)
    if (sink._tag === 'Gain' && sink.context.state === 'suspended') void running(sink)
  }
  useEventListener('pointerdown', prepare, { capture: true, passive: true })
  useEventListener('keydown', prepare, { capture: true, passive: true })

  onMounted(() => {
    if (typeof BroadcastChannel === 'function') {
      channel = new BroadcastChannel(channelName)
      channel.onmessage = () => { void load() }
    }
    loaded = load().then(() => { ready = true })
  })
  onScopeDispose(() => {
    halt()
    release()
    channel?.close()
    if (output?._tag === 'Gain') output.context.close().catch((error: unknown) => console.warn('The celebration track\'s audio did not close.', error))
    void connection?.then(database => database.close())
  })

  return {
    /** The chosen track's settings, or `null` when no file is stored. */
    track: computed(() => track.value),
    status: computed(() => status.value),
    /** The stored file's length in seconds, once its metadata has loaded. */
    duration: computed(() => duration.value),
    choose,
    update,
    remove,
    play,
    stop,
  }
}
