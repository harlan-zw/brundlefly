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
  mascot adds the canonical skinned relief. framing supports center or left composition.

The composer exports a complete Vue example and a versioned JSON preset.
Parse imported presets with parsePreset before rendering them.
Use standard Nuxt UI controls inside surfaces. They share the layer tokens.
Keep content 32px inward on desktop and 24px inward on mobile.
Artwork is masked into the edge zone. It must never enter editable content.

The 3D aperture uses uneven tissue meshes, connected membranes, chitin plates, bristles, slime, and GLSL deformation.
The material specimen needs no skeleton. The separate mascot relief uses a weighted body joints and nine face hinges.
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
The ZIP includes runtime artwork and model source. GLB models have separate download URLs.
Use a key when changing mascot or presentation, since each combination builds a different model.
The mascot maps canonical anatomy and generated detail onto an extruded silhouette, weighted body joints and nine face hinges, and baked idle, walk, and speaking clips.
It is a volumetric relief. Its front artwork does not supply a modeled back or side sculpt.

## World-only homepage

The homepage fills the viewport with the chamber and walking Brundlefly. It shows no visible tool panels or navigation.
Clicking Brundlefly opens a native local text dialog. The same named target supports Enter and Space.
Conversation pauses walking. System reduced motion stops the walk and idle deformation.
The separate /brand-kit/ app keeps the composer, material controls, parts, and Motion lab.

shared/world.ts exports createWorld(texture). It returns root, update({ time, pressure }), and dispose().
The model combines a rear tunnel, tissue walls, overhead ribs, walkable chitin ground, membranes, slime, and lights.
The ground uses y=-2.2. The rear tunnel starts at z=-2.5. Leave the foreground center clear for walking.
The renderer owns the shared texture. Model disposal releases geometry and materials without releasing that texture.

The homepage renderer lives in website/app/pages/_WorldScene.client.vue.
Its native dialog lives in _SpeechDialog.vue. Canonical local replies live in website/shared/conversation.ts.
The layer supplies visual models. Conversation behavior stays in the consuming app.
The mascot GLB contains the canonical texture, skin weights, skeleton, and idle, walk, and speaking clips.
The mascot remains a volumetric relief. Full side and back anatomy need additional sculpting.

Use the consumer inspector props to orbit the model, show bones, view wireframe, and play exported clips.
The standalone kit provides /mascot/ with mapped or sprite textures and manual face controls.
