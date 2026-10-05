import type { MeshStandardMaterial } from 'three'

export type MascotSurfaceKind = 'skin' | 'wing'

/** Keep the artwork fixed. Animate only its microscopic lighting response. */
export function applyMascotSurface(material: MeshStandardMaterial, kind: MascotSurfaceKind) {
  const previousCompile = material.onBeforeCompile
  const previousCacheKey = material.customProgramCacheKey
  const inheritedKey = previousCacheKey.call(material)
  const uniforms = { uMascotSurfaceTime: { value: 0 }, uMascotSurfaceWing: { value: kind === 'wing' ? 1 : 0 } }
  let disposed = false
  const compile: typeof material.onBeforeCompile = (shader, renderer) => {
    previousCompile.call(material, shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = 'varying vec2 vMascotSurfaceUv;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvMascotSurfaceUv = uv;')
    shader.fragmentShader = `
uniform float uMascotSurfaceTime;
uniform float uMascotSurfaceWing;
varying vec2 vMascotSurfaceUv;
float mascotSurfaceWetness(vec2 uv) {
  float phase = uMascotSurfaceTime * 0.19;
  return sin(uv.x * 23.0 + uv.y * 13.0 + phase)
    * cos(uv.y * 19.0 - uv.x * 9.0 - phase * 0.71);
}
` + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
float mascotWetness = mascotSurfaceWetness(vMascotSurfaceUv);
roughnessFactor = clamp(roughnessFactor + mascotWetness * mix(0.045, 0.025, uMascotSurfaceWing), 0.2, 0.95);`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
float mascotMicroHeight = sin(vMascotSurfaceUv.x * 317.0 + sin(vMascotSurfaceUv.y * 151.0) + uMascotSurfaceTime * 0.31)
  * sin(vMascotSurfaceUv.y * 283.0 - uMascotSurfaceTime * 0.23) * mix(0.00004, 0.000018, uMascotSurfaceWing);
#ifdef USE_BUMPMAP
  normal = perturbNormalArb(-vViewPosition, normal, vec2(dFdx(mascotMicroHeight), dFdy(mascotMicroHeight)), faceDirection);
#endif`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>
#if defined(USE_CLEARCOAT) && defined(USE_BUMPMAP)
  clearcoatNormal = perturbNormalArb(-vViewPosition, clearcoatNormal, vec2(dFdx(mascotMicroHeight), dFdy(mascotMicroHeight)) * 0.4, faceDirection);
#endif`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
  material.clearcoatRoughness = clamp(material.clearcoatRoughness + mascotWetness * 0.012, 0.055, 1.0);
#endif`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
// Warm grazing skin response uses existing irradiance, so darkness stays dark.
float mascotGrazing = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.0);
reflectedLight.indirectDiffuse *= mix(vec3(1.0), vec3(1.04, 1.005, 0.975),
  mascotGrazing * (0.5 + mascotWetness * 0.15) * (1.0 - uMascotSurfaceWing));`)
  }
  material.onBeforeCompile = compile
  material.customProgramCacheKey = () => `${inheritedKey}|brundlefly-mascot-surface-${kind}-v1`
  material.needsUpdate = true
  return {
    update(time: number) { if (!disposed && Number.isFinite(time)) uniforms.uMascotSurfaceTime.value = Math.max(0, time) },
    dispose() {
      if (disposed) return
      disposed = true
      if (material.onBeforeCompile === compile) {
        material.onBeforeCompile = previousCompile
        material.customProgramCacheKey = previousCacheKey
        material.needsUpdate = true
      }
    },
  }
}
