import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-04',
  extends: ['../../layers/brand'],
  devtools: { enabled: false },
  ignore: ['**/_*.vue'],
  dir: { public: fileURLToPath(new URL('../../public', import.meta.url)) },
  css: ['~/assets/css/kit.css'],
  app: { head: {
    htmlAttrs: { lang: 'en', class: 'dark' },
    title: 'Brundlefly | Brand kit',
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
    link: [{ rel: 'icon', type: 'image/png', href: '/brand/github-avatar.png' }],
  } },
  nitro: { prerender: { crawlLinks: true, failOnError: true } },
})
