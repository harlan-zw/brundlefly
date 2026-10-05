<template>
  <section class="scene-loading" role="status" aria-live="polite" aria-atomic="true">
    <div class="loading-pocket">
      <div class="loading-membrane" aria-hidden="true">
        <img class="loading-face" src="/brand/github-avatar.png" alt="" width="512" height="512" fetchpriority="high">
        <img class="loading-clasp" src="/brand/kit/lair/clasp.png" alt="" width="512" height="512">
        <img class="loading-seam" src="/brand/kit/lair/tissue-seam.png" alt="" width="1536" height="1024">
      </div>
      <p class="loading-name">Brundlefly</p>
      <p class="loading-state">3D loading.</p>
      <div class="loading-strokes" aria-hidden="true"><span /><span /><span /></div>
    </div>
  </section>
</template>

<style scoped>
.scene-loading { position: fixed; inset: 0; z-index: 5; display: grid; place-items: center; overflow: hidden; background: radial-gradient(ellipse at 50% 44%, #252019 0, #14140f 25%, #080b08 65%); color: #e8d4a6; }
.scene-loading::before { content: ''; position: absolute; inset: 14px; border: 1px solid #343c3b55; border-radius: 48% 44% 46% 42%; box-shadow: inset 0 0 70px #080b08; pointer-events: none; }
.loading-pocket { position: relative; display: flex; align-items: center; flex-direction: column; width: min(320px, 72vw); }
.loading-membrane { position: relative; isolation: isolate; width: 100%; aspect-ratio: 1; display: grid; place-items: center; }
.loading-membrane::before { content: ''; position: absolute; inset: 12%; border-radius: 45% 48% 43% 47%; background: radial-gradient(ellipse, #080b08 57%, #69404b88 62%, #aa604b66 66%, #343c3b 70%, #080b08 75%); box-shadow: 0 0 42px #aa604b16, inset 0 0 28px #77764822; animation: loading-breathe 3.6s ease-in-out infinite; }
.loading-face { position: relative; width: 72%; height: auto; image-rendering: pixelated; border-radius: 45% 48% 43% 47%; mix-blend-mode: lighten; }
.loading-clasp { position: absolute; width: 75%; height: auto; right: -22%; top: -8%; rotate: 24deg; image-rendering: pixelated; }
.loading-seam { position: absolute; width: 122%; height: 24%; left: -11%; bottom: 4%; object-fit: cover; opacity: .7; image-rendering: pixelated; }
.loading-name { margin: 18px 0 0; font: 600 25px var(--font-display, sans-serif); letter-spacing: .02em; }
.loading-state { margin: 9px 0 0; color: #a4b5a0; font: 12px var(--font-mono, monospace); }
.loading-strokes { display: flex; align-items: center; gap: 6px; margin-top: 18px; height: 8px; }
.loading-strokes span { width: 14px; height: 3px; border-radius: 4px 1px 3px 1px; background: #aa604b; opacity: .3; animation: loading-stroke 1.8s ease-in-out infinite; }
.loading-strokes span:nth-child(2) { width: 26px; background: #777648; animation-delay: .2s; }
.loading-strokes span:nth-child(3) { width: 18px; animation-delay: .4s; }
@keyframes loading-breathe { 50% { transform: scale(1.045, .98); box-shadow: 0 0 54px #aa604b28, inset 0 0 36px #77764838; } }
@keyframes loading-stroke { 50% { opacity: .9; transform: scaleY(1.3); } }
@media (prefers-reduced-motion: reduce) { .loading-membrane::before, .loading-strokes span { animation: none; } .loading-strokes span { opacity: .7; } }
@media (max-height: 460px) { .loading-pocket { width: 210px; } .loading-name { margin-top: 8px; } .loading-strokes { margin-top: 10px; } }
</style>
