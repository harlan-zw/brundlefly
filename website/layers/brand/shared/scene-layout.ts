/** Spatial translation of assets/source/scene-map.png. Coordinates are x/y/z world units. */
export const sceneLayout = {
  opening: { position: [0, 0.6, -2.9], scale: [0.98, 1.06, 1.15] },
  mascot: [0.65, -0.8],
  walk: [[1.35, 0.8], [-1.25, 0.6], [-0.75, -0.65], [0.9, -0.7]],
  // The mesh mascot is a full body, about 2.5 units wide and 2 deep, so the relief rig's route takes it into the egg sacs.
  // Each stop and each leg of this route keeps its rest shape at least 0.2 units from every sac, for both facings.
  meshWalk: [[1.25, 0.8], [-0.05, 0.7], [-0.8, -1], [0.75, -0.95]],
  // Seconds he stands at each walk point before moving on.
  walkPauses: [2.6, 3.8, 1.8, 4.4],
  // What he does at each walk point. The second stop sits nearest an egg cluster.
  walkHabits: ['CheckPalm', 'GlanceEggs', 'WipeEye', 'ListenCeiling'],
  eggs: [[-2.8, 2], [2.95, -0.25]],
  camera: { desktop: [0, 0.75, 10.4], portrait: [0, 1.1, 15.2], target: [0, -0.35, -2.1] },
} as const
