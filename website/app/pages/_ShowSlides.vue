<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { penLines, penSketches } from '#shared/show-slides-art'
import { useShowPhotos } from '../composables/useShowPhotos'

// Five PenGPT pen-and-ink notebook slides for `/projector?show`, sitting over the preloaded 3D office.
// Advancing past Slide 5 fades the notebook out cleanly into the live 3D office.
const { slide } = defineProps<{ slide: number }>()
const { photos } = useShowPhotos()
const SlideMascot3D = defineAsyncComponent(() => import('./_SlideMascot3D.client.vue'))
const lineView = (w: number) => `-0.08 -0.34 ${(w + 0.16).toFixed(2)} 0.54`
</script>

<template>
  <section class="slides" aria-label="Science presentation">
    <div class="sheet">
      <!-- Slide 1: Company Name + Photo of Me + Photo of Dr Brundle (before) -->
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
            <div class="frame headshot-frame">
              <img v-if="photos.scientist" :src="photos.scientist" alt="Lead scientist">
              <svg v-else class="sketch headshot" :viewBox="penSketches.scientist.box" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Sketched portrait of Dr. Science">
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
            <div class="frame headshot-frame">
              <img v-if="photos.brundle" :src="photos.brundle" alt="Dr Brundle before experiment">
              <svg v-else class="sketch headshot" :viewBox="penSketches.coworker.box" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Sketched portrait of Dr Brundle before transformation">
                <path :d="penSketches.coworker.d" />
              </svg>
            </div>
            <figcaption>
              <svg class="pen-label" :viewBox="lineView(penLines.drBrundle.w)" role="img" aria-label="Dr Brundle">
                <path :d="penLines.drBrundle.d" />
              </svg>
            </figcaption>
          </figure>
        </div>
      </div>

      <!-- Slide 2: Experiment 1: Brundle + Fly = Rotating 3D Brundlefly -->
      <div v-else-if="slide === 1" class="page slide-two">
        <svg class="pen-title" :viewBox="lineView(penLines.exp1.w)" role="img" aria-label="Experiment 1: Human + Fly">
          <path :d="penLines.exp1.d" />
        </svg>

        <div class="equation">
          <figure class="eq-item">
            <div class="frame small headshot-frame">
              <img v-if="photos.brundle" :src="photos.brundle" alt="Dr Brundle before">
              <svg v-else class="sketch headshot" :viewBox="penSketches.coworker.box" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Dr Brundle">
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
            <div class="frame brundle-3d">
              <SlideMascot3D />
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
            <div class="frame brundle-3d">
              <SlideMascot3D />
            </div>
            <svg class="pen-label" :viewBox="lineView(penLines.brundlefly.w)" role="img" aria-label="Brundlefly">
              <path :d="penLines.brundlefly.d" />
            </svg>
          </figure>

          <span class="op" aria-hidden="true">=</span>

          <figure class="eq-item unstable-box">
            <svg class="sketch lightning" :viewBox="penSketches.lightning.box" aria-hidden="true">
              <path :d="penSketches.lightning.d" />
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

      <!-- Slide 4: Virtual Lab (Computer + Chamber 01) with Brundlefly, Me, and Audience underneath -->
      <div v-else-if="slide === 3" class="page slide-four">
        <svg class="pen-title" :viewBox="lineView(penLines.virtualLab.w)" role="img" aria-label="The Virtual Lab">
          <path :d="penLines.virtualLab.d" />
        </svg>

        <div class="lab-hub">
          <div class="lab-gear">
            <svg class="sketch computer" :viewBox="penSketches.computer.box" role="img" aria-label="Virtual Lab computer">
              <path :d="penSketches.computer.d" />
            </svg>
            <svg class="gear-link" viewBox="0 0 84 24" aria-hidden="true">
              <path d="M4 12 L80 12" />
            </svg>
            <div class="chamber-unit">
              <svg class="sketch chamber" :viewBox="penSketches.chamber.box" role="img" aria-label="Chamber 01 glass cylinder">
                <path :d="penSketches.chamber.d" />
              </svg>
              <svg class="pen-label ink-green chamber-name" :viewBox="lineView(penLines.chamber01.w)" role="img" aria-label="Chamber 01">
                <path :d="penLines.chamber01.d" />
              </svg>
            </div>
          </div>
          <div class="arrows" aria-hidden="true">
            <svg viewBox="0 0 680 76">
              <path d="M295 4 L95 66 M95 66 L114 52 M95 66 L118 68" />
              <path d="M340 4 L340 66 M340 66 L328 50 M340 66 L352 50" />
              <path d="M385 4 L585 66 M585 66 L566 52 M585 66 L562 68" />
            </svg>
          </div>
          <div class="under-lab">
            <figure class="eq-item">
              <div class="frame brundle-3d compact">
                <SlideMascot3D />
              </div>
              <svg class="pen-label" :viewBox="lineView(penLines.brundleRemote.w)" role="img" aria-label="Brundle remote">
                <path :d="penLines.brundleRemote.d" />
              </svg>
            </figure>

            <figure class="eq-item">
              <div class="frame compact headshot-frame">
                <img v-if="photos.scientist" :src="photos.scientist" alt="Me neural-linked">
                <svg v-else class="sketch headshot" :viewBox="penSketches.scientist.box" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Me">
                  <path :d="penSketches.scientist.d" />
                </svg>
              </div>
              <svg class="pen-label" :viewBox="lineView(penLines.meVolunteer.w)" role="img" aria-label="Me neural-linked">
                <path :d="penLines.meVolunteer.d" />
              </svg>
            </figure>

            <figure class="eq-item">
              <div class="frame compact">
                <svg class="sketch" :viewBox="penSketches.audience.box" role="img" aria-label="Audience phone sketch">
                  <path :d="penSketches.audience.d" />
                </svg>
              </div>
              <svg class="pen-label" :viewBox="lineView(penLines.audience.w)" role="img" aria-label="Audience">
                <path :d="penLines.audience.d" />
              </svg>
            </figure>
          </div>
        </div>
      </div>

      <!-- Slide 5: Experiment 2 - Me -> one of 4 Specimen Cards (Snail = Lame - don't pick!) -->
      <div v-else class="page slide-five">
        <div class="exp2-head">
          <svg class="pen-title" :viewBox="lineView(penLines.exp2.w)" role="img" aria-label="Experiment 2: Source the Transformation">
            <path :d="penLines.exp2.d" />
          </svg>
          <svg class="pen-sub" :viewBox="lineView(penLines.sourceSub.w)" role="img" aria-label="Tap specimens to fuel Chamber 01 to 100%">
            <path :d="penLines.sourceSub.d" />
          </svg>
        </div>

        <div class="transform-row">
          <figure class="eq-item subject">
            <div class="frame small headshot-frame">
              <img v-if="photos.scientist" :src="photos.scientist" alt="Dr. Science">
              <svg v-else class="sketch headshot" :viewBox="penSketches.scientist.box" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Sketched portrait of Dr. Science">
                <path :d="penSketches.scientist.d" />
              </svg>
            </div>
            <svg class="pen-label" :viewBox="lineView(penLines.meLead.w)" role="img" aria-label="Dr. Science">
              <path :d="penLines.meLead.d" />
            </svg>
          </figure>

          <svg class="transform-arrow" viewBox="0 0 110 60" aria-hidden="true">
            <path d="M6 30 L96 30 M76 12 L98 30 L76 48" />
          </svg>

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
    </div>
  </section>
</template>

<style scoped>
.slides { position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; background: #10151d; color: #f2efe6; user-select: none; }
.sheet { flex: 1; position: relative; display: flex; overflow: hidden;
  background-color: #10151d;
  background-image:
    radial-gradient(ellipse at 50% 35%, #192231 0%, #0d1118 85%),
    linear-gradient(90deg, transparent 58px, #5c282b 58px, #5c282b 60px, transparent 60px),
    repeating-linear-gradient(0deg, transparent 0, transparent 41px, #1c2636 41px, #1c2636 42px);
  background-blend-mode: normal, screen, screen;
}
.page { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: space-evenly; padding: 3vh 5vw 3vh 80px; gap: 2vh; min-width: 0; }

/* Real PenGPT handwriting + sketch SVG strokes (high-contrast chalk/ink on dark lab paper for projector legibility) */
.pen-title { height: clamp(4.2rem, 10.5vh, 7.2rem); max-width: 90vw; width: auto; overflow: visible; }
.pen-title path { fill: none; stroke: #f5f2e8; stroke-width: .03; stroke-linecap: round; stroke-linejoin: round; }
.pen-sub { height: clamp(2.8rem, 6vh, 4.4rem); max-width: 90vw; width: auto; overflow: visible; }
.pen-sub path { fill: none; stroke: #9bb8f0; stroke-width: .028; stroke-linecap: round; stroke-linejoin: round; }
.pen-label { height: clamp(2.6rem, 5.4vh, 3.9rem); max-width: 100%; width: auto; overflow: visible; }
.pen-label path { fill: none; stroke: #e6ecfa; stroke-width: .028; stroke-linecap: round; stroke-linejoin: round; }
.pen-lame { height: clamp(2.7rem, 5.5vh, 4rem); max-width: 100%; width: auto; overflow: visible; }
.pen-lame path { fill: none; stroke: #ff6b6b; stroke-width: .03; stroke-linecap: round; stroke-linejoin: round; }
.ink-red path { stroke: #ff6b6b; }
.ink-green path { stroke: #7ee787; }
.sketch { display: block; width: 100%; height: 100%; overflow: visible; }
.sketch path { fill: none; stroke: #f2efe6; stroke-width: .022; stroke-linecap: round; stroke-linejoin: round; }
.sketch.headshot { overflow: hidden; }
.sketch.headshot path { stroke-width: .015; }

.title-row { display: flex; flex-direction: column; align-items: center; gap: .6vh; }
.alien-note { display: flex; align-items: center; gap: 14px; }
.ufo { width: 84px; height: 64px; }
.ufo path { stroke: #7ee787; stroke-width: .026; }

.staff-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(24px, 5vw, 72px); width: min(920px, 86vw); }
.polaroid { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 18px 18px 22px; background: #19212e;
  border: 2px solid #41516b; box-shadow: 6px 8px 0 #00000066; }
.tilt-left { transform: rotate(-1.5deg); }
.tilt-right { transform: rotate(1.5deg); }
.polaroid figcaption { display: flex; justify-content: center; width: 100%; }

.frame { width: 100%; aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center; padding: 14px; background: #131924; border: 1.5px solid #324056; overflow: hidden; }
.frame.headshot-frame { padding: 0; align-items: flex-end; }
.frame img { width: 100%; height: 100%; object-fit: cover; }
.frame.small { width: clamp(160px, 21vw, 270px); aspect-ratio: 1; background: #18202d; border: 2px solid #41516b; box-shadow: 4px 5px 0 #00000055; }
.frame.compact { width: clamp(140px, 16vw, 210px); aspect-ratio: 1; background: #18202d; border: 2px solid #41516b; }
.frame.brundle-3d { width: clamp(250px, 29vw, 390px); aspect-ratio: 1; background: transparent; border: none; box-shadow: none; padding: 0; overflow: visible; }
.frame.brundle-3d.compact { width: clamp(175px, 19vw, 250px); }

.equation { display: flex; align-items: center; justify-content: center; gap: clamp(12px, 2.4vw, 34px); width: 100%; max-width: 1240px; }
.eq-item { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.op { font: 700 clamp(2.8rem, 5.5vw, 5rem)/1 var(--font-mono, ui-monospace, monospace); color: #9bb8f0; }
.unstable-box { padding: 16px 26px; border: 3px dashed #ff6b6b; background: #2d161b; transform: rotate(-2deg); }
.lightning { width: clamp(92px, 10vw, 136px); height: clamp(92px, 10vw, 136px); }
.lightning path { stroke: #ff6b6b; stroke-width: .028; }

.lab-hub { display: flex; flex-direction: column; align-items: center; gap: .8vh; width: 100%; max-width: 1020px; }
.lab-gear { display: flex; align-items: center; justify-content: center; gap: clamp(12px, 2vw, 28px); }
.computer { width: clamp(150px, 18vw, 230px); height: clamp(120px, 16vh, 175px); }
.gear-link { width: clamp(44px, 5vw, 76px); height: 24px; }
.gear-link path { fill: none; stroke: #7ee787; stroke-width: 4; stroke-dasharray: 8 7; stroke-linecap: round; }
.chamber-unit { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.chamber { width: clamp(100px, 12vw, 150px); height: clamp(120px, 16vh, 175px); }
.chamber path { stroke: #7ee787; stroke-width: .024; }
.chamber-name { height: clamp(2rem, 4vh, 3rem); }
.arrows { width: min(740px, 76vw); }
.arrows svg { display: block; width: 100%; height: clamp(48px, 7.5vh, 76px); }
.arrows path { fill: none; stroke: #9bb8f0; stroke-width: 4; stroke-dasharray: 9 7; stroke-linecap: round; stroke-linejoin: round; }
.under-lab { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: center; justify-items: center; gap: clamp(20px, 4vw, 64px); width: min(920px, 88vw); }

.slide-five { justify-content: space-evenly; padding-top: 2.5vh; padding-bottom: 2.5vh; }
.exp2-head { display: flex; flex-direction: column; align-items: center; gap: .6vh; text-align: center; }
.transform-row { display: flex; align-items: center; justify-content: center; gap: clamp(16px, 2.5vw, 36px); width: 100%; max-width: 1240px; }
.subject { flex: none; }
.transform-arrow { flex: none; width: clamp(64px, 7vw, 110px); height: auto; overflow: visible; }
.transform-arrow path { fill: none; stroke: #9bb8f0; stroke-width: 5; stroke-dasharray: 10 8; stroke-linecap: round; stroke-linejoin: round; }

.species { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(12px, 1.5vw, 22px); flex: 1; max-width: 780px; }
.card { display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 6px; padding: 1.5vh 1.2vw;
  border: 2.5px solid #41516b; background: #18202d; box-shadow: 4px 5px 0 #00000055; text-align: center; }
.creature { height: clamp(72px, 12vh, 118px); width: 100%; }
.tag { font: 700 clamp(.9rem, 1.35vw, 1.2rem)/1.2 var(--font-mono, ui-monospace, monospace); color: #9bb8f0; text-transform: uppercase; letter-spacing: .04em; }
.lame-card { background: #2b161b; border: 3px dashed #ff6b6b; box-shadow: 4px 5px 0 #00000055; }
</style>
