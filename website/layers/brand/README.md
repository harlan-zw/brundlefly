# Brundlefly brand layer

Extend this Nuxt layer from a page app or a brand-kit app.

```ts
export default defineNuxtConfig({ extends: ['./path/to/brundlefly-brand'] })
```

Install the layer package dependencies and Nuxt in the consuming app.
The layer supplies tokens, fonts, Nuxt UI overrides, public art, and five compositional primitives.

- BrandSurface: material, edges, density. Slot accepts arbitrary content.
- BrandAction: material and native button type. Slot carries the action label.
- BrandChoice: label, detail, selected. Native click selects the caller's state.
- BrandDivider: tendon or membrane. Decorative, outside content.
- BrandComposition: workbench, split, stack. Slots carry any combination of surfaces.
- LazyBrandOrganism: client-only material mesh. Wetness, viscosity, pressure, motionOff, exportable.

The composer exports a complete Vue example and a versioned JSON preset.
Parse imported presets with parsePreset before rendering them.
Use standard Nuxt UI controls inside surfaces. They share the layer tokens.
Keep content 32px inward on desktop and 24px inward on mobile.
Artwork is masked into the edge zone. It must never enter editable content.

The 3D aperture uses Three.js torus folds, chitin plates, bristles, slime, and GLSL deformation.
No skeleton is needed because there is no articulated character.
The GLB export stores a PBR rest mesh and diffuse texture for Blender.
The runtime shader remains in shared/organism.ts. GLB does not contain that shader.
Reduced motion stops the render loop. Pressure changes then render immediately.
If WebGL or texture loading fails, the component shows the static aperture.
