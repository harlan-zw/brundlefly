/** Which mascot the homepage shows. */
export type MascotMode = 'mesh' | 'relief' | 'sprite'

/**
 * The full 3D model is the mascot. The `mascot` query value picks the relief rig or the sprite relief for comparison.
 * Any other value, or none, gives the model. The scene shows the relief rig if the model file cannot load.
 */
export const resolveMascotMode = (requested: unknown): MascotMode =>
  requested === 'relief' || requested === 'sprite' ? requested : 'mesh'
