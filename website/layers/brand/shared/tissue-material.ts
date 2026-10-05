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
varying vec3 vTissueNormal;
vec2 tissueCoordinates(vec2 uv) {
  float phase = uTissueFlow * 0.18;
  vec2 current = vec2(
    sin(vTissueWorld.x * 0.73 + vTissueWorld.z * 0.51 + phase),
    cos(vTissueWorld.y * 0.87 - vTissueWorld.z * 0.43 - phase * 0.77));
  float breath = sin(uTissueBreath * 0.46 + vTissueWorld.x * 0.36 + vTissueWorld.z * 0.24);
  // Regional drift keeps the surrounding skin alive without scrolling the entire room texture.
  return uv + current * mix(0.03, 0.018, uTissueFloor) + current.yx * breath * 0.004;
}
vec4 roomTexture(sampler2D surfaceMap, vec3 world) {
  vec3 weights = pow(abs(normalize(vTissueNormal)), vec3(4.0));
  weights /= max(weights.x + weights.y + weights.z, 0.00001);
  // One repeat covers three world units on every wall and rounded corner.
  return texture2D(surfaceMap, tissueCoordinates(world.yz / 3.0)) * weights.x
    + texture2D(surfaceMap, tissueCoordinates(world.xz / 3.0)) * weights.y
    + texture2D(surfaceMap, tissueCoordinates(world.xy / 3.0)) * weights.z;
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
    material.roughnessMap = heightTexture
    material.side = BackSide
    material.emissive.set(options.emissive)
    material.emissiveMap = options.texture
    material.emissiveIntensity = options.glow
  }
  const uniforms = { uTissueFlow: { value: 0 }, uTissueBreath: { value: 0 },
    uTissueFloor: { value: options.surface === 'floor' ? 1 : 0 } }
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = 'uniform float uTissueBreath;\nuniform float uTissueFloor;\nvarying vec3 vTissueWorld;\nvarying vec3 vTissueNormal;\n' + shader.vertexShader
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
    shader.vertexShader = shader.vertexShader.replace('vTissueWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      'vTissueWorld = (modelMatrix * vec4(transformed, 1.0)).xyz; vTissueNormal = tissueNormal;')
    shader.fragmentShader = coordinates + shader.fragmentShader
    if (options.surface === 'enclosure') {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
        ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', 'roomTexture(map, vTissueWorld)'))
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
        ShaderChunk.emissivemap_fragment.replace('texture2D( emissiveMap, vEmissiveMapUv )', 'roomTexture(emissiveMap, vTissueWorld)'))
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
        ShaderChunk.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', 'roomTexture(roughnessMap, vTissueWorld)')
          .replace('roughnessFactor *= texelRoughness.g;', 'roughnessFactor *= mix(0.72, 1.0, texelRoughness.g);'))
      shader.fragmentShader = shader.fragmentShader.replace('#include <bumpmap_pars_fragment>', `
#ifdef USE_BUMPMAP
uniform sampler2D bumpMap;
uniform float bumpScale;
vec2 dHdxy_fwd() {
  float height = roomTexture(bumpMap, vTissueWorld).x;
  return bumpScale * vec2(
    roomTexture(bumpMap, vTissueWorld + dFdx(vTissueWorld)).x - height,
    roomTexture(bumpMap, vTissueWorld + dFdy(vTissueWorld)).x - height);
}
${ShaderChunk.bumpmap_pars_fragment.slice(ShaderChunk.bumpmap_pars_fragment.indexOf('vec3 perturbNormalArb'))}`)
    }
    else {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
      ShaderChunk.map_fragment.replaceAll('vMapUv', 'tissueCoordinates(vMapUv)'))
    shader.fragmentShader = shader.fragmentShader.replace('#include <bumpmap_pars_fragment>',
      ShaderChunk.bumpmap_pars_fragment.replaceAll('vBumpMapUv', 'tissueCoordinates(vBumpMapUv)'))
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
      ShaderChunk.emissivemap_fragment.replaceAll('vEmissiveMapUv', 'tissueCoordinates(vEmissiveMapUv)'))
    }
  }
  material.customProgramCacheKey = () => `brundlefly-tissue-${options.surface}-v2`
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
