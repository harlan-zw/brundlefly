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

## Principle

Start with the user's task. Make input, action, and result the strongest visual elements.
The brand kit supplies materials. It does not override task clarity.

## Layout

Use a task rail beside a quiet workspace. Task choices name outcomes and exact skill names.
The canonical banner anchors the header. Organic artwork stays below navigation, outside the work surface.
Forms begin empty. A deliberate example action supplies sample data.
Retain each task's work when selection changes. Show output only after a successful run.
At wide widths, input and output share the surface. On smaller screens, output follows input.
Focus the result heading after success. Focus the error after invalid submission.
Provide a copy action beside generated content, and complete skill downloads below the form.

## Materials

Use cream for text and primary actions, wing for secondary text, and chitin for boundaries.
Flesh marks the selected task and the work surface edge. Bruise highlights wording signals.
Use the existing banner and generated material assets. Never recreate the raster wordmark.
Use BrandSurface, BrandChoice, and BrandAction from the shared layer.
The full surround remains a reference artifact. BrandLair supplies receding geometry behind the page.
Small clasps mark choices. Beads mark motion and actions. Sutures mark boundaries.
Preserve canonical anatomy and the original alpha. Use pixelated rendering without stretching artwork.

## Typography

Barlow Condensed carries the selected task heading. IBM Plex Sans carries editable text and task choices.
IBM Plex Mono carries labels and generated Markdown. Inputs use 16px text.
Controls use 14px text. Secondary skill identifiers may use 12px text.

## Accessibility and motion

Keep targets at least 44px high. Use visible cream focus outlines and native labels.
No artwork crosses text, inputs, or focus outlines. The interface stays dark under either system preference.
The wet action hover and chamber share the motion control. Reduced motion stops idle animation and camera parallax.
At 375px, task choices precede the selected task. Keep inputs and results in reading order.

## Voice

COPY.md owns every website string. Root GLOSSARY.md owns product names.

## Authority

[Brand kit](../docs/brand/kit.md) lists artwork, provenance, palette, and layout decisions.
This task-first revision supersedes the artwork-led instrument layout.

## Shared layer

The layer owns tokens, material pieces, safe zones, and 3D rendering.
The kit app demonstrates composition without owning task logic.
The tool app owns real local demos and reuses the same pieces.
Use container queries for compositions. Keep artwork within the 20px edge zone.
Do not cover content or focus outlines with material art.

## Lair

The chamber has no entry gate. The task is available immediately.
Layered ribs and hinged chitin establish depth around the page.
The canvas sits behind content and never intercepts pointer events.
Keep readable surfaces quiet. Dim ambient materials before dimming text.
The Motion lab isolates transform controls from the atmosphere.
