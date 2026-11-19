import { AdditiveBlending, BackSide, Color, ShaderMaterial } from 'three'
import type { MeshPhysicalMaterial, Texture } from 'three'
import { fogSurvival, fogUniforms } from './fog-fade'

/**
 * Gives a sac's membrane a brighter rim where it turns away from the eye, and a clearer middle.
 * The wet-glass surface stays: this adds to the glow and thins the middle, and it leaves the gloss alone.
 * Returns the rim's strength, for the caller to pulse.
 */
export function addMembraneRim(material: MeshPhysicalMaterial, color: Color) {
  const uniforms = { uRimColor: { value: color }, uRimStrength: { value: 1 } }
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = 'uniform vec3 uRimColor;\nuniform float uRimStrength;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float membraneRim = pow(1.0 - saturate(abs(dot(normalize(vViewPosition), normal))), 3.0);
totalEmissiveRadiance += uRimColor * membraneRim * uRimStrength;
// The membrane is thin where the eye looks straight through it, and dense along its turning edge.
diffuseColor.a = mix(diffuseColor.a * 0.86, min(1.0, diffuseColor.a * 1.25), membraneRim);`)
  }
  material.customProgramCacheKey = () => 'brundlefly-egg-membrane-rim-v1'
  return uniforms.uRimStrength
}

/**
 * Light inside the sacs, for an InstancedMesh of membrane copies drawn a little smaller than each sac.
 * Only the far wall draws, so the dark shape inside stands in front of the light.
 * It draws with the solid surfaces, before the membranes. The membrane then lies over the light, as skin lies over a lamp.
 * Each instance needs `sac` (its index in `levels`) and `sacColor`. The caller owns `levels`. The renderer owns `membrane`.
 */
export function createInnerGlowMaterial(levels: Float32Array, membrane: Texture) {
  return new ShaderMaterial({
    transparent: false, depthWrite: false, side: BackSide, blending: AdditiveBlending, fog: true,
    defines: { GLOW_SOURCES: levels.length },
    uniforms: { ...fogUniforms(), uGlowLevel: { value: levels }, uMembrane: { value: membrane } },
    vertexShader: `
attribute float sac;
attribute vec3 sacColor;
varying vec2 vUv;
varying vec3 vGlowNormal;
varying vec3 vGlowView;
varying vec3 vSacColor;
varying float vSac;
varying float vRise;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vSac = sac;
  vSacColor = sacColor;
  // The membrane copy spans -1 to 1 from its base to its tip.
  vRise = position.y;
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  // Each sac is stretched, so its normals take the inverse stretch. The light then dies exactly at the sac's outline.
  mat3 placed = mat3(instanceMatrix);
  vec3 stretch = vec3(dot(placed[0], placed[0]), dot(placed[1], placed[1]), dot(placed[2], placed[2]));
  vGlowNormal = normalMatrix * placed * (normal / stretch);
  vGlowView = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `
uniform float uGlowLevel[GLOW_SOURCES];
uniform sampler2D uMembrane;
varying vec2 vUv;
varying vec3 vGlowNormal;
varying vec3 vGlowView;
varying vec3 vSacColor;
varying float vSac;
varying float vRise;
#include <fog_pars_fragment>
${fogSurvival}
void main() {
  // The wall that faces the eye is brightest. The light dies toward the sac's outline, so it has no edge.
  float facing = abs(dot(normalize(vGlowNormal), normalize(vGlowView)));
  // The light pools low in the sac, around the growth.
  float pool = mix(1.0, 0.3, smoothstep(-0.5, 0.85, vRise));
  // Capillaries in the membrane shade the light.
  vec3 veins = 0.3 + texture2D(uMembrane, vUv * vec2(2.0, 1.0)).rgb * 1.4;
  float light = pow(facing, 2.4) * pool * uGlowLevel[int(vSac + 0.5)] * fogSurvival();
  gl_FragColor = vec4(vSacColor * veins * light, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  })
}
