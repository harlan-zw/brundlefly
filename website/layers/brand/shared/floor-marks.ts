import { AdditiveBlending, Color, CustomBlending, DoubleSide, OneMinusSrcAlphaFactor, ShaderMaterial, SrcAlphaFactor } from 'three'
import type { Texture } from 'three'
import { floorSurface } from './floor-surface'
import { fogSurvival, fogUniforms } from './fog-fade'

const glsl = (value: number) => `(${value.toFixed(4)})`

const markVertex = `
attribute vec3 spot;
attribute vec4 spotData;
uniform mat3 uFloorUv;
varying vec2 vReach;
varying vec4 vSpotData;
varying vec2 vFloorUv;
#include <fog_pars_vertex>
void main() {
  vReach = (position.xz - spot.xy) / spot.z;
  vSpotData = spotData;
  // The floor's own texture coordinates at this point, so a mark can read the floor's colour.
  vec2 lattice = vec2((position.x - ${glsl(-floorSurface.width / 2)}) / ${glsl(floorSurface.width)},
    1.0 - (position.z - ${glsl(floorSurface.z - floorSurface.depth / 2)}) / ${glsl(floorSurface.depth)});
  vFloorUv = (uFloorUv * vec3(lattice, 1.0)).xy;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

/**
 * Floor marks draw with the solid surfaces, straight after the floor.
 * The egg shells draw before every see-through surface and write no depth. A see-through mark would paint over the glass.
 */
const onTheFloor = { transparent: false, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } as const

/**
 * Soft contact shade for createFloorDecalGeometry. A spot's first data number is its strength.
 * The shade is the night colour, which is also the fog colour. It takes no fog, because fog can only move the floor toward that same colour.
 */
export function createContactShadowMaterial() {
  return new ShaderMaterial({
    ...onTheFloor,
    blending: CustomBlending, blendSrc: SrcAlphaFactor, blendDst: OneMinusSrcAlphaFactor,
    uniforms: { uShade: { value: new Color('#080B08') } },
    vertexShader: markVertex,
    fragmentShader: `
uniform vec3 uShade;
varying vec2 vReach;
varying vec4 vSpotData;
void main() {
  float reach = dot(vReach, vReach);
  // A tight dark core sits under the object. A wide faint ring fades out before the mark's edge.
  float shade = exp(-reach * 8.0) * 0.55 + exp(-reach * 2.4) * 0.4;
  shade *= 1.0 - smoothstep(0.7, 1.0, sqrt(reach));
  gl_FragColor = vec4(uShade, shade * vSpotData.x);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  })
}

/**
 * Light that falls on the floor, for createFloorDecalGeometry. It is a fake: no lamp exists, so no other material pays for it.
 * The light is multiplied by the floor's own texture, as real light is. A flat tint would read as paint over the floor.
 * A spot's first three data numbers are its light colour. The fourth is its index in `levels`, the live strength of each light source.
 * The caller owns `levels` and writes it each frame. The renderer owns `floor`. The glow takes fog: it adds light, so fog removes its share.
 */
export function createFloorGlowMaterial(levels: Float32Array, floor: Texture) {
  return new ShaderMaterial({
    ...onTheFloor,
    blending: AdditiveBlending, fog: true,
    defines: { GLOW_SOURCES: levels.length },
    // The floor's material keeps this matrix current. It draws first, so the matrix is ready here.
    uniforms: { ...fogUniforms(), uGlowLevel: { value: levels }, uFloorMap: { value: floor }, uFloorUv: { value: floor.matrix } },
    vertexShader: markVertex,
    fragmentShader: `
uniform float uGlowLevel[GLOW_SOURCES];
uniform sampler2D uFloorMap;
varying vec2 vReach;
varying vec4 vSpotData;
varying vec2 vFloorUv;
#include <fog_pars_fragment>
${fogSurvival}
void main() {
  float reach = dot(vReach, vReach);
  float light = exp(-reach * 3.4) * (1.0 - smoothstep(0.7, 1.0, sqrt(reach)));
  light *= uGlowLevel[int(vSpotData.w + 0.5)] * fogSurvival();
  gl_FragColor = vec4(texture2D(uFloorMap, vFloorUv).rgb * vSpotData.rgb * light, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  })
}
