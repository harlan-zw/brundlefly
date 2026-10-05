import { MeshPhysicalMaterial, ShaderChunk } from 'three'
import type { Texture } from 'three'

/** The caller owns the reference texture. Time changes the wet surface, never eye geometry. */
export function createEyeMaterial(texture: Texture) {
  const time = { value: 0 }
  const material = new MeshPhysicalMaterial({ map: texture, color: '#FFFFFF',
    roughness: 0.24, metalness: 0.02, clearcoat: 0.85, clearcoatRoughness: 0.16, alphaTest: 0.06 })
  material.onBeforeCompile = shader => {
    shader.uniforms.uEyeTime = time
    const gaze = '(vMapUv + vec2(sin(uEyeTime * 0.53 + sin(uEyeTime * 1.4)) * 0.00065, sin(uEyeTime * 0.37) * 0.00035))'
    shader.fragmentShader = `uniform float uEyeTime;
${shader.fragmentShader}`
      .replace('#include <map_fragment>', ShaderChunk.map_fragment.replaceAll('vMapUv', gaze))
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
#include <opaque_fragment>`)
  }
  material.customProgramCacheKey = () => 'brundlefly-wet-eye-v2'
  return {
    material,
    updateTime(value: number) { time.value = value },
    dispose() { material.dispose() },
  }
}
