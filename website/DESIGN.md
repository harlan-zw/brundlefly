---
name: Brundlefly
description: Organic 3D chamber with the canonical walking mascot and local conversation.
colors:
  primary: "#E8D4A6"
  neutral: "#080B08"
  flesh: "#AA604B"
  bruise: "#69404B"
  chitin: "#343C3B"
  eye: "#418B90"
  wing: "#A4B5A0"
  olive: "#777648"
typography:
  display:
    fontFamily: Barlow Condensed
    fontSize: 4rem
    fontWeight: 700
    lineHeight: "1.0"
  body:
    fontFamily: IBM Plex Sans
    fontSize: 1rem
    lineHeight: "1.6"
  mono:
    fontFamily: IBM Plex Mono
    fontSize: 1rem
rounded:
  sm: 0px
  md: 0px
  lg: 0px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.wing}"
  card-default:
    backgroundColor: "{colors.neutral}"
    rounded: "{rounded.lg}"
    padding: 24px
---

# Design

## Principle

The world and Brundlefly carry the homepage. Conversation appears only when the visitor chooses the mascot.
The separate brand kit demonstrates reusable parts and their controls.

## Homepage

Fill the viewport with one continuous 3D chamber. Show no navigation, banner, tool pocket, or transform controls.
Frame the complete rear tunnel with room around its rim. Place Brundlefly inside the chamber, ahead of the tunnel.
Keep the walkable foreground clear. Show the ground, walls, and ceiling as connected biological surfaces.
Brundlefly walks slowly across the ground and pauses. Keep his four arms, two legs, and unequal wings readable.
Use the canonical character pixels on the 23-joint volumetric relief. Preserve its silhouette during walking.
Keep the scene within the viewport at desktop and mobile sizes. Do not add page scrolling for decorative geometry.

## Conversation

Clicking Brundlefly opens a native dialog. The dialog pauses walking and sits over the scene.
Use canonical local replies about the collection, skills, installation, and brand kit.
State that replies are local. User text stays in the browser.
Keep the dialog compact and readable. Separate visitor text and replies in reading order.
Use native text input, submit, close, and Escape behavior. Return focus to the mascot after closing.
The dialog does not run skills or simulate remote agent execution.

## Materials

Use rust flesh, bruised folds, dark chitin, olive slime, and sparse teal reflections.
Uneven ribs, connected tendons, membranes, puddles, and bristles establish a complete lair.
Warm light reveals the mascot and folds. Sparse cold light separates the chamber depth.
Use a feathered warm key over the walking area, soft front fill, and a restrained teal rim.
Keep highlights below white clipping. The walls support the mascot rather than competing with his face.
Use the supplied artwork and textures. Never recreate the raster wordmark or invent mascot anatomy.
Cream carries dialog text and focus. Wing carries secondary text. Chitin supports quiet boundaries.
Keep all generated seams outside editable dialog content.

## Typography

IBM Plex Sans carries editable text and conversation. Inputs use 16px text.
Barlow Condensed carries functional dialog headings. IBM Plex Mono carries kit labels and generated code.
Kit controls use 14px text and at least 44px targets.

## Accessibility and motion

The mascot has a named keyboard target. Enter or Space opens the same dialog as a pointer click.
Hover slows walking and changes the cursor. Pointer position does not rotate the relief or distort his face.
Keep visible cream focus outlines. Do not place artwork over text, inputs, or focus outlines.
System reduced motion stops walking, idle deformation, and camera movement.
Pause scene animation while the dialog is open or the document is hidden.
If WebGL fails, provide the canonical static mascot with the same conversation action.
Keep the dialog within a 375px viewport. Conversation content may scroll inside the dialog.

## Voice

COPY.md owns every website string. Root GLOSSARY.md owns product names.

## Authority

[Brand kit](../docs/brand/kit.md) lists artwork, provenance, palette, and scene construction.
The world-only homepage replaces the earlier tool-pocket composition.

## Shared layer

The layer owns tokens, material pieces, safe zones, and reusable 3D model sources.
The separate /brand-kit/ app demonstrates composition, presets, materials, parts, and motion.
Use container queries for kit compositions. Keep artwork within the 20px edge zone.
BrandSurface, BrandChoice, BrandAction, and BrandDivider remain reusable kit pieces.
The homepage consumes shared/world.ts and shared/mascot.ts through its local world renderer.
The speech dialog uses the local conversation provider. It keeps task logic outside the shared visual layer.

## Scene construction

The world combines receding tunnel ribs, asymmetric tissue flanks, overhead arches, and a chitin floor.
An inward-facing textured enclosure closes the ceiling, rear wall, and edges behind the chamber.
Both camera framings remain inside it. Keep its bruised surface visible without competing with the mascot.
Place the tunnel behind Brundlefly. Leave space for his walk and contact shadow in the foreground.
Slime, thin membranes, and bristles stay near the chamber perimeter.
Mucus uses a flowing membrane texture, displaced ripples, and wet highlights that move with its surface.
Eight translucent egg sacs breathe at the floor edges. Preserve the central walking corridor.
Use dedicated generated textures for chitin, compressed floor tissue, and egg membranes.
Hanging mucus beads grow, stretch, detach, and fall through staggered cycles.
Use modest mesh resolution, instanced perimeter plates, and soft ground shading.
The mascot GLB carries skin weights, skeleton, canonical texture, and idle and walk clips.
Runtime GLSL remains in the layer source. The relief does not supply a full sculpted back or side.

## Hidden controls

Keep scene controls hidden by default. L toggles the panel when the visitor is not typing.
The controls=1 query opens it on touch devices. Use labeled native sliders with live outputs.
Lighting, fog, zoom, wetness, opening, breath, flow, and walk speed update the scene immediately.
Reset restores the shared defaults. Copy settings exports JSON and provides selectable text if clipboard access fails.
Motion off freezes the scene. Keep the panel within the viewport and let its contents scroll.
