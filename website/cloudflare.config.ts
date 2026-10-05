import { defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'brundlefly',
    domains: ['brundlefly.dev'],
    compatibilityDate: '2026-10-04',
    observability: { enabled: true, redactQueryString: true },
    assets: { notFoundHandling: '404-page' },
  },
})
