// Run every print check on the delivered STL files and write validation-report.json.
//
//   node validate.ts [--dir /abs/dir/with/stl] [--work /abs/scratch/dir]
//
// Checks: Blender mesh checks and 3D Print Toolbox on the reimported STL,
// a voxel thickness check, and two PrusaSlicer slices (with and without supports).
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

interface Args { dir: string, work: string }

function parseArgs(argv: string[]): Args {
  const value = (flag: string, fallback: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 && argv[i + 1] ? resolve(argv[i + 1]) : fallback
  }
  const dir = value('--dir', import.meta.dirname)
  return { dir, work: value('--work', join(tmpdir(), 'brundlefly-validate')) }
}

function run(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
}

function blenderChecks(stl: string, out: string, height: number): unknown {
  run('flatpak', ['run', 'org.blender.Blender', '-b', '--python', join(import.meta.dirname, 'validate_mesh.py'), '--', '--stl', stl, '--out', out, '--expect-height', String(height)])
  return JSON.parse(readFileSync(out, 'utf8'))
}

function thickness(stl: string, out: string): unknown {
  run('uv', ['run', '--no-project', '--with', 'trimesh', '--with', 'scipy', '--with', 'networkx', '--with', 'numpy', 'python', join(import.meta.dirname, 'check_thickness.py'), stl, out])
  return JSON.parse(readFileSync(out, 'utf8'))
}

interface Slice { filament_cm3: number, print_time: string }

function slice(stl: string, gcode: string, supports: boolean): Slice {
  const settings = ['--layer-height', '0.2', '--nozzle-diameter', '0.4', '--filament-diameter', '1.75', '--fill-density', '15%', '--fill-pattern', 'gyroid', '--perimeters', '3', '--temperature', '225']
  const support = supports ? ['--support-material', '--support-material-threshold', '45'] : []
  run('flatpak', ['run', 'com.prusa3d.PrusaSlicer', '--export-gcode', ...settings, ...support, '--output', gcode, stl])
  const text = readFileSync(gcode, 'utf8')
  const filament = /; filament used \[cm3\] = ([\d.]+)/.exec(text)
  const time = /; estimated printing time \(normal mode\) = (.+)/.exec(text)
  if (!filament || !time)
    throw new Error(`PrusaSlicer wrote no filament or time summary to ${gcode}`)
  return { filament_cm3: Number(filament[1]), print_time: time[1].trim() }
}

const args = parseArgs(process.argv.slice(2))
mkdirSync(args.work, { recursive: true })
const stl80 = join(args.dir, 'brundlefly-80mm.stl')
const stl100 = join(args.dir, 'brundlefly-100mm.stl')

const plain = slice(stl80, join(args.work, 'plain.gcode'), false)
const supported = slice(stl80, join(args.work, 'supported.gcode'), true)
const report = {
  note: 'Automated checks only. A print service has not approved this model. Slicer values are for a generic 0.4 mm FDM profile, not a tested TPU profile.',
  mesh_80mm: blenderChecks(stl80, join(args.work, 'mesh-80.json'), 80),
  mesh_100mm: blenderChecks(stl100, join(args.work, 'mesh-100.json'), 100),
  thickness_80mm: thickness(stl80, join(args.work, 'thickness-80.json')),
  slice_80mm: {
    profile: '0.2 mm layers, 0.4 mm nozzle, 3 walls, 15% gyroid infill',
    without_supports: plain,
    with_supports_45_degrees: supported,
    support_filament_cm3: Number((supported.filament_cm3 - plain.filament_cm3).toFixed(2)),
  },
}
writeFileSync(join(args.dir, 'validation-report.json'), `${JSON.stringify(report, null, 1)}\n`)
console.log(JSON.stringify(report, null, 1))
