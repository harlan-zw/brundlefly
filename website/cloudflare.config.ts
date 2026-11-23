import { bindings, defineConfig, exports } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'brundlefly',
    entrypoint: './worker/entry.ts',
    exports: { OfficeRoom: exports.durableObject({ storage: 'sqlite' }) },
    domains: ['brundlefly.dev'],
    compatibilityDate: '2026-10-04',
    observability: { enabled: true, redactQueryString: true },
    assets: { notFoundHandling: '404-page', runWorkerFirst: ['/api/*'] },
    env: {
      ASSETS: bindings.assets(),
      OFFICE_ROOM: bindings.durableObject({ worker: 'brundlefly', exportName: 'OfficeRoom' }),
      AI: bindings.ai({ dev: { remote: true } }),
      DIALOGUE_DB: bindings.d1({ id: 'e490de7e-6e98-436d-a2e8-6818e2ee8e38' }),
    },
  },
})
