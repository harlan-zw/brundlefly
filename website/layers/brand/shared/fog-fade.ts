import { Color } from 'three'

/** The uniforms a ShaderMaterial needs when its `fog` is on. The renderer fills them from the scene's fog each frame. */
export function fogUniforms() {
  return { fogColor: { value: new Color() }, fogDensity: { value: 0 }, fogNear: { value: 1 }, fogFar: { value: 2000 } }
}

/**
 * GLSL for light that is added to the picture. The stock fog chunk mixes a surface toward the fog colour, which would add that colour instead of removing light.
 * `fogSurvival()` is the share of light that reaches the eye. It needs fog_pars_fragment, and fog_vertex in the vertex shader.
 */
export const fogSurvival = `
float fogSurvival() {
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      return exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      return 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
  #else
    return 1.0;
  #endif
}`
