import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  $meta: { name: 'brundlefly-brand' },
  modules: ['@nuxt/ui', '@nuxt/fonts'],
  css: [fileURLToPath(new URL('./app/assets/css/brand.css', import.meta.url))],
  alias: { '@brundlefly/brand': fileURLToPath(new URL('.', import.meta.url)) },
  colorMode: { preference: 'dark', fallback: 'dark' },
  nitro: { publicAssets: [{ dir: fileURLToPath(new URL('./public', import.meta.url)), baseURL: '/' }] },
  fonts: { families: [
    { name: 'Barlow Condensed', provider: 'google', weights: [600, 700, 800] },
    { name: 'IBM Plex Mono', provider: 'google', weights: [400, 500] },
    { name: 'IBM Plex Sans', provider: 'google', weights: [400, 500, 600] },
  ] },
})
