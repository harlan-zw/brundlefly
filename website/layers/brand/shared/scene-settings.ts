export type SceneSettings = {
  ambient: number
  key: number
  fill: number
  rim: number
  inner: number
  exposure: number
  fog: number
  zoom: number
  walkSpeed: number
  breath: number
  flow: number
  wetness: number
  textureGlow: number
  opening: number
  masterVolume: number
  ambienceVolume: number
  voiceVolume: number
  motionOff: boolean
}

export const defaultSceneSettings: SceneSettings = {
  ambient: 2.05,
  key: 80,
  fill: 2,
  rim: 1.85,
  inner: 4.9,
  exposure: 1.5,
  fog: 0.028,
  zoom: 1,
  walkSpeed: 0.38,
  breath: 1,
  flow: 1,
  wetness: 0.85,
  textureGlow: 0.17,
  opening: 0.7,
  masterVolume: 0.35,
  ambienceVolume: 0.55,
  voiceVolume: 0.8,
  motionOff: false,
}
