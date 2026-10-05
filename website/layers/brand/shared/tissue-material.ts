import { BackSide, MeshStandardMaterial, NoColorSpace, ShaderChunk } from 'three'
import type { Texture } from 'three'

type SurfaceOptions = { texture: Texture, color: string, roughness: number, bumpScale: number }
  & ({ surface: 'enclosure', emissive: string, glow: number } | { surface: 'floor' })
export type TissueMotion = { time: number, breath: number, flow: number }

const coordinates = `
uniform float uTissueFlow;
uniform float uTissueBreath;
uniform float uTissueFloor;
varying vec3 vTissueWorld;
vec2 tissueCoordinates(vec2 uv) {
  float phase = uTissueFlow * 0.18;
  vec2 current = vec2(
    sin(vTissueWorld.x * 0.73 + vTissueWorld.z * 0.51 + phase),
    cos(vTissueWorld.y * 0.87 - vTissueWorld.z * 0.43 - phase * 0.77));
  float breath = sin(uTissueBreath * 0.46 + vTissueWorld.x * 0.36 + vTissueWorld.z * 0.24);
  // Regional drift keeps the surrounding skin alive without scrolling the entire room texture.
  return uv + current * mix(0.03, 0.018, uTissueFloor) + current.yx * breath * 0.004;
}
`

/** The chamber and ground retain native PBR lights, with restrained local skin movement. */
export function createTissueMaterial(options: SurfaceOptions) {
  const heightTexture = options.texture.clone()
  heightTexture.colorSpace = NoColorSpace
  heightTexture.needsUpdate = true
  const material = new MeshStandardMaterial({ color: options.color, map: options.texture,
    bumpMap: heightTexture, bumpScale: options.bumpScale, roughness: options.roughness, metalness: 0 })
  if (options.surface === 'enclosure') {
    material.side = BackSide
    material.emissive.set(options.emissive)
    material.emissiveMap = options.texture
    material.emissiveIntensity = options.glow
  }
  const uniforms = { uTissueFlow: { value: 0 }, uTissueBreath: { value: 0 },
    uTissueFloor: { value: options.surface === 'floor' ? 1 : 0 } }
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = 'uniform float uTissueBreath;\nuniform float uTissueFloor;\nvarying vec3 vTissueWorld;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 tissueWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vec3 tissueViewNormal = normalize(transformedNormal);
vec3 tissueNormal = normalize(vec3(dot(tissueViewNormal, viewMatrix[0].xyz),
  dot(tissueViewNormal, viewMatrix[1].xyz), dot(tissueViewNormal, viewMatrix[2].xyz)));
float tissueWave = sin(uTissueBreath * 0.46 + tissueWorld.x * 0.8 + tissueWorld.z * 0.53)
  * cos(tissueWorld.y * 1.2 - tissueWorld.z * 0.35 + uTissueBreath * 0.21);
float walkingEdge = smoothstep(2.2, 4.8, abs(tissueWorld.x));
float tissueAmplitude = mix(0.009, 0.002 * walkingEdge, uTissueFloor);
vec3 tissueOffset = tissueNormal * tissueWave * tissueAmplitude;
transformed += vec3(
  dot(tissueOffset, modelMatrix[0].xyz) / max(dot(modelMatrix[0].xyz, modelMatrix[0].xyz), 0.000001),
  dot(tissueOffset, modelMatrix[1].xyz) / max(dot(modelMatrix[1].xyz, modelMatrix[1].xyz), 0.000001),
  dot(tissueOffset, modelMatrix[2].xyz) / max(dot(modelMatrix[2].xyz, modelMatrix[2].xyz), 0.000001));
vTissueWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
    shader.fragmentShader = coordinates + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
      ShaderChunk.map_fragment.replaceAll('vMapUv', 'tissueCoordinates(vMapUv)'))
    shader.fragmentShader = shader.fragmentShader.replace('#include <bumpmap_pars_fragment>',
      ShaderChunk.bumpmap_pars_fragment.replaceAll('vBumpMapUv', 'tissueCoordinates(vBumpMapUv)'))
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
      ShaderChunk.emissivemap_fragment.replaceAll('vEmissiveMapUv', 'tissueCoordinates(vEmissiveMapUv)'))
  }
  material.customProgramCacheKey = () => `brundlefly-tissue-${options.surface}-v1`
  material.addEventListener('dispose', () => heightTexture.dispose())
  let previousTime: number | undefined
  return {
    material,
    update({ time, breath, flow }: TissueMotion) {
      const delta = previousTime === undefined ? 0 : Math.max(0, Math.min(time - previousTime, 0.1))
      previousTime = time
      uniforms.uTissueFlow.value += delta * Math.max(0, flow)
      uniforms.uTissueBreath.value += delta * Math.max(0, breath)
    },
    dispose() { material.dispose() },
  }
}
