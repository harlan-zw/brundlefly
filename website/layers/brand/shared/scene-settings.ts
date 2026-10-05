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
  motionOff: boolean
}

export const defaultSceneSettings: SceneSettings = {
  ambient: 0.85,
  key: 90,
  fill: 0.65,
  rim: 0.4,
  inner: 5,
  exposure: 1.05,
  fog: 0.028,
  zoom: 1,
  walkSpeed: 0.38,
  breath: 1,
  flow: 1,
  wetness: 0.85,
  textureGlow: 0.28,
  opening: 0.7,
  motionOff: false,
}
