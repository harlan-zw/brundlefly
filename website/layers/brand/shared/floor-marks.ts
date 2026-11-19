import { Color, CustomBlending, DoubleSide, OneMinusSrcAlphaFactor, ShaderMaterial, SrcAlphaFactor } from 'three'

const markVertex = `
attribute vec3 spot;
attribute vec4 spotData;
varying vec2 vReach;
varying vec4 vSpotData;
void main() {
  vReach = (position.xz - spot.xy) / spot.z;
  vSpotData = spotData;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
