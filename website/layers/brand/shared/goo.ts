import { MeshPhysicalMaterial, NoColorSpace, ShaderChunk } from 'three'
import type { Texture } from 'three'

export type GooInput = { time: number, breath: number, flow: number, wetness: number, key: number, fill: number, rim: number }

const filmShader = `
uniform float uGooFlow;
uniform float uGooBreath;
varying vec3 vGooWorld;
vec2 gooCoordinates(vec2 uv) {
  vec3 geometric = normalize(cross(dFdx(vGooWorld), dFdy(vGooWorld)));
  float horizontal = smoothstep(0.6, 0.92, abs(geometric.y));
  // TubeGeometry's first UV axis runs down the filament. Floor film uses continuous world projection.
  vec2 p = mix(uv * vec2(2.4, 1.3), vGooWorld.xz * 0.6, horizontal);
  float drift = uGooFlow;
  vec2 current = vec2(sin(p.y * 3.1 + drift * 0.12), cos(p.x * 3.6 - drift * 0.08));
  p += current * 0.022 + vec2(-drift * 0.012, drift * 0.004);
  p += vec2(sin(uGooBreath * 0.6 + p.y), cos(uGooBreath * 0.48 + p.x)) * 0.003;
  return p;
}
`

/** Clear wet film over muted pigment. Scene lights supply every reflection and highlight. */
export function createGooMaterial(texture: Texture) {
  // The color artwork supplies a small height proxy, not a normal map. Height is non-color data.
  const heightTexture = texture.clone()
  heightTexture.colorSpace = NoColorSpace
  heightTexture.needsUpdate = true
  const uniforms = { uGooFlow: { value: 0 }, uGooBreath: { value: 0 } }
  const material = new MeshPhysicalMaterial({
    name: 'Brundlefly-viscous-film',
    color: '#ADB394',
    map: texture,
    bumpMap: heightTexture,
    bumpScale: 0.018,
    metalness: 0,
    roughness: 0.17,
    clearcoat: 1,
    clearcoatRoughness: 0.055,
    ior: 1.34,
    transmission: 0.32,
    thickness: 0.075,
    attenuationColor: '#57654F',
    attenuationDistance: 0.65,
    // Physical transmission retains reflection. Alpha blending would weaken the wet highlights.
    opacity: 1,
    transparent: false,
    depthWrite: true,
  })
  material.onBeforeCompile = shader => {
    shader.uniforms.uGooFlow = uniforms.uGooFlow
    shader.uniforms.uGooBreath = uniforms.uGooBreath
    shader.vertexShader = 'uniform float uGooFlow;\nuniform float uGooBreath;\nvarying vec3 vGooWorld;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
vec3 gooWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vec3 gooViewNormal = normalize(transformedNormal);
vec3 gooWorldNormal = normalize(vec3(dot(gooViewNormal, viewMatrix[0].xyz),
  dot(gooViewNormal, viewMatrix[1].xyz), dot(gooViewNormal, viewMatrix[2].xyz)));
float gooPulse = sin(uGooBreath * 0.65 + gooWorld.x * 0.65 + gooWorld.z * 0.4) * 0.0022;
float gooCreep = sin(gooWorld.y * 3.1 - uGooFlow * 0.23 + gooWorld.x) * 0.0013;
vec3 gooOffset = gooWorldNormal * (gooPulse + gooCreep);
// Do not push the floor film below its current contact surface.
float floorContact = 1.0 - smoothstep(-2.22, -2.11, gooWorld.y);
gooOffset.y = mix(gooOffset.y, max(0.0, gooOffset.y), floorContact);
// Orthogonal model axes convert a millimeter world offset through nonuniform puddle scales.
transformed += vec3(
  dot(gooOffset, modelMatrix[0].xyz) / max(dot(modelMatrix[0].xyz, modelMatrix[0].xyz), 0.000001),
  dot(gooOffset, modelMatrix[1].xyz) / max(dot(modelMatrix[1].xyz, modelMatrix[1].xyz), 0.000001),
  dot(gooOffset, modelMatrix[2].xyz) / max(dot(modelMatrix[2].xyz, modelMatrix[2].xyz), 0.000001));
vGooWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
    shader.fragmentShader = filmShader + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
      ShaderChunk.map_fragment.replaceAll('vMapUv', 'gooCoordinates(vMapUv)'))
    shader.fragmentShader = shader.fragmentShader.replace('#include <bumpmap_pars_fragment>',
      ShaderChunk.bumpmap_pars_fragment.replaceAll('vBumpMapUv', 'gooCoordinates(vBumpMapUv)'))
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor *= mix(0.8, 1.15, texture2D(map, gooCoordinates(vMapUv)).g);')
  }
  // World teardown may dispose materials directly through scene traversal.
  material.addEventListener('dispose', () => heightTexture.dispose())
  material.customProgramCacheKey = () => 'brundlefly-physical-viscous-film-v2'
  let previousTime: number | undefined

  return {
    material,
    update({ time, breath, flow, wetness }: GooInput) {
      const delta = previousTime === undefined ? 0 : Math.max(0, Math.min(time - previousTime, 0.1))
      previousTime = time
      // Accumulated phases stop without jumping when either movement control reaches zero.
      uniforms.uGooFlow.value += delta * Math.max(0, flow)
      uniforms.uGooBreath.value += delta * Math.max(0, breath)
      const wet = Math.min(1, Math.max(0, wetness))
      material.roughness = 0.34 - wet * 0.2
      material.clearcoatRoughness = 0.17 - wet * 0.13
      material.bumpScale = 0.008 + wet * 0.012
      material.transmission = 0.2 + wet * 0.14
    },
    dispose() {
      material.dispose()
      // The source color texture is shared and stays renderer-owned.
    },
  }
}
