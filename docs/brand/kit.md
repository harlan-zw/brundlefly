# Brundlefly brand kit

This kit supplies composable Nuxt parts, material artwork, and an interactive 3D specimen.

Open the website’s /brand-kit/ app to compose parts and copy Vue or JSON presets.
Download the complete Nuxt layer there. [Layer source](../../website/layers/brand/README.md) defines installation and component APIs.
[Brand rules](../arch/brand.md) control anatomy and identity.
[COPY.md](../../website/COPY.md) controls public language.

![Material specimens](../../assets/brand/kit/material-board.png)

## Identity

Keep the hunched adult, four arms, two legs, and two unequal developing wings.
Keep folded rusty flesh, dark chitin, bristles, and blue-black eyes with tiny teal reflections.
Use the supplied raster wordmark. Never recreate its lettering.
No cute proportions, orange eyes, blood spray, clothing, or exposed organs.
Materials may exist alone. They must never imply a different mascot anatomy.

## Composition grammar

Choose a layout. Add surfaces. Attach edge parts. Place labelled controls inside each surface.
Use darkness between pieces. Keep dense flesh, bristles, and slime at the edges.
Scale the composition by changing layout and density, rather than stretching artwork.
The layout responds to its container, so a nested preview behaves like a standalone page.

| Piece | Inputs | Purpose |
| --- | --- | --- |
| BrandComposition | workbench, split, stack | Arrange any slotted content |
| BrandSurface | flesh, chitin, membrane; edges; density 0–1 | Quiet content area with interchangeable biological edges |
| BrandAction | material, native type and disabled state | Clear action with a small slime reaction |
| BrandChoice | label, detail, selected | Native choice with visible selection |
| BrandDivider | tendon, membrane, suture | Connect or separate sections |
| BrandLair | motionOff, opening, wetness; arbitrary slotted content | Nonblocking full-page chamber with receding 3D ribs |
| LazyBrandOrganism | presentation, transform, opening, wetness, viscosity, pressure, motionOff, exportable | Inspectable specimen or lair geometry |

The app exports versioned presets. Imports parse values before generating Vue.
The copied Vue runs an explicit component preview. Replace its handler with the page’s real task.
Parts have no task logic. The tool page owns its input, results, and skill downloads.

## Design direction

![Image-generated modular concept](../../assets/brand/kit/modular/design-direction.png)

The concept seeded implementation before code. Its generated decorative text has no copy authority.
The canonical banner and material board seeded the new production pieces.
[Exact prompts and references](../../assets/prompts/modular-kit.json) record each generation.

## Artifact register

Paths below are relative to the repository root.

| Artifact | File | Use |
| --- | --- | --- |
| Canonical full-arm banner | assets/brand/github-banner-overhang-gross.png | Primary identity, preserve the entire silhouette |
| Avatar | assets/brand/github-avatar.png | Compact identity |
| Character | assets/brand/character.png | Full anatomy reference |
| Character sheet | assets/brand/character-sheet.png | Pose and material reference |
| Social preview | assets/brand/github-social-preview.jpg | Link previews |
| Earlier banner | assets/brand/github-banner.png | Existing alternate, canonical gross banner takes priority |
| Earlier overhang | assets/brand/github-banner-overhang.png | Existing alternate, do not substitute on the tool page |
| Material board, 1536 × 1024 | assets/brand/kit/material-board.png | Flesh rim, wing, mucus, chitin, tendon, aperture reference |
| Instrument surround, 1536 × 1024, RGBA | assets/brand/kit/instrument-surround.png | Irregular outer boundary of the work area |
| Aperture, 1254 × 1254, RGBA | assets/brand/kit/aperture.png | Idle output and interaction feedback |
| High-resolution masters | assets/source/* | Original production masters, retain unchanged |
| Historical concepts | assets/archive/* | Inspiration only; no authority over anatomy or copy |
| Generation prompts | assets/prompts/* | Reproduction and provenance |
| Design tokens and rules | website/DESIGN.md | Code-facing implementation contract |
| Shared materials and motion | website/layers/brand/app/assets/css/brand.css | Palette, pieces, edge zones, focus and reduced motion |
| Page layout | website/app/assets/css/main.css | Task-specific composition |
| Modular concept | assets/brand/kit/modular/design-direction.png | Design exploration, never public copy |
| Flesh corner | assets/brand/kit/modular/flesh-corner.png | RGBA 1254 × 1254, interchangeable corner cap |
| Membrane divider | assets/brand/kit/modular/membrane-divider.png | RGBA 1536 × 1024, ragged wing strip |
| Tendon connector | assets/brand/kit/modular/tendon-connector.png | RGBA 1536 × 1024, tensioned connection |
| Flesh diffuse | assets/brand/kit/modular/flesh-diffuse.png | RGB 1254 × 1254, mirrored-repeat color texture |
| Rest model | assets/brand/kit/modular/aperture-rest.glb | GLB 2.0 mesh and texture, imports into Blender |
| Procedural model and shader | website/layers/brand/shared/organism.ts | Source of geometry, deformation, and wet lighting |
| Model lifecycle | website/layers/brand/app/components/BrandOrganism.client.vue | Lazy WebGL, controls, disposal, fallback, GLB export |
| Component catalogue | website/layers/brand/shared/catalogue.ts | Palette, parts, composition presets, validated import |

New kit images were generated from canonical artwork with image generation.
They extend materials, not the mascot or wordmark.
Keep original PNG alpha. Use pixelated rendering. Do not stretch the aspect ratio.
The board is documentation, not a sprite atlas. Use the separate production files on the page.

## Palette

| Material | Hex | Interface role |
| --- | --- | --- |
| Night | #080B08 | Quiet work area |
| Cream | #E8D4A6 | Text, primary action, focus |
| Flesh | #AA604B | Hover and organic edges |
| Bruise | #69404B | Wording highlights |
| Chitin | #343C3B | Dividers and structural surfaces |
| Eye | #418B90 | Small active-state glint |
| Wing | #A4B5A0 | Secondary text and membrane |
| Olive | #777648 | Slime, never body text |

## Type and space

IBM Plex Mono names controls and generated output.
IBM Plex Sans carries editable text. Barlow Condensed is available for functional headings.
The raster banner carries the identity. Avoid oversized marketing headings.
Use 16px editable text, 14px control labels, and 44px minimum targets.
Keep artwork outside editable areas. Leave more darkness than ornament.

## Layout explorations

| Direction | Composition | Decision |
| --- | --- | --- |
| Living instrument | Asymmetric surround; controls attach to its edge; input and output occupy the opening | Rejected after owner review, artwork competed with task clarity |
| Specimen drawer | Separate specimens open vertically into work surfaces | Reserve, adds navigation before the task |
| Wing map | Skill controls sit on a branching membrane with floating input | Reserve, impressive but weaker mobile reading order |
| Task-first workspace | Outcome choices beside an unobstructed form; results follow submission | Selected after owner review, user workflow comes first |

## Tool page contract

Three task choices name outcomes and retain exact skill names.
The canonical banner anchors identity. Edge artwork stays outside the readable content zone.
Forms begin empty. Use example fills sample data only on request.
Task changes retain input and results. Editing input clears stale output.
Show results after submission. Focus the result or error. Offer a copy action beside the result.
Place full skill downloads and instructions below the form.
On mobile, task choices precede input and results. No material can obscure a control.

## Motion and interaction

The primary action grows a small slime drip on hover.
The tool page sits inside a 3D chamber. It starts without an entrance gate or extra click.
The chamber responds to pointer movement and scroll. Native button presses produce a small compression response.
It never intercepts a form event. Reduced motion disables ambient camera and button reactions.
The kit Motion section offers separate aperture and lair scenes, with squeeze, twist, and unfurl controls.
Motion off and system reduced motion stop idle motion. Pointer pressure remains an explicit interaction.
Hidden and offscreen specimens stop their animation loop. Teardown disposes GPU resources.
If WebGL or the texture fails, use the static aperture with a clear status.

## 3D construction

Three uneven procedural folds form the aperture. Six receding, lobed ribs form the lair.
Fold thickness varies around each contour. Tendons and translucent membranes connect the layers.
Both share a shader and material system. Chitin plates pivot on a lightweight Group hierarchy.
Opening moves the folds, plates, bristles, and slime together. Unfurl opens the hinges further.
Twist produces radial torsion. Squeeze compresses the folds and follows the captured pointer.
The pressure spring uses viscosity. Dragging keeps pointer capture until release.
GLSL adds pressure displacement, pulse, cool rim light, and wet highlights.
Viscosity sets pressure response speed. Wetness sets the highlight strength.
The diffuse texture uses mirrored repeat. The supplied color image is not a normal map.
Geometry normals and shader deformation supply depth. No bone skeleton is required for this material specimen.
The canonical mascot has no invented rig or new anatomy.

The GLB contains rest geometry and a PBR texture. Runtime GLSL remains in the layer source.
The kit can export its current model. The checked-in rest model provides a fixed interchange artifact.
Blender can edit that GLB. A .blend file is unnecessary for this procedural source.
Blender import was not exercised on this host.

## Portability

The downloadable layer bundles components, tokens, TypeScript, runtime artwork, and installation instructions.
Concept boards and unused complete frames remain in the full archive, outside the runtime ZIP.
It declares its Nuxt UI, fonts, VueUse, Three.js, and Three.js type dependencies.
Both Nuxt apps extend that layer. They share one asset origin and deploy as one static Cloudflare Worker.
Nuxt generates each app. Vite packages the combined output. cf deploy --prebuilt uses that verified package.
This explicit build avoids Cloudflare CLI framework guessing across the monorepo.

## Limits

These are local workflow demos, not remote agent execution.
Writing signals invite review. They cannot identify an author.
The guide demo produces a structure. The PR demo formats a draft.
Keep these limits in an expandable disclosure near the work area.

## Lair direction

![Lair exploration](../../assets/brand/kit/lair/lair-direction.png)

The canonical banner and modular concept seeded this image before the 3D revision.
The implemented chamber keeps readable controls within quiet surfaces.
New small details use separate PNGs, rather than cutting the concept into a sprite sheet.
[Exact prompts and seeds](../../assets/prompts/lair-kit.json) record the built-in imagegen work.
The generated concept never replaces the supplied wordmark.

## Complete file inventory

| File | Dimensions or type | Role |
| --- | --- | --- |
| [Visceral direction](../../assets/brand/kit/lair/visceral-direction.png) | 1774 × 887, PNG | Organic surface exploration |
| [Surface seam](../../assets/brand/kit/lair/tissue-seam.png) | 2172 × 724, RGBA | Continuous reusable panel edge |
| [Visceral prompts](../../assets/prompts/visceral-kit.json) | JSON | Exact prompts and references |
| [Organic aperture](../../assets/brand/kit/lair/aperture-organic-rest.glb) | GLB 2.0, 4,571,824 bytes | Uneven folds and connected membranes |
| [Organic lair](../../assets/brand/kit/lair/lair-organic-rest.glb) | GLB 2.0, 4,968,444 bytes | Lobed chamber and connective tissue |
| [Lair direction](../../assets/brand/kit/lair/lair-direction.png) | 1536 × 1024, PNG | Exploration |
| [Chitin clasp](../../assets/brand/kit/lair/clasp.png) | 1254 × 1254, PNG | Small selection marker |
| [Mucus bead](../../assets/brand/kit/lair/bead.png) | 1254 × 1254, PNG | Small status and action detail |
| [Membrane suture](../../assets/brand/kit/lair/suture.png) | 1536 × 1024, PNG | Thin divider |
| [Lair prompts](../../assets/prompts/lair-kit.json) | JSON | Prompt |
| [Aperture rest model v2](../../assets/brand/kit/lair/aperture-rest-v2.glb) | GLB 2.0, 4,441,080 bytes | Earlier fold and hinge snapshot |
| [Lair rest model](../../assets/brand/kit/lair/lair-rest.glb) | GLB 2.0, 4,664,944 bytes | Earlier elliptical chamber snapshot |
| [Modular design concept](../../assets/brand/kit/modular/design-direction.png) | 1536 × 1024 | Exploration |
| [Flesh corner](../../assets/brand/kit/modular/flesh-corner.png) | 1254 × 1254, RGBA | Current part |
| [Membrane divider](../../assets/brand/kit/modular/membrane-divider.png) | 1536 × 1024, RGBA | Current part |
| [Tendon connector](../../assets/brand/kit/modular/tendon-connector.png) | 1536 × 1024, RGBA | Current part |
| [Flesh diffuse](../../assets/brand/kit/modular/flesh-diffuse.png) | 1254 × 1254, RGB | Current texture |
| [Rest model](../../assets/brand/kit/modular/aperture-rest.glb) | GLB 2.0 | Current model |
| [Modular prompts](../../assets/prompts/modular-kit.json) | JSON | Prompt |
| [assets/archive/brand-kit/avatar-master-v2.png](../../assets/archive/brand-kit/avatar-master-v2.png) | 1254 × 1254 | Historical |
| [assets/archive/brand-kit/avatar-master.png](../../assets/archive/brand-kit/avatar-master.png) | 1254 × 1254 | Historical |
| [assets/archive/brand-kit/avatar-preview-32.png](../../assets/archive/brand-kit/avatar-preview-32.png) | 32 × 32 | Historical |
| [assets/archive/brand-kit/avatar-preview-48.png](../../assets/archive/brand-kit/avatar-preview-48.png) | 48 × 48 | Historical |
| [assets/archive/brand-kit/avatar-preview-96.png](../../assets/archive/brand-kit/avatar-preview-96.png) | 96 × 96 | Historical |
| [assets/archive/brand-kit/avatar-refinement-prompt.txt](../../assets/archive/brand-kit/avatar-refinement-prompt.txt) | Reference file | Historical |
| [assets/archive/brand-kit/banner-arm-fix-prompt.txt](../../assets/archive/brand-kit/banner-arm-fix-prompt.txt) | Reference file | Historical |
| [assets/archive/brand-kit/banner-master-v2.png](../../assets/archive/brand-kit/banner-master-v2.png) | 1774 × 887 | Historical |
| [assets/archive/brand-kit/banner-master.png](../../assets/archive/brand-kit/banner-master.png) | 1774 × 887 | Historical |
| [assets/archive/brand-kit/brand-guide.md](../../assets/archive/brand-kit/brand-guide.md) | Reference file | Historical |
| [assets/archive/brand-kit/brundlefly-brand-kit.zip](../../assets/archive/brand-kit/brundlefly-brand-kit.zip) | Reference file | Historical |
| [assets/archive/brand-kit/canonical-character.png](../../assets/archive/brand-kit/canonical-character.png) | 1199 × 1312 | Historical |
| [assets/archive/brand-kit/character-sheet.png](../../assets/archive/brand-kit/character-sheet.png) | 1536 × 1024 | Historical |
| [assets/archive/brand-kit/generation-prompts.json](../../assets/archive/brand-kit/generation-prompts.json) | Reference file | Historical |
| [assets/archive/brand-kit/github-avatar-v2.png](../../assets/archive/brand-kit/github-avatar-v2.png) | 500 × 500 | Historical |
| [assets/archive/brand-kit/github-avatar.png](../../assets/archive/brand-kit/github-avatar.png) | 500 × 500 | Historical |
| [assets/archive/brand-kit/github-banner-v2.png](../../assets/archive/brand-kit/github-banner-v2.png) | 1280 × 640 | Historical |
| [assets/archive/brand-kit/github-banner.png](../../assets/archive/brand-kit/github-banner.png) | 1280 × 640 | Historical |
| [assets/archive/brand-kit/github-social-preview-v2.jpg](../../assets/archive/brand-kit/github-social-preview-v2.jpg) | Reference file | Historical |
| [assets/archive/brand-kit/github-social-preview.jpg](../../assets/archive/brand-kit/github-social-preview.jpg) | Reference file | Historical |
| [assets/archive/concepts/brundlefly-brand-board.png](../../assets/archive/concepts/brundlefly-brand-board.png) | 1536 × 1024 | Historical |
| [assets/archive/concepts/brundlefly-mascot.png](../../assets/archive/concepts/brundlefly-mascot.png) | 1235 × 1274 | Historical |
| [assets/archive/concepts/brundleware-mascot.png](../../assets/archive/concepts/brundleware-mascot.png) | 1235 × 1274 | Historical |
| [assets/archive/concepts/fleshware-brand-board.png](../../assets/archive/concepts/fleshware-brand-board.png) | 1536 × 1024 | Historical |
| [assets/archive/concepts/fleshware-mascot.png](../../assets/archive/concepts/fleshware-mascot.png) | 1312 × 1199 | Historical |
| [assets/archive/concepts/spiralware-brand-board.png](../../assets/archive/concepts/spiralware-brand-board.png) | 1536 × 1024 | Historical |
| [assets/archive/concepts/spiralware-mascot.png](../../assets/archive/concepts/spiralware-mascot.png) | 1230 × 1278 | Historical |
| [assets/archive/splashes/01-crouched.png](../../assets/archive/splashes/01-crouched.png) | 1536 × 1024 | Historical |
| [assets/archive/splashes/02-mid-mutation.png](../../assets/archive/splashes/02-mid-mutation.png) | 1536 × 1024 | Historical |
| [assets/archive/splashes/03-wing-spread.png](../../assets/archive/splashes/03-wing-spread.png) | 1536 × 1024 | Historical |
| [assets/archive/splashes/04-six-limb-character.png](../../assets/archive/splashes/04-six-limb-character.png) | 1199 × 1312 | Historical |
| [assets/brand/character-sheet.png](../../assets/brand/character-sheet.png) | 1536 × 1024 | Current |
| [assets/brand/character.png](../../assets/brand/character.png) | 1199 × 1312 | Current |
| [assets/brand/github-avatar.png](../../assets/brand/github-avatar.png) | 500 × 500 | Current |
| [assets/brand/github-banner-overhang-gross.png](../../assets/brand/github-banner-overhang-gross.png) | 1280 × 640 | Current |
| [assets/brand/github-banner-overhang.png](../../assets/brand/github-banner-overhang.png) | 1280 × 640 | Current |
| [assets/brand/github-banner.png](../../assets/brand/github-banner.png) | 1280 × 640 | Current |
| [assets/brand/github-social-preview.jpg](../../assets/brand/github-social-preview.jpg) | Reference file | Current |
| [assets/brand/kit/aperture.png](../../assets/brand/kit/aperture.png) | 1254 × 1254 | Current |
| [assets/brand/kit/instrument-surround.png](../../assets/brand/kit/instrument-surround.png) | 1536 × 1024 | Current |
| [assets/brand/kit/material-board.png](../../assets/brand/kit/material-board.png) | 1536 × 1024 | Current |
| [assets/manifest.json](../../assets/manifest.json) | Reference file | Current |
| [assets/previews/avatar-32.png](../../assets/previews/avatar-32.png) | 32 × 32 | Current |
| [assets/previews/avatar-48.png](../../assets/previews/avatar-48.png) | 48 × 48 | Current |
| [assets/previews/avatar-96.png](../../assets/previews/avatar-96.png) | 96 × 96 | Current |
| [assets/prompts/avatar-refinement.txt](../../assets/prompts/avatar-refinement.txt) | Reference file | Prompt |
| [assets/prompts/banner-arm-fix.txt](../../assets/prompts/banner-arm-fix.txt) | Reference file | Prompt |
| [assets/prompts/banner-overhang-gross.txt](../../assets/prompts/banner-overhang-gross.txt) | Reference file | Prompt |
| [assets/prompts/banner-overhang.txt](../../assets/prompts/banner-overhang.txt) | Reference file | Prompt |
| [assets/prompts/brand-kit.json](../../assets/prompts/brand-kit.json) | Reference file | Prompt |
| [assets/prompts/character.txt](../../assets/prompts/character.txt) | Reference file | Prompt |
| [assets/prompts/generation-prompts.json](../../assets/prompts/generation-prompts.json) | Reference file | Prompt |
| [assets/prompts/initial-concepts.json](../../assets/prompts/initial-concepts.json) | Reference file | Prompt |
| [assets/prompts/splashes.json](../../assets/prompts/splashes.json) | Reference file | Prompt |
| [assets/source/avatar-master.png](../../assets/source/avatar-master.png) | 1254 × 1254 | Master |
| [assets/source/banner-master.png](../../assets/source/banner-master.png) | 1774 × 887 | Master |
| [assets/source/banner-overhang-gross-master.png](../../assets/source/banner-overhang-gross-master.png) | 1774 × 887 | Master |
| [assets/source/banner-overhang-master.png](../../assets/source/banner-overhang-master.png) | 1774 × 887 | Master |

## Organic integration

![Visceral direction](../../assets/brand/kit/lair/visceral-direction.png)

The banner and diffuse texture seeded this exploration before the organic mesh revision.
[Exact prompts](../../assets/prompts/visceral-kit.json) record both built-in imagegen assets.
The surface seam remains a separate transparent file. The concept supplies direction rather than UI pixels.
Flesh surfaces use the seam when they have decorative edges.
The edge mask keeps it away from text, fields, and focus outlines.
Typing briefly contracts the chamber and seam. Field focus holds light pressure.
Button presses apply a stronger response. No native form events are intercepted.
Motion off and reduced motion stop these ambient reactions.
The new GLBs include uneven fold geometry, connective tendons, membranes, and textures.
Earlier rest snapshots remain available as historical construction references.
