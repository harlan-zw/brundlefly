import { cp, mkdir, readdir } from 'node:fs/promises'

const source = new URL('../apps/brand-kit/.output/public/', import.meta.url)
const target = new URL('../.output/public/brand-kit/', import.meta.url)
await mkdir(target, { recursive: true })
for (const entry of await readdir(source)) {
  // Both apps use the main site's canonical public artwork and skill downloads.
  if (['brand', 'skills', 'kit', '_headers'].includes(entry)) continue
  await cp(new URL(entry, source), new URL(entry, target), { recursive: true })
}
