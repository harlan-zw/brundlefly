<script setup lang="ts">
import { joinAddress, joinCode, quietZone } from '#shared/join-code'
import { penLines, penSketches } from '#shared/show-slides-art'
import { useShowPhotos } from '../composables/useShowPhotos'

// Five PenGPT pen-and-ink notebook slides for `/projector?show`, sitting over the preloaded 3D office.
// Advancing past Slide 5 fades the notebook out cleanly into the live 3D office.
const { slide } = defineProps<{ slide: number }>()
const { photos } = useShowPhotos()
const qr = joinCode()
const qrView = `${-quietZone} ${-quietZone} ${qr.size + quietZone * 2} ${qr.size + quietZone * 2}`
const lineView = (w: number) => `-0.08 -0.34 ${(w + 0.16).toFixed(2)} 0.54`
</script>

<template>
  <section class="slides" aria-label="Science presentation">
    <div class="notebook-bar" aria-hidden="true">
      <span>LAB NOTEBOOK // FRONTIERS OF HUMAN SCIENCE</span>
      <span>Slide {{ slide + 1 }} / 5</span>
    </div>

    <div class="sheet">
      <!-- Slide 1: Company Name + Photo of Me + Photo of Coworker Brundle (before) -->
      <div v-if="slide === 0" class="page slide-one">
        <div class="title-row">
          <svg class="pen-title" :viewBox="lineView(penLines.company.w)" role="img" aria-label="Frontiers of Human Science">
            <path :d="penLines.company.d" />
          </svg>
          <div class="alien-note">
            <svg class="sketch ufo" :viewBox="penSketches.ufo.box" aria-hidden="true"><path :d="penSketches.ufo.d" /></svg>
            <svg class="pen-label ink-green" :viewBox="lineView(penLines.forJayde.w)" role="img" aria-label="For Alien Jayde">
              <path :d="penLines.forJayde.d" />
            </svg>
          </div>
        </div>

        <div class="staff-grid">
          <figure class="polaroid tilt-left">
            <div class="frame">
              <img v-if="photos.scientist" :src="photos.scientist" alt="Lead scientist">
              <svg v-else class="sketch" :viewBox="penSketches.scientist.box" role="img" aria-label="Sketched portrait of Dr. Science">
                <path :d="penSketches.scientist.d" />
              </svg>
            </div>
            <figcaption>
              <svg class="pen-label" :viewBox="lineView(penLines.meLead.w)" role="img" aria-label="Dr. Science">
                <path :d="penLines.meLead.d" />
              </svg>
            </figcaption>
          </figure>

          <figure class="polaroid tilt-right">
            <div class="frame">
              <img v-if="photos.brundle" :src="photos.brundle" alt="Coworker Brundle before experiment">
              <svg v-else class="sketch" :viewBox="penSketches.coworker.box" role="img" aria-label="Sketched portrait of coworker Brundle before transformation">
                <path :d="penSketches.coworker.d" />
              </svg>
            </div>
            <figcaption>
              <svg class="pen-label" :viewBox="lineView(penLines.brundleBefore.w)" role="img" aria-label="Brundle before">
                <path :d="penLines.brundleBefore.d" />
              </svg>
            </figcaption>
          </figure>
        </div>
      </div>

      <!-- Slide 2: Experiment 1: Brundle + Fly = REAL BRUNDLEFLY -->
      <div v-else-if="slide === 1" class="page slide-two">
        <svg class="pen-title" :viewBox="lineView(penLines.exp1.w)" role="img" aria-label="Experiment 1: Human + Fly">
          <path :d="penLines.exp1.d" />
        </svg>

        <div class="equation">
          <figure class="eq-item">
            <div class="frame small">
              <img v-if="photos.brundle" :src="photos.brundle" alt="Brundle before">
              <svg v-else class="sketch" :viewBox="penSketches.coworker.box" role="img" aria-label="Brundle">
                <path :d="penSketches.coworker.d" />
              </svg>
            </div>
            <svg class="pen-label" :viewBox="lineView(penLines.brundle.w)" role="img" aria-label="Brundle">
              <path :d="penLines.brundle.d" />
            </svg>
          </figure>

          <span class="op" aria-hidden="true">+</span>

          <figure class="eq-item">
            <div class="frame small">
              <svg class="sketch" :viewBox="penSketches.fly.box" role="img" aria-label="Fly sketch">
                <path :d="penSketches.fly.d" />
              </svg>
            </div>
            <svg class="pen-label" :viewBox="lineView(penLines.apexFly.w)" role="img" aria-label="Apex Fly">
              <path :d="penLines.apexFly.d" />
            </svg>
          </figure>

          <span class="op" aria-hidden="true">=</span>

          <figure class="eq-item result">
            <div class="frame brundle-frame">
              <img src="/brand/character.png" alt="Brundlefly">
            </div>
            <svg class="pen-label ink-red" :viewBox="lineView(penLines.brundlefly.w)" role="img" aria-label="Brundlefly">
              <path :d="penLines.brundlefly.d" />
            </svg>
          </figure>
        </div>
      </div>

      <!-- Slide 3: Brundlefly = Unstable = In a jar now -->
      <div v-else-if="slide === 2" class="page slide-three">
        <svg class="pen-title ink-red" :viewBox="lineView(penLines.hiccup.w)" role="img" aria-label="Minor Hiccup">
          <path :d="penLines.hiccup.d" />
        </svg>

        <div class="equation">
          <figure class="eq-item">
            <div class="frame brundle-frame">
              <img src="/brand/character.png" alt="Brundlefly">
            </div>
            <svg class="pen-label" :viewBox="lineView(penLines.brundlefly.w)" role="img" aria-label="Brundlefly">
              <path :d="penLines.brundlefly.d" />
            </svg>
          </figure>

          <span class="op" aria-hidden="true">=</span>

          <figure class="eq-item unstable-box">
            <svg class="bolt" viewBox="0 0 120 140" aria-hidden="true">
              <path d="M72 8 L26 76 L60 76 L42 132 L98 60 L64 60 Z" />
            </svg>
            <svg class="pen-label ink-red" :viewBox="lineView(penLines.unstable.w)" role="img" aria-label="Unstable">
              <path :d="penLines.unstable.d" />
            </svg>
          </figure>

          <span class="op" aria-hidden="true">=</span>

          <figure class="eq-item">
            <div class="frame small">
              <svg class="sketch" :viewBox="penSketches.jar.box" role="img" aria-label="Glass stasis jar sketch">
                <path :d="penSketches.jar.d" />
              </svg>
            </div>
            <svg class="pen-label ink-red" :viewBox="lineView(penLines.inAJar.w)" role="img" aria-label="In a jar now">
              <path :d="penLines.inAJar.d" />
            </svg>
          </figure>
        </div>
      </div>

      <!-- Slide 4: Virtual Lab with Brundlefly and Me underneath -->
      <div v-else-if="slide === 3" class="page slide-four">
        <svg class="pen-title" :viewBox="lineView(penLines.virtualLab.w)" role="img" aria-label="The Virtual Lab">
          <path :d="penLines.virtualLab.d" />
        </svg>

        <div class="lab-hub">
          <svg class="sketch computer" :viewBox="penSketches.computer.box" role="img" aria-label="Virtual Lab computer">
            <path :d="penSketches.computer.d" />
          </svg>
          <div class="arrows" aria-hidden="true">
            <svg viewBox="0 0 420 70">
              <path d="M190 4 L75 62 M75 62 L92 48 M75 62 L96 63" />
              <path d="M230 4 L345 62 M345 62 L328 48 M345 62 L324 63" />
            </svg>
          </div>
          <div class="under-lab">
            <figure class="eq-item">
              <div class="frame brundle-frame compact">
                <img src="/brand/character.png" alt="Brundlefly">
              </div>
              <svg class="pen-label" :viewBox="lineView(penLines.brundleRemote.w)" role="img" aria-label="Brundle remote">
                <path :d="penLines.brundleRemote.d" />
              </svg>
            </figure>

            <figure class="eq-item">
              <div class="frame compact">
                <img v-if="photos.scientist" :src="photos.scientist" alt="Me neural-linked">
                <svg v-else class="sketch" :viewBox="penSketches.scientist.box" role="img" aria-label="Me">
                  <path :d="penSketches.scientist.d" />
                </svg>
              </div>
              <svg class="pen-label" :viewBox="lineView(penLines.meVolunteer.w)" role="img" aria-label="Me neural-linked">
                <path :d="penLines.meVolunteer.d" />
              </svg>
            </figure>
          </div>
        </div>
      </div>

      <!-- Slide 5: Experiment 2 - Source the Transformation + Top QR + Snail = Lame - don't pick! -->
      <div v-else class="page slide-five">
        <div class="join-top">
          <div class="qr-box">
            <svg :viewBox="qrView" shape-rendering="crispEdges" role="img" :aria-label="`QR code for ${joinAddress}`">
              <rect :x="-quietZone" :y="-quietZone" :width="qr.size + quietZone * 2" :height="qr.size + quietZone * 2" fill="#fff" />
              <rect v-for="cell in qr.cells" :key="`${cell.x}-${cell.y}`" :x="cell.x" :y="cell.y" width="1" height="1" fill="#000" />
            </svg>
          </div>
          <div class="join-copy">
            <svg class="pen-title left" :viewBox="lineView(penLines.exp2.w)" role="img" aria-label="Experiment 2: Source the Transformation">
              <path :d="penLines.exp2.d" />
            </svg>
            <svg class="pen-sub" :viewBox="lineView(penLines.sourceSub.w)" role="img" aria-label="Tap specimens to fuel Chamber 01 to 100%">
              <path :d="penLines.sourceSub.d" />
            </svg>
            <p class="join-url">{{ joinAddress }}</p>
          </div>
        </div>

        <div class="species">
          <div class="card">
            <svg class="sketch creature" :viewBox="penSketches.fly.box" aria-hidden="true"><path :d="penSketches.fly.d" /></svg>
            <svg class="pen-label" :viewBox="lineView(penLines.fly.w)" role="img" aria-label="Fly"><path :d="penLines.fly.d" /></svg>
            <span class="tag">Aerial dominance</span>
          </div>
          <div class="card">
            <svg class="sketch creature" :viewBox="penSketches.beetle.box" aria-hidden="true"><path :d="penSketches.beetle.d" /></svg>
            <svg class="pen-label" :viewBox="lineView(penLines.beetle.w)" role="img" aria-label="Beetle"><path :d="penLines.beetle.d" /></svg>
            <span class="tag">Armored shell</span>
          </div>
          <div class="card">
            <svg class="sketch creature" :viewBox="penSketches.cricket.box" aria-hidden="true"><path :d="penSketches.cricket.d" /></svg>
            <svg class="pen-label" :viewBox="lineView(penLines.cricket.w)" role="img" aria-label="Cricket"><path :d="penLines.cricket.d" /></svg>
            <span class="tag">30x leap</span>
          </div>
          <div class="card lame-card">
            <svg class="sketch creature" :viewBox="penSketches.snail.box" aria-hidden="true"><path :d="penSketches.snail.d" /></svg>
            <svg class="pen-label" :viewBox="lineView(penLines.snail.w)" role="img" aria-label="Snail"><path :d="penLines.snail.d" /></svg>
            <svg class="pen-lame ink-red" :viewBox="lineView(penLines.lame.w)" role="img" aria-label="Lame - don't pick!"><path :d="penLines.lame.d" /></svg>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.slides { position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; background: #fcfaf3; color: #1a237e; user-select: none; }
.notebook-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 18px; background: #1a237e; color: #fcfaf3;
  font: 600 13px/1.2 var(--font-mono, ui-monospace, monospace); letter-spacing: .06em; }
.sheet { flex: 1; position: relative; display: flex; overflow: hidden;
  background-color: #fcfaf3;
  background-image:
    linear-gradient(90deg, transparent 58px, #ebb8b8 58px, #ebb8b8 60px, transparent 60px),
    repeating-linear-gradient(0deg, transparent 0, transparent 41px, #dce6f2 41px, #dce6f2 42px);
}
.page { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: space-evenly; padding: 2.5vh 5vw 3vh 80px; gap: 2vh; min-width: 0; }

/* Real PenGPT handwriting + sketch SVG strokes (sized large for back-row projector legibility) */
.pen-title { height: clamp(4.2rem, 10.5vh, 7.2rem); max-width: 90vw; width: auto; overflow: visible; }
.pen-title path { fill: none; stroke: #1a237e; stroke-width: .03; stroke-linecap: round; stroke-linejoin: round; }
.pen-title.left { align-self: flex-start; height: clamp(3.2rem, 7.6vh, 5.4rem); }
.pen-sub { height: clamp(2.5rem, 5.2vh, 3.8rem); max-width: 100%; width: auto; align-self: flex-start; overflow: visible; }
.pen-sub path { fill: none; stroke: #3949ab; stroke-width: .028; stroke-linecap: round; stroke-linejoin: round; }
.pen-label { height: clamp(2.6rem, 5.4vh, 3.9rem); max-width: 100%; width: auto; overflow: visible; }
.pen-label path { fill: none; stroke: #1a237e; stroke-width: .028; stroke-linecap: round; stroke-linejoin: round; }
.pen-lame { height: clamp(2.7rem, 5.5vh, 4rem); max-width: 100%; width: auto; overflow: visible; }
.pen-lame path { fill: none; stroke: #c62828; stroke-width: .03; stroke-linecap: round; stroke-linejoin: round; }
.ink-red path { stroke: #c62828; }
.ink-green path { stroke: #1b5e20; }
.sketch { display: block; width: 100%; height: 100%; overflow: visible; }
.sketch path { fill: none; stroke: #141414; stroke-width: .022; stroke-linecap: round; stroke-linejoin: round; }

.title-row { display: flex; flex-direction: column; align-items: center; gap: .6vh; }
.alien-note { display: flex; align-items: center; gap: 14px; }
.ufo { width: 84px; height: 64px; }
.ufo path { stroke: #1b5e20; stroke-width: .026; }

.staff-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(24px, 5vw, 72px); width: min(920px, 86vw); }
.polaroid { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 18px 18px 22px; background: #fff;
  border: 2px solid #2b2b2b; box-shadow: 6px 8px 0 #1a237e22; }
.tilt-left { transform: rotate(-1.5deg); }
.tilt-right { transform: rotate(1.5deg); }
.polaroid figcaption { display: flex; justify-content: center; width: 100%; }

.frame { width: 100%; aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center; padding: 14px; background: #faf8f0; border: 1.5px solid #c9c3b4; overflow: hidden; }
.frame img { width: 100%; height: 100%; object-fit: cover; }
.frame.small { width: clamp(160px, 21vw, 270px); aspect-ratio: 1; background: #fff; border: 2px solid #2b2b2b; box-shadow: 4px 5px 0 #1a237e18; }
.frame.brundle-frame { width: clamp(190px, 24vw, 310px); aspect-ratio: 1; background: radial-gradient(circle at 50% 45%, #233329, #0c120e); border: 3px solid #141414; box-shadow: 5px 6px 0 #c6282833; padding: 8px; }
.frame.brundle-frame img { object-fit: contain; }
.frame.compact { width: clamp(150px, 18vw, 230px); aspect-ratio: 1; background: #fff; border: 2px solid #2b2b2b; }
.frame.brundle-frame.compact { width: clamp(150px, 18vw, 230px); }

.equation { display: flex; align-items: center; justify-content: center; gap: clamp(12px, 2.4vw, 34px); width: 100%; max-width: 1240px; }
.eq-item { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.op { font: 700 clamp(2.8rem, 5.5vw, 5rem)/1 var(--font-mono, ui-monospace, monospace); color: #1a237e; }
.unstable-box { padding: 16px 22px; border: 3px dashed #c62828; background: #fff2f2; transform: rotate(-2deg); }
.bolt { width: clamp(72px, 8vw, 110px); height: auto; }
.bolt path { fill: #ffe082; stroke: #c62828; stroke-width: 5; stroke-linejoin: round; }

.lab-hub { display: flex; flex-direction: column; align-items: center; gap: 1vh; width: 100%; max-width: 820px; }
.computer { width: clamp(170px, 22vw, 280px); height: clamp(135px, 19vh, 210px); }
.arrows svg { width: clamp(260px, 34vw, 440px); height: clamp(46px, 7vh, 72px); }
.arrows path { fill: none; stroke: #1a237e; stroke-width: 4; stroke-dasharray: 9 7; stroke-linecap: round; stroke-linejoin: round; }
.under-lab { display: flex; align-items: flex-start; justify-content: center; gap: clamp(36px, 8vw, 120px); }

.slide-five { justify-content: space-between; padding-top: 2vh; padding-bottom: 3vh; }
.join-top { display: flex; align-items: center; justify-content: center; gap: 3.5vw; width: 100%; max-width: 1220px; }
.qr-box { flex: none; width: min(33vh, 28vw, 310px); aspect-ratio: 1; border: 5px solid #141414; background: #fff; box-shadow: 6px 6px 0 #1a237e26; }
.qr-box svg { display: block; width: 100%; height: 100%; }
.join-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 1.2vh; min-width: 0; }
.join-url { margin: 4px 0 0; padding: 8px 18px; background: #fff59d; color: #111; border: 3px solid #141414;
  font: 800 clamp(1.35rem, 2.8vw, 2.4rem)/1.1 var(--font-mono, ui-monospace, monospace); }

.species { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.5vw; width: 100%; max-width: 1220px; }
.card { display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 8px; padding: 1.8vh 1.2vw;
  border: 2.5px solid #2b2b2b; background: #fff; box-shadow: 4px 5px 0 #1a237e14; text-align: center; }
.creature { height: clamp(82px, 14vh, 136px); width: 100%; }
.tag { font: 700 clamp(.9rem, 1.35vw, 1.2rem)/1.2 var(--font-mono, ui-monospace, monospace); color: #3949ab; text-transform: uppercase; letter-spacing: .04em; }
.lame-card { background: #fff0f0; border: 3px dashed #c62828; box-shadow: 4px 5px 0 #c6282822; }
</style>
