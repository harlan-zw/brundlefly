<script setup lang="ts">
import { joinAddress, joinCode, quietZone } from '#shared/join-code'

// Four deliberately crude MS Paint slides for `/projector?show`. They sit above the preloaded 3D office so advancing past slide 4 hard-cuts with zero load lag.
const { slide } = defineProps<{ slide: number }>()
const qr = joinCode()
const qrView = `${-quietZone} ${-quietZone} ${qr.size + quietZone * 2} ${qr.size + quietZone * 2}`
</script>

<template>
  <section class="slides" aria-label="Science presentation">
    <div class="paint-bar" aria-hidden="true">
      <span>science_final_FINAL_v2.bmp - Paint</span>
      <span>Slide {{ slide + 1 }} / 4</span>
    </div>

    <div v-if="slide === 0" class="canvas slide-one">
      <h1>FRONTIERS OF HUMAN SCIENCE</h1>
      <svg class="art" viewBox="0 0 800 380" role="img" aria-label="Crude stick figure scientist pointing at alien Jayde age 30">
        <!-- Stick figure scientist in boxy lab coat -->
        <circle cx="205" cy="92" r="34" fill="#fff" stroke="#000" stroke-width="6" />
        <circle cx="194" cy="85" r="4" fill="#000" />
        <circle cx="218" cy="86" r="4" fill="#000" />
        <path d="M192 108 L220 106" stroke="#000" stroke-width="5" stroke-linecap="round" />
        <path d="M160 128 L250 132 L262 285 L148 282 Z" fill="#fff" stroke="#000" stroke-width="6" stroke-linejoin="round" />
        <rect x="172" y="162" width="66" height="32" fill="#ff0" stroke="#000" stroke-width="4" />
        <text x="205" y="184" text-anchor="middle" font-size="14" font-weight="700" fill="#000">SCIENCE</text>
        <!-- Pointing arm -->
        <path d="M250 165 L395 152" stroke="#000" stroke-width="7" stroke-linecap="round" />
        <path d="M380 138 L405 152 L382 167" fill="none" stroke="#f00" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M160 165 L122 225" stroke="#000" stroke-width="7" stroke-linecap="round" />
        <path d="M180 285 L172 355 M228 285 L238 355" stroke="#000" stroke-width="7" stroke-linecap="round" />
        <text x="205" y="375" text-anchor="middle" font-size="22" font-weight="700" fill="#00f">ME (SERIOUS)</text>

        <!-- Alien Jayde -->
        <path d="M565 68 L545 28 M615 68 L636 26" stroke="#0a0" stroke-width="6" stroke-linecap="round" />
        <circle cx="543" cy="24" r="9" fill="#0f0" stroke="#000" stroke-width="4" />
        <circle cx="638" cy="24" r="9" fill="#0f0" stroke="#000" stroke-width="4" />
        <ellipse cx="590" cy="108" rx="52" ry="44" fill="#0f0" stroke="#000" stroke-width="6" />
        <circle cx="566" cy="100" r="10" fill="#000" />
        <circle cx="590" cy="86" r="9" fill="#000" />
        <circle cx="614" cy="100" r="10" fill="#000" />
        <path d="M568 128 Q590 142 612 126" fill="none" stroke="#000" stroke-width="5" />
        <path d="M590 152 L590 278 M590 190 L525 162 M590 190 L656 158 M590 278 L552 350 M590 278 L628 350" stroke="#0a0" stroke-width="7" stroke-linecap="round" />
        <text x="590" y="375" text-anchor="middle" font-size="26" font-weight="700" fill="#080">ALIEN JAYDE (30)</text>
      </svg>
      <p class="sub">CREDENTIAL: <span>SCIENCE</span></p>
    </div>

    <div v-else-if="slide === 1" class="canvas slide-two">
      <h1>EXPERIMENT 1: HUMAN + FLY</h1>
      <svg class="art" viewBox="0 0 860 360" role="img" aria-label="Brundle plus fly equals Brundle in a jar with minor hiccup stamp">
        <!-- Brundle stick figure -->
        <circle cx="115" cy="108" r="30" fill="#fff" stroke="#000" stroke-width="6" />
        <circle cx="105" cy="102" r="4" fill="#000" />
        <circle cx="125" cy="102" r="4" fill="#000" />
        <path d="M104 120 Q115 129 127 119" fill="none" stroke="#000" stroke-width="4" />
        <path d="M115 138 L115 248 M115 170 L68 205 M115 170 L160 202 M115 248 L82 315 M115 248 L148 315" stroke="#000" stroke-width="7" stroke-linecap="round" />
        <text x="115" y="348" text-anchor="middle" font-size="24" font-weight="700" fill="#000">BRUNDLE</text>

        <!-- Plus -->
        <path d="M225 185 L275 185 M250 160 L250 210" stroke="#00f" stroke-width="10" stroke-linecap="round" />

        <!-- Awful fly -->
        <ellipse cx="385" cy="154" rx="28" ry="15" transform="rotate(-24 385 154)" fill="#dff" stroke="#000" stroke-width="4" />
        <ellipse cx="425" cy="152" rx="28" ry="15" transform="rotate(24 425 152)" fill="#dff" stroke="#000" stroke-width="4" />
        <ellipse cx="405" cy="196" rx="44" ry="26" fill="#222" stroke="#000" stroke-width="6" />
        <circle cx="368" cy="190" r="10" fill="#f00" stroke="#000" stroke-width="3" />
        <path d="M384 220 L372 252 M405 222 L405 256 M426 220 L440 252" stroke="#000" stroke-width="5" stroke-linecap="round" />
        <text x="405" y="295" text-anchor="middle" font-size="24" font-weight="700" fill="#000">APEX FLY</text>

        <!-- Equals -->
        <path d="M510 174 L564 174 M510 198 L564 198" stroke="#00f" stroke-width="10" stroke-linecap="round" />

        <!-- Jar -->
        <rect x="646" y="74" width="118" height="24" rx="4" fill="#999" stroke="#000" stroke-width="5" />
        <rect x="632" y="98" width="146" height="206" rx="18" fill="#c8ff9c" stroke="#000" stroke-width="6" />
        <circle cx="705" cy="184" r="18" fill="#5b4032" stroke="#000" stroke-width="4" />
        <path d="M705 202 L705 246 M705 212 L676 196 M705 212 L734 198 M705 226 L680 236 M705 226 L730 236" stroke="#5b4032" stroke-width="6" stroke-linecap="round" />
        <rect x="648" y="256" width="114" height="32" fill="#ffe" stroke="#000" stroke-width="3" />
        <text x="705" y="278" text-anchor="middle" font-size="16" font-weight="700" fill="#000">STASIS</text>
        <text x="705" y="344" text-anchor="middle" font-size="22" font-weight="700" fill="#000">JAR (SAFE)</text>
      </svg>
      <p class="stamp">MINOR HICCUP</p>
    </div>

    <div v-else-if="slide === 2" class="canvas slide-three">
      <h1>EXPERIMENT 2: THE 18TH DIMENSION</h1>
      <svg class="art" viewBox="0 0 880 350" role="img" aria-label="Jar connected to virtual lab Chamber 01 neural linked to scientist volunteer">
        <!-- Jar -->
        <rect x="52" y="102" width="112" height="150" rx="14" fill="#c8ff9c" stroke="#000" stroke-width="6" />
        <rect x="66" y="84" width="84" height="20" fill="#999" stroke="#000" stroke-width="5" />
        <text x="108" y="185" text-anchor="middle" font-size="22" font-weight="700" fill="#000">JAR</text>

        <!-- Arrow 1 -->
        <path d="M174 176 L282 176" stroke="#f00" stroke-width="8" stroke-dasharray="14 10" />
        <path d="M268 156 L296 176 L268 196" fill="none" stroke="#f00" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />

        <!-- Virtual Lab box -->
        <rect x="308" y="88" width="234" height="178" fill="#ddd" stroke="#000" stroke-width="6" />
        <text x="425" y="142" text-anchor="middle" font-size="26" font-weight="700" fill="#000">VIRTUAL LAB</text>
        <rect x="342" y="168" width="166" height="72" fill="#0f0" stroke="#000" stroke-width="5" />
        <text x="425" y="212" text-anchor="middle" font-size="24" font-weight="700" fill="#000">CHAMBER 01</text>

        <!-- Arrow 2 -->
        <path d="M552 176 L678 176" stroke="#00f" stroke-width="8" stroke-dasharray="14 10" />
        <path d="M664 156 L692 176 L664 196" fill="none" stroke="#00f" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
        <text x="620" y="146" text-anchor="middle" font-size="19" font-weight="700" fill="#00f">NEURAL LINK</text>

        <!-- Volunteer stick figure -->
        <circle cx="764" cy="108" r="30" fill="#fff" stroke="#000" stroke-width="6" />
        <circle cx="754" cy="102" r="4" fill="#000" />
        <circle cx="774" cy="102" r="4" fill="#000" />
        <path d="M752 120 L776 120" stroke="#000" stroke-width="5" />
        <path d="M764 138 L764 248 M764 170 L714 148 M764 170 L814 148 M764 248 L730 315 M764 248 L798 315" stroke="#000" stroke-width="7" stroke-linecap="round" />
        <text x="764" y="342" text-anchor="middle" font-size="22" font-weight="700" fill="#f00">ME (LIVE)</text>
      </svg>
      <p class="safe-badge">100% SAFE NEURAL LINK</p>
    </div>

    <div v-else class="canvas slide-four">
      <div class="join-top">
        <div class="qr-box">
          <svg :viewBox="qrView" shape-rendering="crispEdges" role="img" :aria-label="`QR code for ${joinAddress}`">
            <rect :x="-quietZone" :y="-quietZone" :width="qr.size + quietZone * 2" :height="qr.size + quietZone * 2" fill="#fff" />
            <rect v-for="cell in qr.cells" :key="`${cell.x}-${cell.y}`" :x="cell.x" :y="cell.y" width="1" height="1" fill="#000" />
          </svg>
        </div>
        <div class="join-copy">
          <h1>SELECT MY EVOLUTION</h1>
          <p class="join-url">{{ joinAddress }}</p>
          <p class="join-hint">SCAN NOW OR WAIT FOR THE BEETLES</p>
        </div>
      </div>

      <div class="species">
        <div class="card">
          <span class="emoji" aria-hidden="true">🪰</span>
          <strong>FLY</strong>
          <span>APEX AERIAL</span>
        </div>
        <div class="card">
          <span class="emoji" aria-hidden="true">🪲</span>
          <strong>BEETLE</strong>
          <span>ARMORED</span>
        </div>
        <div class="card">
          <span class="emoji" aria-hidden="true">🦗</span>
          <strong>CRICKET</strong>
          <span>30x LEAP</span>
        </div>
        <div class="card control-group">
          <span class="emoji" aria-hidden="true">🐌</span>
          <strong>SNAIL</strong>
          <span>CONTROL GROUP: DO NOT PICK</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.slides { position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; background: #fff; color: #000;
  font-family: 'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive, sans-serif; user-select: none; }
.paint-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: #000080; color: #fff;
  font: 700 15px/1.2 var(--font-mono, ui-monospace, monospace); border-bottom: 3px solid #c0c0c0; }
.canvas { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: space-evenly; padding: 2.5vh 4vw; gap: 2vh; overflow: hidden; }
h1 { margin: 0; font-size: clamp(2rem, 5.2vw, 4.6rem); line-height: 1.05; text-align: center; letter-spacing: .02em; color: #000; }
.art { width: min(92vw, 1080px); max-height: 58vh; }
.sub { margin: 0; font-size: clamp(1.5rem, 3.2vw, 2.8rem); font-weight: 700; }
.sub span { padding: 4px 16px; background: #ff0; border: 4px solid #000; }
.stamp { margin: 0; padding: 8px 24px; color: #e00; border: 6px solid #e00; font-size: clamp(1.6rem, 3.4vw, 3rem); font-weight: 700; transform: rotate(-4deg); }
.safe-badge { margin: 0; padding: 8px 24px; background: #0f0; color: #000; border: 5px solid #000; font-size: clamp(1.5rem, 3vw, 2.6rem); font-weight: 700; }

.slide-four { justify-content: space-between; padding: 2.5vh 4vw 3.5vh; }
.join-top { display: flex; align-items: center; justify-content: center; gap: 4vw; width: 100%; max-width: 1200px; }
.qr-box { flex: none; width: min(34vh, 30vw, 320px); aspect-ratio: 1; border: 6px solid #000; background: #fff; }
.qr-box svg { display: block; width: 100%; height: 100%; }
.join-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 1.2vh; }
.join-copy h1 { text-align: left; font-size: clamp(1.9rem, 4.2vw, 3.8rem); }
.join-url { margin: 0; padding: 8px 18px; background: #ff0; border: 5px solid #000; font: 800 clamp(1.4rem, 3.2vw, 2.8rem)/1.1 var(--font-mono, ui-monospace, monospace); }
.join-hint { margin: 0; font-size: clamp(1rem, 1.8vw, 1.5rem); font-weight: 700; color: #00f; }

.species { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.6vw; width: 100%; max-width: 1200px; }
.card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .8vh; padding: 2vh 1.2vw; border: 5px solid #000; background: #f5f5f5; text-align: center; }
.card .emoji { font-size: clamp(2.4rem, 5vw, 4.5rem); line-height: 1; }
.card strong { font-size: clamp(1.3rem, 2.4vw, 2.2rem); }
.card span:last-child { font-size: clamp(.95rem, 1.5vw, 1.35rem); font-weight: 700; color: #00a; }
.card.control-group { background: #ffe4e4; border-color: #e00; border-style: dashed; }
.card.control-group span:last-child { color: #d00; }
</style>
