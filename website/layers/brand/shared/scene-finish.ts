import { DepthTexture, HalfFloatType, UnsignedIntType, Vector2, WebGLRenderTarget } from 'three'
import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { SceneQuality } from './scene-quality.ts'

/** What the finishing pass needs for one frame. */
export type FinishFrame = {
  /** Seconds of scene time. The grain follows it, so reduced motion holds the grain still. */
  time: number
  /** How far the conversation shot is in, from 0 to 1. The blur behind him rises with it. */
  focus: number
  /** Distance from the camera to his face, in world units. */
  focusDistance: number
}

export type SceneFinish = {
  render: (frame: FinishFrame) => void
  setSize: (width: number, height: number) => void
  dispose: () => void
}

const screenVertex = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'

// Blur behind the focus distance only. Each pixel gathers a disc of neighbours as wide as its own blur.
// A neighbour that is nearer and sharp is left out, so his outline does not smear into the lair behind him.
const blurFragment = `
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uAmount;
varying vec2 vUv;
const float sharpRange = 0.5;   // world units behind his face that stay sharp
const float fullRange = 2.4;    // world units behind his face at which the blur is full
const float maxRadius = 0.013;  // of the picture's height, at full blur
const int taps = 28;
float distanceAt(vec2 uv) {
  float depth = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - depth * (uFar - uNear));
}
float blurOf(float distance) { return smoothstep(sharpRange, fullRange, distance - uFocus) * uAmount; }
void main() {
  vec3 centre = texture2D(tDiffuse, vUv).rgb;
  float here = distanceAt(vUv);
  float blur = blurOf(here);
  if (blur < 0.02) { gl_FragColor = vec4(centre, 1.0); return; }
  vec3 total = centre;
  float weight = 1.0;
  // Each pixel turns its disc by its own angle. The pattern of the taps then reads as fine noise, not as rings.
  float spin = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
  for (int i = 0; i < taps; i++) {
    float turn = float(i) * 2.399963 + spin;
    float reach = sqrt((float(i) + 0.5) / float(taps));
    vec2 uv = vUv + vec2(cos(turn), sin(turn)) * reach * blur * maxRadius * vec2(uTexel.x / uTexel.y, 1.0);
    float there = distanceAt(uv);
    float share = there < here - 0.08 ? blurOf(there) / blur : 1.0;
    // A tiny, very bright glint would stamp the whole disc as dots. Its light is held to a level the disc can carry.
    total += min(texture2D(tDiffuse, uv).rgb, vec3(3.0)) * share;
    weight += share;
  }
  gl_FragColor = vec4(total / weight, 1.0);
}`

// The grade works on the finished picture: a little more contrast, cool shadows, warm lights, and fine grain. It adds no colour.
// The amounts are small. The palette of the lair stays as it is.
const gradeFragment = `
uniform sampler2D tDiffuse;
uniform vec2 uSize;
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec3 colour = texture2D(tDiffuse, vUv).rgb;
  colour = mix(colour, colour * colour * (3.0 - 2.0 * colour), 0.1);
  float light = dot(colour, vec3(0.2126, 0.7152, 0.0722));
  colour += (1.0 - smoothstep(0.0, 0.45, light)) * vec3(-0.006, 0.003, 0.005);
  colour += smoothstep(0.55, 1.0, light) * vec3(0.012, 0.005, -0.008);
  float grain = hash(vUv * uSize + floor(uTime * 24.0) * 7.13) - 0.5;
  colour += grain * 0.028 * (1.0 - light * 0.6);
  gl_FragColor = vec4(colour, 1.0);
}`

/**
 * The finishing pass for the lair: blur behind him in a conversation, bloom on what shines, then the grade.
 * It returns nothing when the tier has no finishing pass. The caller then draws the scene directly.
 * The scene is drawn once, into a target with its own antialiasing and a depth texture for the blur.
 */
export function createSceneFinish(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, quality: SceneQuality): SceneFinish | undefined {
  if (!quality.finish) return undefined
  const size = renderer.getDrawingBufferSize(new Vector2())
  const depth = new DepthTexture(size.x, size.y, UnsignedIntType)
  const target = new WebGLRenderTarget(size.x, size.y, { type: HalfFloatType, samples: quality.tier === 'high' ? 4 : 2, depthTexture: depth })
  const composer = new EffectComposer(renderer, target)
  composer.addPass(new RenderPass(scene, camera))
  const blur = quality.depthBlur ? new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uTexel: { value: new Vector2() }, uNear: { value: camera.near }, uFar: { value: camera.far }, uFocus: { value: 3 }, uAmount: { value: 0 } },
    vertexShader: screenVertex, fragmentShader: blurFragment,
  }) : undefined
  if (blur) composer.addPass(blur)
  // Only light above the white point blooms: wet glints, the drips, and the eyes. Lit skin stays below it.
  const bloom = new UnrealBloomPass(new Vector2(size.x, size.y), 0.2, 0.55, 2.6)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uSize: { value: new Vector2(size.x, size.y) }, uTime: { value: 0 } }, vertexShader: screenVertex, fragmentShader: gradeFragment })
  composer.addPass(grade)
  return {
    render({ time, focus, focusDistance }) {
      if (blur) {
        blur.enabled = focus > 0.001
        // The scene is drawn into the composer's read buffer, so its depth is there.
        blur.uniforms.tDepth!.value = composer.readBuffer.depthTexture
        blur.uniforms.uFocus!.value = focusDistance
        blur.uniforms.uAmount!.value = focus
        blur.uniforms.uNear!.value = camera.near
        blur.uniforms.uFar!.value = camera.far
      }
      grade.uniforms.uTime!.value = time
      composer.render()
    },
    setSize(width, height) {
      composer.setSize(width, height)
      const pixels = renderer.getDrawingBufferSize(new Vector2())
      blur?.uniforms.uTexel!.value.set(1 / pixels.x, 1 / pixels.y)
      grade.uniforms.uSize!.value.copy(pixels)
    },
    dispose() {
      composer.dispose()
      bloom.dispose()
      blur?.dispose()
      grade.dispose()
      depth.dispose()
    },
  }
}
