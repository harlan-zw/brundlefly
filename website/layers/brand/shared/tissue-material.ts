import { BackSide, MeshStandardMaterial, NoColorSpace, ShaderChunk } from 'three'
import type { Texture } from 'three'

type SurfaceOptions = { texture: Texture, color: string, roughness: number, bumpScale: number }
  & ({ surface: 'enclosure', height: Texture, shell: Texture, emissive: string, glow: number } | { surface: 'floor' })
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
    uTissueFloor: { value: options.surface === 'floor' ? 1 : 0 },
    uTissueShell: { value: options.surface === 'enclosure' ? options.shell : null } }
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
    // A wet film reflects far more than bare skin. Diffuse environment light stays low, so the room keeps its depth.
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
radiance *= ${options.surface === 'enclosure' ? '1.4 + shellPlate * 2.2' : '1.5 + slimePool * 2.5'};
iblIrradiance *= 0.6;`)
    if (options.surface === 'enclosure') {
      // One height sample serves the plates, the glow, the roughness, the cavities, and the bump.
      shader.fragmentShader = 'uniform sampler2D uTissueShell;\nfloat tissueHeight;\nfloat tissueRelief;\n' + organicNoise + shader.fragmentShader
      // Dark chitin plates break through the flesh. Red tissue stays in the folds between them.
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
        ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', 'roomTexture(map, vTissueWorld)') + `
tissueHeight = roomTexture(bumpMap, vTissueWorld).r;
float shellField = tissueLayers(vTissueWorld * 0.55 + vec3(11.0, 3.0, 7.0))
  + (tissueHeight - 0.5) * 0.45;
float shellPlate = smoothstep(0.44, 0.58, shellField);
vec3 shellColor = roomTexture(uTissueShell, vTissueWorld * 1.7).rgb * vec3(0.7, 0.66, 0.52);
diffuseColor.rgb = mix(diffuseColor.rgb, shellColor, shellPlate);`)
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
        // The glow uses the colour artwork, so it takes the colour sample.
        ShaderChunk.emissivemap_fragment.replace('texture2D( emissiveMap, vEmissiveMapUv )', 'sampledDiffuseColor')
        + '\ntotalEmissiveRadiance *= mix(0.18, 0.7, smoothstep(0.12, 0.8, tissueHeight)) * (1.0 - shellPlate * 0.9);')
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
        ShaderChunk.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', 'vec4(tissueHeight)')
          .replace('roughnessFactor *= texelRoughness.g;', `roughnessFactor *= mix(0.42, 1.0, smoothstep(0.18, 0.82, texelRoughness.g));
float wetFilm = tissueLayers(vTissueWorld * 0.85 + vec3(uTissueFlow * 0.065, uTissueBreath * 0.04, -uTissueFlow * 0.035));
roughnessFactor *= mix(0.82, 1.0, wetFilm);
// Glassy plates catch the environment. The flesh between them stays satin.
roughnessFactor = mix(roughnessFactor, 0.26 + wetFilm * 0.14, shellPlate);`))
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
vec3 wetPoint = vTissueWorld * 1.3 + vec3(uTissueFlow * 0.07, -uTissueBreath * 0.035, uTissueFlow * 0.04);
vec3 wetRipple = vec3(tissueNoise(wetPoint), tissueNoise(wetPoint + vec3(3.1,7.4,1.9)), tissueNoise(wetPoint + vec3(6.2,2.3,8.1))) - 0.5;
normal = normalize(normal + mat3(viewMatrix) * wetRipple * 0.035);
// Steep relief scatters a reflection. A rougher film there gives a soft sheen, not glitter.
roughnessFactor = min(1.0, roughnessFactor + tissueRelief * 0.4);`)
      shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>',
        ShaderChunk.aomap_fragment.replace('texture2D( aoMap, vAoMapUv ).r',
          'mix(0.42, 1.0, smoothstep(0.08, 0.65, tissueHeight))'))
      shader.fragmentShader = shader.fragmentShader.replace('#include <bumpmap_pars_fragment>', `
#ifdef USE_BUMPMAP
uniform sampler2D bumpMap;
uniform float bumpScale;
vec2 dHdxy_fwd() {
  return bumpScale * vec2(
    roomTexture(bumpMap, vTissueWorld + dFdx(vTissueWorld)).x - tissueHeight,
    roomTexture(bumpMap, vTissueWorld + dFdy(vTissueWorld)).x - tissueHeight);
}
// The stock bump measures height change for each pixel, so relief fades as the wall fills fewer pixels.
// This one measures height change for each world unit. The relief keeps one strength at every distance.
vec3 perturbNormalArb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = dFdx(surf_pos.xyz);
  vec3 vSigmaY = dFdy(surf_pos.xyz);
  vec3 R1 = cross(vSigmaY, surf_norm);
  vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 slope = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2) / max(abs(fDet), 0.0000001) * 0.5;
  // Pore rims are near vertical. A soft limit keeps them from turning into glitter.
  slope /= sqrt(1.0 + dot(slope, slope));
  tissueRelief = length(slope);
  return normalize(surf_norm - slope);
}
#endif`)
    }
    else {
      // Slime collects in soft, uneven pools toward the walls. The walking line stays mostly clear.
      shader.fragmentShader = organicNoise + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
        ShaderChunk.map_fragment.replaceAll('vMapUv', 'tissueCoordinates(vMapUv)') + `
vec3 poolPoint = vec3(vTissueWorld.xz * 0.5, 0.0) + vec3(uTissueFlow * 0.01, -uTissueFlow * 0.007, uTissueBreath * 0.012);
float poolField = tissueLayers(poolPoint) + tissueNoise(poolPoint * 3.4) * 0.1
  + smoothstep(1.2, 3.8, abs(vTissueWorld.x)) * 0.24 - 0.08;
float slimePool = smoothstep(0.62, 0.72, poolField);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.66, 0.4), slimePool);`)
      shader.fragmentShader = shader.fragmentShader.replace('#include <bumpmap_pars_fragment>',
        ShaderChunk.bumpmap_pars_fragment.replaceAll('vBumpMapUv', 'tissueCoordinates(vBumpMapUv)'))
      // Fluid pools in the low cells. Raised ridges stay dull, so the floor glints in patches instead of a sheet.
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
float floorRelief = texture2D(bumpMap, tissueCoordinates(vBumpMapUv)).r;
roughnessFactor = clamp(roughnessFactor * mix(0.4, 1.9, smoothstep(0.18, 0.62, floorRelief)), 0.06, 1.0);
roughnessFactor = mix(roughnessFactor, 0.16, slimePool);`)
      // Liquid levels the relief beneath it.
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize(mix(normal, nonPerturbedNormal, slimePool * 0.55));`)
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
        ShaderChunk.emissivemap_fragment.replaceAll('vEmissiveMapUv', 'tissueCoordinates(vEmissiveMapUv)'))
    }
  }
  material.customProgramCacheKey = () => `brundlefly-tissue-${options.surface}-v7`
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
