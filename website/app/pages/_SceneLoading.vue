<template>
  <section class="scene-loading" role="status" aria-live="polite" aria-atomic="true">
    <div class="loading-pocket">
      <img class="loading-face" src="/brand/github-avatar.png" alt="" width="512" height="512" fetchpriority="high">
      <p class="loading-state">3D loading.</p>
    </div>
  </section>
</template>

<style scoped>
.scene-loading { position: fixed; inset: 0; z-index: 5; display: grid; place-items: center; background: #080b08; }
.loading-pocket { display: flex; align-items: center; flex-direction: column; gap: 20px; }
.loading-face { width: min(144px, 38vw, 38dvh); height: auto; image-rendering: pixelated; mix-blend-mode: lighten; }
.loading-state { margin: 0; color: #a4b5a0; font: 12px var(--font-mono, monospace); }
</style>
