import { defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'brundlefly',
    compatibilityDate: '2026-10-04',
    assets: { notFoundHandling: '404-page' },
  },
})
