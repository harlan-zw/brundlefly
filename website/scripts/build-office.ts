import { spawnSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { officePlan } from '../layers/brand/shared/office-layout.ts'
import { markRegion } from '../layers/brand/shared/office-marks.ts'
import type { MarkName } from '../layers/brand/shared/office-marks.ts'

// Rebuilds the office model: `pnpm office:build`. The floor plan and the mark regions go to Blender as data.
// Blender then models every prop, bakes the light, and writes the model and the light map.
const folder = new URL('../../assets/3d/office/', import.meta.url)
const marks: readonly MarkName[] = ['whiteboard', 'clock', 'sign', 'label', 'keys']
const plan = { ...officePlan, marks: Object.fromEntries(marks.map(name => [name, markRegion(name)])) }
const planFile = fileURLToPath(new URL('plan.json', folder))
await writeFile(planFile, `${JSON.stringify(plan, null, 2)}\n`)

// Blender is a Flatpak. It resets the working directory, so every path is absolute.
const path = (name: string) => fileURLToPath(new URL(name, folder))
const art = fileURLToPath(new URL('../../assets/brand/office/', import.meta.url))
const result = spawnSync('flatpak', ['run', 'org.blender.Blender', '-b', '--factory-startup', '--python', path('build_office_props.py'), '--',
  planFile, path('atlas.json'), path('office.glb'), `${art}office-light.png`, ...process.argv.slice(2)], { stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
