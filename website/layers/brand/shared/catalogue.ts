export const palette = [
  { name: 'Night', hex: '#080B08', role: 'Background' },
  { name: 'Cream', hex: '#E8D4A6', role: 'Text and focus' },
  { name: 'Flesh', hex: '#AA604B', role: 'Organic edges' },
  { name: 'Bruise', hex: '#69404B', role: 'Review highlights' },
  { name: 'Chitin', hex: '#343C3B', role: 'Structure' },
  { name: 'Eye', hex: '#418B90', role: 'Active glints' },
  { name: 'Membrane', hex: '#A4B5A0', role: 'Secondary text' },
  { name: 'Olive', hex: '#777648', role: 'Slime' },
] as const
export const materials = ['flesh', 'chitin', 'membrane'] as const
export const edges = ['none', 'corners', 'wing', 'both'] as const
export const layouts = ['workbench', 'split', 'stack'] as const
export type Material = typeof materials[number]
export type Edges = typeof edges[number]
export type Layout = typeof layouts[number]
export type Preset = { version: 1, material: Material, edges: Edges, layout: Layout, density: number }
export const defaultPreset: Preset = { version: 1, material: 'flesh', edges: 'corners', layout: 'workbench', density: 0.55 }
export const compositions: { name: string, preset: Preset }[] = [
  { name: 'Workbench', preset: defaultPreset },
  { name: 'Split', preset: { version: 1, material: 'chitin', edges: 'both', layout: 'split', density: 0.8 } },
  { name: 'Stack', preset: { version: 1, material: 'membrane', edges: 'wing', layout: 'stack', density: 0.35 } },
]
export const parts = [
  { name: 'Membrane suture (surface)', file: '/brand/kit/lair/tissue-seam.png', component: 'BrandSurface', role: 'Continuous flesh and membrane edge. Keep it outside editable content.' },
  { name: 'Chitin clasp', file: '/brand/kit/lair/clasp.png', component: 'BrandChoice', role: 'Small selection marker. Keep it beside the label.' },
  { name: 'Mucus bead', file: '/brand/kit/lair/bead.png', component: 'BrandAction', role: 'Wet status and action detail. Keep its original alpha.' },
  { name: 'Membrane suture', file: '/brand/kit/lair/suture.png', component: 'BrandDivider', role: 'Thin boundary beneath navigation. Never cover text.' },
  { name: 'Flesh corner', file: '/brand/kit/modular/flesh-corner.png', component: 'BrandSurface', role: 'Corner cap. Rotate, do not stretch. Keep outside the content-safe zone.' },
  { name: 'Membrane divider', file: '/brand/kit/modular/membrane-divider.png', component: 'BrandDivider', role: 'Separate sections. Preserve aspect ratio. Never place text over the membrane.' },
  { name: 'Tendon connector', file: '/brand/kit/modular/tendon-connector.png', component: 'BrandDivider', role: 'Connect related surfaces. Keep both anchors visible.' },
  { name: 'Flesh diffuse', file: '/brand/kit/modular/flesh-diffuse.png', component: 'BrandOrganism', role: 'Color texture. Mirror repeat prevents color seams. Procedural normals supply depth.' },
  { name: 'Aperture', file: '/brand/kit/aperture.png', component: 'BrandOrganism', role: 'Static fallback and 3D model reference. This is material, not a new mascot.' },
] as const
export type PresetResult = { _tag: 'Ok', preset: Preset } | { _tag: 'Err', message: string }
export function parsePreset(raw: string): PresetResult {
  const invalid: PresetResult = { _tag: 'Err', message: 'Use a preset exported from this kit. Check its material, edges, layout, and density.' }
  if (raw.length > 4096) return invalid
  let value: unknown
  try { value = JSON.parse(raw) }
  catch (error) {
    if (error instanceof SyntaxError) return invalid
    throw error
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid
  const data = value as Record<string, unknown>
  if (data.version !== 1 || !materials.includes(data.material as Material)
    || !edges.includes(data.edges as Edges) || !layouts.includes(data.layout as Layout)
    || typeof data.density !== 'number' || !Number.isFinite(data.density) || data.density < 0 || data.density > 1) return invalid
  return { _tag: 'Ok', preset: { version: 1, material: data.material as Material, edges: data.edges as Edges, layout: data.layout as Layout, density: data.density } }
}
export function vueForPreset(preset: Preset): string {
  return `<script setup lang="ts">\nimport { ref } from 'vue'\nconst text = ref('')\nconst result = ref('')\nconst motionOff = ref(false)\n</script>\n\n<template>\n  <BrandLair :motion-off="motionOff">\n    <UButton variant="ghost" @click="motionOff = !motionOff">{{ motionOff ? 'Motion off' : 'Motion on' }}</UButton>\n  <BrandComposition layout="${preset.layout}">\n    <BrandSurface material="${preset.material}" edges="${preset.edges}" :density="${preset.density}">\n      <form class="brand-example" @submit.prevent="result = text">\n        <label for="your-text">Your text</label>\n        <UTextarea id="your-text" v-model="text" :rows="5" />\n        <BrandAction type="submit" material="${preset.material}">Preview result</BrandAction>\n      </form>\n    </BrandSurface>\n    <BrandSurface material="chitin">\n      <h2>Input preview</h2>\n      <p>{{ result || 'Enter text to preview a result.' }}</p>\n    </BrandSurface>\n  </BrandComposition>\n  </BrandLair>\n</template>`
}
