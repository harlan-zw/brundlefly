import { readFile } from 'node:fs/promises'
import { Miniflare } from 'miniflare'

// Use the same local resource store as Cloudflare's Vite plugin.
const runtime = new Miniflare({
  resourcePersistencePath: '.cloudflare/state/v3',
  workers: [{ config: {
    name: 'brundlefly', compatibilityDate: '2026-10-04',
    manifest: { mainModule: 'init.mjs', modules: { 'init.mjs': { type: 'esm', contents: 'export default { fetch() { return new Response("Local schema initialization") } }' } } },
    env: { DIALOGUE_DB: { type: 'd1', id: 'e490de7e-6e98-436d-a2e8-6818e2ee8e38' } },
  } }],
})
const schema = await readFile(new URL('../worker/schema.sql', import.meta.url), 'utf8')
await runtime.getD1Database('DIALOGUE_DB').then(database => database.batch(schema.split(';').filter(statement => statement.trim()).map(statement => database.prepare(statement)))).finally(() => runtime.dispose())
console.log('Local dialogue database ready.')
