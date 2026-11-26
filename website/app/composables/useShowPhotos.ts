import { onMounted, onScopeDispose, ref } from 'vue'

export type ShowPhotoSlot = 'scientist' | 'brundle'
export type ShowPhotos = Record<ShowPhotoSlot, string | null>

const storageKey = 'brundlefly-show-photos'
const channelName = 'brundlefly-show-photos'
const maxDimension = 640

function readStored(): ShowPhotos {
  if (!import.meta.client) return { scientist: null, brundle: null }
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { scientist: null, brundle: null }
    const data = JSON.parse(raw) as Partial<ShowPhotos>
    return {
      scientist: typeof data.scientist === 'string' && data.scientist.startsWith('data:image/') ? data.scientist : null,
      brundle: typeof data.brundle === 'string' && data.brundle.startsWith('data:image/') ? data.brundle : null,
    }
  }
  catch {
    return { scientist: null, brundle: null }
  }
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
      const width = Math.max(1, Math.round(image.naturalWidth * scale))
      const height = Math.max(1, Math.round(image.naturalHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      URL.revokeObjectURL(url)
      if (!ctx) return reject(new Error('Canvas unavailable.'))
      ctx.drawImage(image, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be read as an image.'))
    }
    image.src = url
  })
}

/**
 * Local-only photos for the Slide 1, 2, and 4 staff portraits on `/projector?show`.
 * Stored in `localStorage` and synced across tabs in the same browser; never uploaded.
 */
export function useShowPhotos() {
  const photos = ref<ShowPhotos>({ scientist: null, brundle: null })
  let channel: BroadcastChannel | undefined

  const sync = () => { photos.value = readStored() }
  const save = (next: ShowPhotos) => {
    photos.value = next
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      channel?.postMessage('changed')
    }
    catch (error) {
      console.warn('The browser refused to store the show photos.', error)
    }
  }

  async function choose(slot: ShowPhotoSlot, file: File): Promise<boolean> {
    if (file.type && !file.type.startsWith('image/')) return false
    try {
      const dataUrl = await resizeImage(file)
      save({ ...photos.value, [slot]: dataUrl })
      return true
    }
    catch (error) {
      console.warn('Could not load the chosen show photo.', error)
      return false
    }
  }

  function remove(slot: ShowPhotoSlot) {
    save({ ...photos.value, [slot]: null })
  }

  onMounted(() => {
    sync()
    if (typeof BroadcastChannel === 'function') {
      channel = new BroadcastChannel(channelName)
      channel.onmessage = sync
    }
    window.addEventListener('storage', sync)
  })
  onScopeDispose(() => {
    channel?.close()
    if (import.meta.client) window.removeEventListener('storage', sync)
  })

  return { photos, choose, remove }
}
