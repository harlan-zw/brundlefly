import { fileURLToPath } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

// This local tool uses the production AI binding. It has no production route or database.
export default defineConfig(({ command }) => {
  if (command !== 'serve') throw new Error('The dialogue generator supports local development only.')
  return {
    publicDir: false,
    server: { host: '127.0.0.1', port: 8790, strictPort: true },
    plugins: [cloudflare({
      config: config => ({
        name: `${config.name}-dialogue-generator`,
        entrypoint: fileURLToPath(new URL('./dialogue-generator-worker.ts', import.meta.url)),
        assets: undefined, domains: [], env: { AI: config.env!.AI! },
      }),
      persistState: false, inspectorPort: false, types: { generate: false },
    })],
  }
})
