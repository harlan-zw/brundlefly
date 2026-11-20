#!/usr/bin/env node
// Stand in for the unavailable Flatpak and uv processes at the CLI boundary.
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const value = (flag: string) => args[args.indexOf(flag) + 1]
if (args.includes('org.blender.Blender')) {
  const stl = value('--stl')
  let valid = false
  try {
    valid = readFileSync(stl, 'utf8').startsWith('solid fixture')
  }
  catch {
    // Model Blender's Python import failure, including its default zero exit.
  }
  if (!valid) {
    console.error('STL import failed')
    const exitFlag = args.indexOf('--python-exit-code')
    process.exit(exitFlag >= 0 && exitFlag < args.indexOf('--python') ? Number(args[exitFlag + 1]) : 0)
  }
  // Exercise fresh-output handling independently of Blender's exit status.
  if (process.env.FIXTURE_SKIP_MESH === '1')
    process.exit(0)
  const failed = stl.endsWith(process.env.FIXTURE_FAILED_FILE || '\0')
  const check = process.env.FIXTURE_FAILED_CHECK || 'height_ok'
  const report = {
    file: stl,
    height_ok: true,
    non_manifold_edges: 0,
    boundary_edges: 0,
    degenerate_faces: 0,
    loose_vertices: 0,
    shells: 1,
    volume_cm3: 2,
    self_intersecting_face_pairs: 0,
    passes_mesh_checks: !failed,
    expected_height_mm: Number(value('--expect-height')),
  }
  if (failed)
    Object.assign(report, { [check]: check === 'height_ok' ? false : check === 'volume_cm3' ? 0 : 2 })
  writeFileSync(value('--out'), JSON.stringify(report))
}
else if (args.includes('com.prusa3d.PrusaSlicer')) {
  writeFileSync(value('--output'), '; filament used [cm3] = 2\n; estimated printing time (normal mode) = 1h\n')
}
else {
  writeFileSync(args.at(-1)!, JSON.stringify({ file: args.at(-2), minimum_mm: 2 }))
}
