# Brundlefly figurine: printing instructions

This folder holds a 3D model of Brundlefly for printing and for the website, and the scripts that build it.
The shape and the colours come from four views: the front and back views of `assets/brand/character-sheet.png`, and two side views drawn in the same style.

![Front view](previews/front.png)

## How the model is made

1. `source/views/front.png` and `source/views/back.png` are the front and back views, cut from the character sheet. `source/views/side-right.png` and `source/views/side-left.png` are side views that an image model drew from the sheet. The sheet has no side view.
2. An image-to-3D model reads the four views and returns a base mesh: `source/hunyuan3d-multiview-shape.glb`.
3. `build_from_mesh.py` turns the base mesh into the print model and the website model in Blender:
   - It removes the bristle spikes. It keeps the thin wings and mouthparts. A wing membrane takes its original surface back as a whole.
   - For printing, it grows parts that are thinner than 1.6 mm, by up to 0.5 mm on each side, and it adds the base.
   - It projects the four views onto the vertex colours. Each surface takes its colour from the views that it faces. The head gets its own image fit, so the face lines up. The wings and the shoulders keep the body fit.
   - It cuts the smaller wing back to its outline in the sheet's front view. The generator makes that wing wider than the sheet draws it.
   - It gives each eye a bulging eyeball in a socket, at the sizes of the site's relief rig: the eye on screen left is about 1.4 times as wide as the other. The centre of each globe sits 0.3 of its depth radius behind the skin, so most of the globe stands proud. On the print model two open lids are part of the solid: half shells that hug the globe above and below. On the website model the lids are separate shells that the export adds.
4. `export_model.py` writes the files. For the website model it bakes the four views into a texture, and it adds the skeleton from `source/rig-joints.json`, the skin weights, and an idle clip. It then poses the figure into the stance of `source/stance.json` and makes that pose the rest shape.
5. `validate.ts` checks the print files.

`assets/prompts/figurine.json` records the generator, the date, and the settings.
Read the licence note in that file before you sell prints of this mesh.

## Files

| File | Use |
| --- | --- |
| `brundlefly-80mm.stl` | Print file, 80 mm tall. Send this file first. |
| `brundlefly-100mm.stl` | The same model at 100 mm. Every thin part is 25 percent thicker. |
| `brundlefly.blend` | Editable master. One Blender unit is one millimetre. |
| `brundlefly-preview.glb` | Coloured preview of the print model, with the base. |
| `brundlefly-web.glb` | Model for the website: rigged, in the stance of the character artwork, no base, thin bristle hairs, thin parts not thickened. |
| `source/` | The generated base mesh, the four view images, the joint positions for the skeleton, and the stance of the website model. |
| `validation-report.json` | Output of `validate.ts` for the two STL files. |
| `previews/` | Front, side, back, three-quarter, and top renders of the print model, two of the website model, and one pose test of the rig. |

## Dimensions

All values are millimetres. They come from `validation-report.json`.

| File | Width (X) | Depth (Y) | Height (Z) | Volume | Triangles |
| --- | --- | --- | --- | --- | --- |
| `brundlefly-80mm.stl` | 67.40 | 46.40 | 80.00 | 25.08 cm³ | 200,000 |
| `brundlefly-100mm.stl` | 84.25 | 58.00 | 100.00 | 48.98 cm³ | 200,000 |

Height runs from the underside of the base to the tip of the larger wing.
The base is about 3 mm thick at 80 mm. The underside is flat.

## Material

- First choice: tough resin or MJF nylon, if the supplier offers it. Both hold fine claws and folds far better than FDM.
- FDM choice: flexible TPU, Shore 95A. Thin claws and wing edges bend in TPU. They snap in rigid FDM plastic.
- A squeezable feel is not a goal. The model is one solid shell.
- Colour: one colour. Rust or black fit the palette in `docs/arch/brand.md`.

## Print orientation and supports

- Print upright, with the flat base on the bed.
- This pose needs supports. With a 45 degree threshold, the slicer used 19.9 cm³ of support for 14.1 cm³ of model.
- `validation-report.json` lists the points where material starts in mid-air (`mid_air_islands_mm`): 37 at 80 mm.
- The largest groups are the fingers and claws of the two long-arm hands, the two small-arm hands, and the hanging mouthparts.
- The head, the belly, and the wings overhang by more than 45 degrees. The slicer supports them.
- Use tree or organic supports. They touch less surface than grid supports.

## Slicer settings

Sliced values come from PrusaSlicer 2.9.7 with a generic 0.4 mm FDM profile. They are in `validation-report.json`.

| Setting | Value | Source |
| --- | --- | --- |
| Layer height | 0.2 mm | Sliced |
| Nozzle | 0.4 mm | Sliced |
| Walls | 3 | Sliced |
| Infill | 15 percent gyroid | Sliced |
| Filament without supports | 14.1 cm³, 2 h 13 min | Sliced |
| Filament with supports at 45 degrees | 34.0 cm³, 4 h 24 min | Sliced |
| Support filament | 19.9 cm³ | Sliced, by difference |
| Layer height for more detail | 0.12 to 0.16 mm | Estimate |
| TPU nozzle temperature | 220 to 235 °C | Estimate |
| TPU print speed | 20 to 30 mm/s | Estimate |
| Support Z gap for TPU | 0.20 to 0.25 mm | Estimate |
| Brim | 3 to 5 mm | Estimate |

No TPU printer profile was tested. A real print has not been made.

## Thin parts

The print model keeps the proportions of the artwork, so some parts are thin.

- The two wings are about 1.6 mm thick at 80 mm.
- Fingers, claws, small arms, and mouthparts are 1.6 mm or more.
- The voxel check reports 25 mm³ under 1.5 mm in the whole model. Each spot is 2.7 mm³ or smaller. They are wing edges, claw tips, and stubs left by removed bristles.
- The check uses 0.25 mm voxels. Read each limit with a tolerance of 0.25 mm.

For a stronger print, use `brundlefly-100mm.stl`: the wings and the fingers are about 2.0 mm.
To thicken further, rebuild with `--min-radius 1.0 --max-growth 0.7`. The figure then looks heavier.

## Likely failure points

- The wings. They are thin and they overhang.
- Fingers, claws, and the small arms. Supports attach near them.
- The hanging mouthparts. They are thin and they start in mid-air.
- Support scars under the hands, the chin, and the belly. TPU supports are hard to remove cleanly.
- Stringing between the fingers and between the arms and the body.

## Checks that ran

`node validate.ts` ran these checks on both STL files after a new import:

- Non-manifold edges, boundary edges, degenerate faces, loose vertices: zero.
- Shells: one. Volume: positive. Self-intersecting face pairs: zero.
- Height: 80.00 mm and 100.00 mm.
- Blender 3D Print Toolbox, check all: zero non-manifold edges, zero intersecting faces, one shell.
- The toolbox also reports 8,728 thin faces and 21,305 overhang faces at 80 mm. The overhang count agrees with the need for supports.
- Mid-air start points: 37 at 80 mm.
- Voxel thickness check at 0.25 mm pitch.
- Stability: the centre of mass is 16.0 mm inside the footprint edge. The solid model tips at about 24 degrees.
- PrusaSlicer slice with supports and without supports.

## Checks the printer must confirm

These checks did not run:

- A print on a real machine, in any material.
- The printer's own minimum wall and minimum feature limits, above all for the wings.
- Support removal without damage to the fingers, wings, and mouthparts.
- Stability of the printed figure on its base.
- Material, hardness, and colour in stock.

Automated mesh checks are not a print-service approval.

## Bristles

The generated mesh has bristles as thin spikes. The print model removes them, because they are thinner than a nozzle.
The website model replaces each spike with a thin hair, as the sheet draws them. The print model has no holes for bristles.

To add a real fibre after printing:

1. Push a pin or a hot needle 2 to 3 mm into the surface.
2. Cut a stiff fibre 6 to 10 mm long. Brush bristle or 0.3 mm nylon line are good choices.
3. Dip the end in flexible cyanoacrylate glue and push it into the hole.
4. Let the glue cure before you handle the figure.

These steps are untested on a printed part.

## Differences from the brand artwork

- The figure stands on an integrated base. A printed figure on two thin legs does not stand without one.
- One material prints no colour. The print shows shape only.
- The sheet has no side view. An image model drew the two side views, so the side shape follows that drawing and not canonical artwork.
- The side views were drawn as mirror images of true side views: in each one the figure faces the wrong way for the side that it shows. The outline is the same either way, and the colours are placed with this in mind.
- The print model has no bristles, and its thin parts are a little thicker than in the artwork.
- The generated side views paint an eye socket on each side of the head, behind the eyeball. The sheet has no such socket.

## Website model

`brundlefly-web.glb` follows the contract that the site loader expects.

- glTF 2.0 binary, metres, Y up. The soles are at height zero.
- The rest shape is the stance of `assets/brand/character.png`, which is also the stance of the site's relief rig. `source/stance.json` holds the stance, and `export_model.py` bakes it in. The print model keeps the straight stand.
- In this stance the figure is 77.5 mm tall for the 80 mm build. With the root turn it spans -29.9 to 29.9 mm across the view and -26.3 to 30.7 mm in depth.
- Through the relief rig's walk cycle the long hands stay at least 2.6 mm from the legs, and the small hands at least 1.1 mm.
- One root node, `Brundlefly`, with a scale of 0.001 and a turn of 0.5 radians about the vertical, toward screen right. That turn is the three-quarter view of the artwork. The site changes it to turn the figure toward his path.
- Inside the root, the body faces +Z. The head faces the same way, with a roll. The site turns the head to the viewer.
- `Brundlefly-body`: about 66,000 triangles. That count includes about 80 bristle hairs of three triangles each and four eyelid shells of about 500 triangles each; a hair takes the skin weights of the vertex under it. Texture coordinates in `TEXCOORD_0`, material `Brundlefly-skin`, single sided, roughness 0.42. It has no `COLOR_0`.
- The base colour is one embedded JPEG texture, 1536 pixels square. It holds the four views at the resolution of the artwork.
- `Brundlefly-eye-0` and `Brundlefly-eye-1`: eyeball nodes, material `Brundlefly-eye`. Eye 0 is on screen left and is the larger eye. Each bulges from a socket in the body mesh, over a dark eyeball that is part of that mesh.
  - Each node is a unit sphere centred on its origin. Its scale holds the three radii of the globe: about 2.43 x 2.32 x 1.91 mm and 1.69 x 1.38 x 1.41 mm, across, up, and in depth. Its front is +Z, the way the head faces. Its rest rotation carries the head's roll.
  - The colour is in `COLOR_0`: a dark globe, a dark teal iris that grows lighter toward its edge, and a dark pupil. The material's base colour factor is white. A site that draws the eyes with its own shader does not need either.
- `anchor-face`: an empty node at the front of the face.
- No base and no compression extension. The site build stops if the file is larger than 4 MiB. The file is 4.03 MB, which leaves about 160 KB.

Skeleton:

- One skin, 37 joints, at most four influences for each vertex. The weights come from Blender's automatic heat weighting.
- Every joint has an identity rest rotation, in the axes of the root: +X is the figure's left side, +Y is up, +Z is the way the body faces.
- Left and right are screen left and screen right. So `left-shoulder` is the figure's right shoulder.
- Body, 25 joints: `pelvis` > `chest` > `head`. From `chest`: `left-shoulder` > `left-elbow` > `left-hand`, `left-rib` > `left-small-elbow` > `left-small-hand`, `left-wing` > `left-wing-tip`, and the same on the right. From `pelvis`: `left-hip` > `left-knee` > `left-foot`, and the same on the right.
- Face tentacles, 8 joints under `head`: `mouthpart-0` to `mouthpart-3`, from screen left to screen right, each with a `-tip` joint.
- Eyelids, 4 joints under `head`: `face-upper-lid-0`, `face-lower-lid-0`, `face-upper-lid-1`, `face-lower-lid-1`, the names of the relief rig. Index 0 is the eye on screen left. Each joint sits at the centre of its eyeball. Each lid is half of a shell around the globe, inside `Brundlefly-body`, and every vertex of a lid follows its lid joint only. The shell is round about the X axis of the joint, so it turns about that axis and stays clear of the globe. Its skin is a strip of the sheet's front view, from just above or just below the painted eye.
- The rest shape is the open eye: each lid edge is 0.96 radians from the line of sight. To shut an eye, turn the upper lid joint by +0.96 radians about X and the lower lid joint by -0.96 radians about X. The two edges then meet. These are the angles of the relief rig.
- The eyeball nodes and `anchor-face` are children of the `head` joint. The skin around each eyeball has `head` as its only joint, so the skin does not slide past the eyeball in a pose.
- One clip, `Brundlefly-idle`, 4 seconds, made to loop: breathing, a small head turn, twitching small arms, swaying tentacles, fluttering wings.
- The fingers, the toes, and the jaw have no joints.

`previews/web-pose-test.png` shows a strong test pose through this rig, from the straight stand. `previews/web-front.png` and `previews/web-three-quarter.png` show the rest shape with the root turn, and with the head turned to the viewer as the site does.

## Rebuild

Blender 5.3 as a Flatpak, PrusaSlicer as a Flatpak, Node 24, and `uv` are necessary. Use absolute paths.
The Flatpak apps reach the home folder only. Put `OUT` under your home folder.

```bash
D=/abs/path/to/assets/3d/brundlefly
OUT=$HOME/scratch/brundlefly-build
V=$D/source/views
VIEWS="--front-image $V/front.png --back-image $V/back.png --right-image $V/side-right.png --left-image $V/side-left.png"
flatpak run org.blender.Blender -b --factory-startup --python $D/build_from_mesh.py -- --source $D/source/hunyuan3d-multiview-shape.glb --out $OUT $VIEWS
flatpak run org.blender.Blender -b --factory-startup --python $D/export_model.py -- --blend $OUT/brundlefly-work.blend --out $D --tris 200000 --glb-tris 120000
flatpak run org.blender.Blender -b --factory-startup --python $D/render_previews.py -- --blend $D/brundlefly.blend --out $OUT/previews --modes colour --views front,three-quarter,side,back,top
node $D/validate.ts
```

The renders are named `<view>-colour.png`. Copy them to `previews/<view>.png`.

For the website model, add `--variant web` to the build and `--web --glb-tris 64000 --texture-size 1536` to the export. The export reads `source/rig-joints.json`. Those joint positions fit this base mesh only. Measure them again if the base mesh changes.

`build_model.py` holds the field library that `build_from_mesh.py` uses. It also holds a first, script-built figure, which is retired.

The scripts are Python where Blender, trimesh, or scipy make it necessary. The check runner is TypeScript.

## Quote request

> Subject: Quote request: 80 mm character figurine, delivery to Melbourne by 26 November
>
> Hi,
>
> I need a small character figurine printed and delivered to Melbourne by Thursday 26 November 2026.
>
> - Part: one-piece figurine with an integrated base. The STL is attached.
> - Size: 67 × 46 × 80 mm. Volume 25.1 cm³.
> - Quantity: 1. Please also price 3 units, and the 100 mm version (84 × 58 × 100 mm, 49.0 cm³).
> - The thinnest parts are the two wings, the fingers, and the claws, at about 1.6 mm. The hands and the head need supports.
>
> Could you tell me:
>
> 1. Which process and material you recommend for this level of detail: tough resin, MJF nylon, or flexible TPU.
> 2. Your minimum wall thickness and minimum feature size for that material.
> 3. If the wings and fingers need to be thicker for your process.
> 4. Which colours are available.
> 5. Your lead time, and the order cutoff for delivery by 26 November.
> 6. Shipping cost to Melbourne, or pickup options.
>
> Thanks,
> Harlan
