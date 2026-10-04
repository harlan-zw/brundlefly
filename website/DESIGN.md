---
name: Brundlefly
description: Grotesque pixel artwork in a readable dark biological interface.
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

## Aesthetic direction

The devtool theme supplies clear controls and mono annotations.
Brundlefly’s canonical banner and archived brand board supply the visual identity.
We prioritize grotesque brand texture over clean ornament, while keeping task controls readable.
Use the corrected banner’s four arms, slime, and transparent overhang intact.
The canonical anatomy and palette supersede the archived concept’s orange eyes and slogans.

## Color decisions

Use the fixed brand palette above.
Cream carries headings and action buttons. Rust carries hover surfaces.
Wing membrane carries secondary text. Chitin defines panel boundaries.
Olive texture stays at outer edges. Sparse teal indicates active controls.
The interface stays dark in either operating system color scheme.

## Contrast and accessibility

Use cream or wing membrane for body text on the dark background.
Do not place body text in olive, teal, or bruise colors.
Keep mobile controls at least 44 pixels tall and body text at least 16 pixels.
Use visible cream focus outlines. All controls work with a keyboard.

## Typography

Barlow Condensed supplies large functional headings, never a replacement raster wordmark.
IBM Plex Sans supplies readable descriptions.
IBM Plex Mono supplies controls, skill names, and generated Markdown.
Use fluid display type and fixed body type.

## Icons

No ornamental icon collection is required.
Use text actions. Arrow characters indicate navigation only.

## Component rules

Nuxt UI owns buttons, inputs, and page containers.
Keep panels square, with fine chitin boundaries and corner cuts.
Use irregular olive edge textures as registered brand ornament.
The wet hover sheen and slime drips are registered brand effects.
Do not layer slime over text, inputs, or focus outlines.

## Spatial and motion

Use a wide banner followed by an asymmetric heading and three skill choices.
The demo spans the page in two columns, input and result.
Use slow ambient membrane movement and short wet hover transitions.
The motion control and reduced-motion preference stop all ambient effects.

## Responsive strategy

Use one column below 768 pixels. Inputs and results remain in reading order.
Allow navigation to wrap. Keep every destination visible without a menu.
At 375 pixels, wrap code and maintain 44 pixel controls.

## Voice

COPY.md owns every user-facing string.

## Avoid

Do not add invented slogans, personas, fake usage metrics, or model result simulations.
Do not regenerate the wordmark or modify canonical anatomy.
Do not add blood spray, exposed organs, or background effects over controls.

## Custom utilities

main.css owns the membrane, wet-sheen, and slime brand effects.
All effects use the brand palette. Panels use semantic Nuxt UI tokens.
