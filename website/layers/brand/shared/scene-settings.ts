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
  ambient: 1.25,
  key: 79,
  fill: 2.05,
  rim: 2.35,
  inner: 7.9,
  exposure: 1.55,
  fog: 0.075,
  zoom: 0.9,
  walkSpeed: 0.42,
  breath: 1,
  flow: 1,
  wetness: 0.59,
  textureGlow: 0.94,
  opening: 0.47,
  masterVolume: 0.35,
  ambienceVolume: 0.55,
  voiceVolume: 0.8,
  motionOff: false,
}
