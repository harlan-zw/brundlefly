/** Spatial translation of assets/source/scene-map.png. Coordinates are x/y/z world units. */
export const sceneLayout = {
  opening: { position: [0, 0.6, -2.9], scale: [0.98, 1.06, 1.15] },
  mascot: [0.65, -0.8],
  walk: [[1.35, 0.8], [-1.25, 0.6], [-0.75, -0.65], [0.9, -0.7]],
  eggs: [[-2.8, 2], [2.95, -0.25]],
  camera: { desktop: [0, 0.75, 10.4], portrait: [0, 1.1, 15.2], target: [0, -0.35, -2.1] },
} as const
