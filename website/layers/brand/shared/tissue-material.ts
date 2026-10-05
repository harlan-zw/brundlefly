import { BackSide, MeshStandardMaterial, NoColorSpace, ShaderChunk } from 'three'
import type { Texture } from 'three'

type SurfaceOptions = { texture: Texture, color: string, roughness: number, bumpScale: number }
  & ({ surface: 'enclosure', height: Texture, emissive: string, glow: number } | { surface: 'floor' })
export type TissueMotion = { time: number, breath: number, flow: number }

const organicNoise = `
float tissueHash(vec3 point) {
  point = fract(point * 0.1031);
  point += dot(point, point.yzx + 33.33);
  return fract((point.x + point.y) * point.z);
}
float tissueNoise(vec3 point) {
  vec3 cell = floor(point), blend = fract(point);
  blend = blend * blend * blend * (blend * (blend * 6.0 - 15.0) + 10.0);
  return mix(mix(mix(tissueHash(cell), tissueHash(cell + vec3(1,0,0)), blend.x),
    mix(tissueHash(cell + vec3(0,1,0)), tissueHash(cell + vec3(1,1,0)), blend.x), blend.y),
    mix(mix(tissueHash(cell + vec3(0,0,1)), tissueHash(cell + vec3(1,0,1)), blend.x),
    mix(tissueHash(cell + vec3(0,1,1)), tissueHash(cell + vec3(1,1,1)), blend.x), blend.y), blend.z);
}
float tissueLayers(vec3 point) {
  return tissueNoise(point) * 0.65 + tissueNoise(point * 2.13 + vec3(7.2,3.8,1.4)) * 0.35;
}
`

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
  return texture2D(surfaceMap, world.yz / 3.0) * weights.x
    + texture2D(surfaceMap, world.xz / 3.0) * weights.y
    + texture2D(surfaceMap, world.xy / 3.0) * weights.z;
}
`

/** The chamber and ground retain native PBR lights, with restrained local skin movement. */
export function createTissueMaterial(options: SurfaceOptions) {
  const heightTexture = (options.surface === 'enclosure' ? options.height : options.texture).clone()
  heightTexture.colorSpace = NoColorSpace
  heightTexture.needsUpdate = true
  const material = new MeshStandardMaterial({ color: options.color, map: options.texture,
    bumpMap: heightTexture, bumpScale: options.bumpScale, roughness: options.roughness, metalness: 0 })
  if (options.surface === 'enclosure') {
    material.roughnessMap = heightTexture
    material.aoMap = heightTexture
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
    if (options.surface === 'enclosure') shader.vertexShader = 'uniform float uTissueFlow;\nattribute vec3 roomProjectionPosition;\nattribute vec3 roomProjectionNormal;\n' + organicNoise + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 tissueWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vec3 tissueViewNormal = normalize(transformedNormal);
vec3 tissueNormal = normalize(vec3(dot(tissueViewNormal, viewMatrix[0].xyz),
  dot(tissueViewNormal, viewMatrix[1].xyz), dot(tissueViewNormal, viewMatrix[2].xyz)));
${options.surface === 'enclosure' ? 'tissueNormal = normalize(mat3(modelMatrix) * roomProjectionNormal);' : ''}
float tissueWave = sin(uTissueBreath * 0.46 + tissueWorld.x * 0.8 + tissueWorld.z * 0.53)
  * cos(tissueWorld.y * 1.2 - tissueWorld.z * 0.35 + uTissueBreath * 0.21);
float walkingEdge = smoothstep(2.2, 4.8, abs(tissueWorld.x));
float tissueAmplitude = mix(0.085, 0.002 * walkingEdge, uTissueFloor);
vec3 tissueOffset = tissueNormal * tissueWave * tissueAmplitude;
${options.surface === 'enclosure' ? `
vec3 roomAnchor = (modelMatrix * vec4(roomProjectionPosition, 1.0)).xyz;
vec3 roomCurrent = vec3(uTissueBreath * 0.045, -uTissueBreath * 0.032, uTissueBreath * 0.027);
float regionalPhase = tissueNoise(roomAnchor * 0.27) * 6.283185;
float regionalPulse = sin(uTissueBreath * 0.52 + regionalPhase);
float regionalSwell = tissueLayers(roomAnchor * 0.58 + roomCurrent) * 2.0 - 1.0;
tissueOffset += tissueNormal * (regionalPulse * 0.035 + regionalSwell * 0.05);
` : ''}
transformed += vec3(
  dot(tissueOffset, modelMatrix[0].xyz) / max(dot(modelMatrix[0].xyz, modelMatrix[0].xyz), 0.000001),
  dot(tissueOffset, modelMatrix[1].xyz) / max(dot(modelMatrix[1].xyz, modelMatrix[1].xyz), 0.000001),
  dot(tissueOffset, modelMatrix[2].xyz) / max(dot(modelMatrix[2].xyz, modelMatrix[2].xyz), 0.000001));
vTissueWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
    shader.vertexShader = shader.vertexShader.replace('vTissueWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      options.surface === 'enclosure'
        ? 'vTissueWorld = (modelMatrix * vec4(roomProjectionPosition, 1.0)).xyz; vTissueNormal = normalize(mat3(modelMatrix) * roomProjectionNormal);'
        : 'vTissueWorld = (modelMatrix * vec4(transformed, 1.0)).xyz; vTissueNormal = tissueNormal;')
    shader.fragmentShader = coordinates + shader.fragmentShader
    if (options.surface === 'enclosure') {
      shader.fragmentShader = organicNoise + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
        ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', 'roomTexture(map, vTissueWorld)'))
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
        ShaderChunk.emissivemap_fragment.replace('texture2D( emissiveMap, vEmissiveMapUv )', 'roomTexture(emissiveMap, vTissueWorld)')
        + '\ntotalEmissiveRadiance *= mix(0.18, 0.7, smoothstep(0.12, 0.8, roomTexture(bumpMap, vTissueWorld).r));')
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
        ShaderChunk.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', 'roomTexture(roughnessMap, vTissueWorld)')
          .replace('roughnessFactor *= texelRoughness.g;', `roughnessFactor *= mix(0.34, 1.0, smoothstep(0.18, 0.82, texelRoughness.g));
float wetFilm = tissueLayers(vTissueWorld * 0.85 + vec3(uTissueFlow * 0.065, uTissueBreath * 0.04, -uTissueFlow * 0.035));
roughnessFactor *= mix(0.82, 1.0, wetFilm);`))
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
vec3 wetPoint = vTissueWorld * 1.3 + vec3(uTissueFlow * 0.07, -uTissueBreath * 0.035, uTissueFlow * 0.04);
vec3 wetRipple = vec3(tissueNoise(wetPoint), tissueNoise(wetPoint + vec3(3.1,7.4,1.9)), tissueNoise(wetPoint + vec3(6.2,2.3,8.1))) - 0.5;
normal = normalize(normal + mat3(viewMatrix) * wetRipple * 0.035);`)
      shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>',
        ShaderChunk.aomap_fragment.replace('texture2D( aoMap, vAoMapUv ).r',
          'mix(0.42, 1.0, smoothstep(0.08, 0.65, roomTexture(aoMap, vTissueWorld).r))'))
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
  material.customProgramCacheKey = () => `brundlefly-tissue-${options.surface}-v5`
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
