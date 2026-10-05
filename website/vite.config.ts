import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: '.output/public',
  plugins: [cloudflare()],
  build: { rolldownOptions: { input: 'scripts/assets-entry.ts' } },
})
