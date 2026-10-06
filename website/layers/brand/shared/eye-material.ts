import { MeshPhysicalMaterial, ShaderChunk, Vector3 } from 'three'
import type { Texture } from 'three'

/**
 * The caller owns the reference texture. Time changes the wet surface, never eye geometry.
 * Meshes need an `eyeSphere` attribute: the unit sphere position before scaling. The iris and pupil travel over it.
 */
export function createEyeMaterial(texture: Texture) {
  const time = { value: 0 }
  const gaze = { value: new Vector3(0, 0, 1) }
  const pupil = { value: 0.16 }
  const shine = { value: 0 }
  const material = new MeshPhysicalMaterial({ map: texture, color: '#FFFFFF',
    roughness: 0.24, metalness: 0.02, clearcoat: 0.85, clearcoatRoughness: 0.16, alphaTest: 0.06 })
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { uEyeTime: time, uGaze: gaze, uPupil: pupil, uEyeshine: shine })
    const wobble = '(vMapUv + vec2(sin(uEyeTime * 0.53 + sin(uEyeTime * 1.4)) * 0.00065, sin(uEyeTime * 0.37) * 0.00035))'
    shader.vertexShader = `attribute vec3 eyeSphere;
varying vec3 vEyeSphere;
${shader.vertexShader}`
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vEyeSphere = eyeSphere;`)
    shader.fragmentShader = `uniform float uEyeTime;
uniform vec3 uGaze;
uniform float uPupil;
uniform float uEyeshine;
varying vec3 vEyeSphere;
${shader.fragmentShader}`
      .replace('#include <map_fragment>', `${ShaderChunk.map_fragment.replaceAll('vMapUv', wobble)}
// Iris coordinates follow the gaze axis over the unit eye, so the pupil slides beneath the fixed cornea glints.
vec3 eyeSurface = normalize(vEyeSphere);
vec3 eyeRight = normalize(cross(vec3(0.0, 1.0, 0.0), uGaze));
vec2 iris = vec2(dot(eyeSurface, eyeRight), dot(eyeSurface, cross(uGaze, eyeRight)));
float irisFront = step(0.0, dot(eyeSurface, uGaze));
float irisAngle = atan(iris.y, iris.x);
float irisRadius = length(iris * vec2(1.0, 1.08));
float irisEdge = fwidth(irisRadius) + 0.004;
// A mutated human pupil, never a clean disc.
float pupilEdge = uPupil * (1.0 + sin(irisAngle * 3.0 + 0.6) * 0.08 + sin(irisAngle * 5.0 - 1.1) * 0.04);
float bakedLight = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
float bakedGlint = smoothstep(0.32, 0.62, bakedLight);
float pupilMask = (1.0 - smoothstep(pupilEdge - irisEdge, pupilEdge + irisEdge, irisRadius)) * irisFront * (1.0 - bakedGlint);
float irisMask = (1.0 - smoothstep(0.42 - irisEdge * 2.0, 0.46 + irisEdge * 2.0, irisRadius)) * irisFront * (1.0 - bakedGlint);
float irisFibre = 0.5 + 0.5 * sin(irisAngle * 37.0 + sin(irisAngle * 7.0 + irisRadius * 9.0) * 2.4);
float collarette = exp(-pow((irisRadius - pupilEdge - 0.06) / 0.035, 2.0));
vec3 irisColor = mix(vec3(0.022, 0.055, 0.058), vec3(0.11, 0.27, 0.28), irisFibre * 0.5 + collarette * 0.5);
// Baked scales stay visible through the iris. The rim darkens into the blue-black eye.
irisColor *= (0.6 + bakedLight * 4.0) * (1.0 - smoothstep(0.26, 0.45, irisRadius) * 0.85);
diffuseColor.rgb = mix(diffuseColor.rgb, irisColor, irisMask * 0.85);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.004, 0.006, 0.008), pupilMask);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
vec2 eyeRipple = vec2(
  sin(vMapUv.x * 170.0 + vMapUv.y * 83.0 + uEyeTime * 0.8),
  cos(vMapUv.y * 145.0 - vMapUv.x * 61.0 - uEyeTime * 0.65)
) * 0.018;
normal = normalize(normal + vec3(eyeRipple, 0.0));`)
      .replace('#include <opaque_fragment>', `
vec3 eyeView = normalize(geometryViewDir);
float eyeFresnel = pow(1.0 - abs(dot(normal, eyeView)), 3.0);
float eyeFilm = 0.65 + sin(vMapUv.x * 23.0 + vMapUv.y * 19.0 + uEyeTime * 0.37) * 0.35;
vec3 wetDirection = normalize(vec3(0.23 + sin(uEyeTime * 0.71) * 0.16, 0.32 + cos(uEyeTime * 0.53) * 0.1, 1.0));
float wetGlint = pow(max(dot(normal, wetDirection), 0.0), 150.0);
outgoingLight += vec3(0.018, 0.065, 0.07) * eyeFresnel * eyeFilm;
outgoingLight += vec3(0.15, 0.18, 0.16) * wetGlint;
// The iris keeps a faint cold glow, so the pupil reads in a dark chamber.
outgoingLight += irisColor * irisMask * (1.0 - pupilMask) * (0.2 + collarette * 0.28);
// A watched visitor catches a cold eyeshine in the dilated pupil.
outgoingLight += vec3(0.03, 0.11, 0.115) * pupilMask * uEyeshine * pow(max(dot(normal, eyeView), 0.0), 3.0);
#include <opaque_fragment>`)
  }
  material.customProgramCacheKey = () => 'brundlefly-wet-eye-v3'
  return {
    material,
    updateTime(value: number) { time.value = value },
    /** `direction` is a unit vector in eye space. `size` is the pupil radius on the unit eye. */
    updateGaze(direction: { x: number, y: number, z: number }, size: number, eyeshine: number) {
      gaze.value.set(direction.x, direction.y, direction.z).normalize()
      pupil.value = size
      shine.value = eyeshine
    },
    dispose() { material.dispose() },
  }
}
