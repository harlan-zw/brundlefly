import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'

const origin = new URL(process.argv[2] ?? 'https://brundlefly.dev')
const output = new URL('../.output/public/', import.meta.url)
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const pages = ['/', '/brand-kit/', '/brand-kit/mascot/']
const required = new Set<string>(pages)

// Verify every texture and model, plus the scripts each exported page loads.
for (const name of await readdir(new URL('brand/kit/lair/', output))) {
  if (/\.(png|webp|glb)$/.test(name)) required.add(`/brand/kit/lair/${name}`)
}
for (const path of pages) {
  const html = await readFile(new URL(`.${path}index.html`, output), 'utf8')
  for (const match of html.matchAll(/(?:src|href)="([^"#?]+\.(?:js|css|woff2))"/g)) {
    required.add(new URL(match[1]!, new URL(path, origin)).pathname)
  }
}
for (const name of await readdir(new URL('skills/', output))) required.add(`/skills/${name}`)

const expected = await Promise.all([...required].map(async (path) => {
  const file = path.endsWith('/') ? `${path}index.html` : path
  return { path, hash: digest(await readFile(new URL(`.${file}`, output))) }
}))
const pending = new Map(expected.map(asset => [asset.path, asset.hash]))
const failures = new Map<string, string>()
const deadline = Date.now() + 240_000

while (pending.size) {
  const batch = [...pending].slice(0, 6)
  await Promise.all(batch.map(async ([path, hash]) => {
    const url = new URL(path, origin)
    url.searchParams.set('deploy', hash.slice(0, 12))
    await fetch(url, { signal: AbortSignal.timeout(15_000), cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        if (digest(new Uint8Array(await response.arrayBuffer())) !== hash) {
          throw new Error('Published bytes differ from this build')
        }
        pending.delete(path)
        failures.delete(path)
        console.log(`Verified ${path}`)
      })
      .catch((error: unknown) => {
        failures.set(path, error instanceof Error ? error.message : String(error))
      })
  }))
  if (Date.now() >= deadline && pending.size) {
    throw new Error(`Deployment verification failed: ${JSON.stringify([...failures])}`)
  }
  if (batch.some(([path]) => pending.has(path))) await setTimeout(3000)
}
console.log(`Verified ${expected.length} deployed pages and assets at ${origin.origin}`)
