export default defineNuxtConfig({
  compatibilityDate: '2026-10-04',
  modules: ['@nuxt/ui', '@nuxt/fonts'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  ignore: ['**/_*.vue'],
  colorMode: { preference: 'dark', fallback: 'dark' },
  fonts: {
    families: [
      { name: 'Barlow Condensed', provider: 'google', weights: [600, 700, 800] },
      { name: 'IBM Plex Mono', provider: 'google', weights: [400, 500] },
      { name: 'IBM Plex Sans', provider: 'google', weights: [400, 500, 600] },
    ],
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en', class: 'dark' },
      title: 'Brundlefly | Self-contained Agent Skills',
      meta: [
        { name: 'description', content: 'A collection of self-contained Agent Skills. Try write-human, technical-guide, and pr.' },
        { name: 'theme-color', content: '#080B08' },
        { property: 'og:title', content: 'Brundlefly | Self-contained Agent Skills' },
        { property: 'og:description', content: 'A collection of self-contained Agent Skills.' },
        { property: 'og:type', content: 'website' },
      ],
      link: [{ rel: 'icon', type: 'image/png', href: '/brand/github-avatar.png' }],
    },
  },
  nitro: { prerender: { crawlLinks: true, failOnError: true } },
})
