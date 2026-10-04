# Brundlefly brand layer

Extend this Nuxt layer from a page app or a brand-kit app.

```ts
export default defineNuxtConfig({ extends: ['./path/to/brundlefly-brand'] })
```

Install the layer package dependencies and Nuxt in the consuming app.
The layer supplies tokens, fonts, Nuxt UI overrides, public art, and compositional primitives.

- BrandSurface: material, edges, density. Slot accepts arbitrary content.
- BrandAction: material and native button type. Slot carries the action label.
- BrandChoice: label, detail, selected. Native click selects the caller's state.
- BrandDivider: tendon, membrane, or suture. Decorative, outside content.
- BrandLair: motionOff, opening, wetness. Slot accepts a whole page. Receding geometry stays behind content.
- BrandComposition: workbench, split, stack. Slots carry any combination of surfaces.
- LazyBrandOrganism: specimen or lair presentation. Squeeze, twist, or unfurl transform.
  Opening, wetness, viscosity, pressure, motionOff, interactive, exportable.

The composer exports a complete Vue example and a versioned JSON preset.
Parse imported presets with parsePreset before rendering them.
Use standard Nuxt UI controls inside surfaces. They share the layer tokens.
Keep content 32px inward on desktop and 24px inward on mobile.
Artwork is masked into the edge zone. It must never enter editable content.

The 3D aperture uses uneven tissue meshes, connected membranes, chitin plates, bristles, slime, and GLSL deformation.
No skeleton is needed because there is no articulated character.
The GLB export stores a PBR rest mesh and diffuse texture for Blender.
The runtime shader remains in shared/organism.ts. GLB does not contain that shader.
Reduced motion stops the render loop. Pressure changes then render immediately.
If WebGL or texture loading fails, the component shows the static aperture.

Use BrandLair around the page without adding an entrance click.
The layer starts WebGL when the actual canvas appears, including client-only hydration.
Ambient parallax follows the pointer and scroll. Motion off and reduced motion freeze it.
Concept images remain in the full archive. The ZIP contains the runtime parts.

Native button presses produce a small compression response. No native event is prevented.
Field focus holds light pressure. Typing produces a brief contraction and moves the decorative surface seam.
Reduced motion disables that ambient response. The lab remains explicitly interactive.
The ZIP includes current rest GLBs. Earlier model snapshots remain in the full archive.
