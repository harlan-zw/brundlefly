export default defineNuxtConfig({
  compatibilityDate: '2026-10-04',
  extends: ['./layers/brand'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  ignore: ['**/_*.vue'],
  colorMode: { preference: 'dark', fallback: 'dark' },
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
        { property: 'og:url', content: 'https://brundlefly.dev/' },
        { property: 'og:image', content: 'https://brundlefly.dev/brand/github-banner-overhang-gross.png' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/brand/github-avatar.png' },
        { rel: 'canonical', href: 'https://brundlefly.dev/' },
      ],
    },
  },
  // The standalone kit is generated separately and assembled after this export.
  nitro: { prerender: { crawlLinks: true, failOnError: true, ignore: ['/brand-kit/'] } },
})
