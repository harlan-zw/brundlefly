import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

// Execute the public Bash recipes. Replace only the expensive external tools.
const guide = readFileSync(resolve(import.meta.dirname, '../PRINTING.md'), 'utf8')
function recipe(heading: string): string {
  return guide.slice(guide.indexOf(heading)).split('```bash\n')[1]!.split('```')[0]!
}

const tool = `#!${process.execPath}
const { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { basename, join } = require('node:path');
const args = process.argv.slice(2);
const value = flag => args[args.indexOf(flag) + 1];
const script = args.includes('--python') ? basename(value('--python')) : basename(args[0]);
appendFileSync(process.env.CALLS, script + '\\n');
if (script === process.env.FAIL_STAGE) {
  // Blender normally reports a Python exception while returning success.
  process.exit(args.includes('--python') ? (args.includes('--python-exit-code') ? Number(value('--python-exit-code')) : 0) : 1);
}
if (script === 'build_from_mesh.py') {
  mkdirSync(value('--out'), { recursive: true });
  writeFileSync(join(value('--out'), 'brundlefly-work.blend'), JSON.stringify({ variant: args.includes('--no-base') ? 'jar' : 'standard' }));
}
if (script === 'export_model.py') {
  if (!existsSync(value('--blend'))) process.exit(2);
  const model = readFileSync(value('--blend'), 'utf8');
  mkdirSync(value('--out'), { recursive: true });
  const name = args.includes('--name') ? value('--name') : 'brundlefly';
  writeFileSync(join(value('--out'), name + '-80mm.stl'), model);
  writeFileSync(join(value('--out'), name + '.blend'), model);
  appendFileSync(process.env.EXPORTED, join(value('--out'), name + '-80mm.stl') + '\\n');
}
if (script === 'validate.ts') {
  const dir = args.includes('--dir') ? value('--dir') : require('node:path').dirname(args[0]);
  const name = args.includes('--name') ? value('--name') : 'brundlefly';
  if (!existsSync(join(dir, name + '-80mm.stl'))) process.exit(2);
  writeFileSync(join(dir, name + '-validation-report.json'), 'validated');
}
`

function runRecipe(variant: 'standard' | 'jar', failStage = '') {
  const root = mkdtempSync(join(homedir(), 'scratch/brundlefly-rebuild-test-'))
  const home = join(root, 'home')
  const dir = join(root, 'model')
  const bin = join(root, 'bin')
  const oldWork = join(home, 'scratch/brundlefly-build')
  for (const path of [dir, bin, oldWork]) mkdirSync(path, { recursive: true })
  // A previous standard build must never become a jar export.
  writeFileSync(join(oldWork, 'brundlefly-work.blend'), JSON.stringify({ variant: 'standard' }))
  for (const name of ['flatpak', 'node']) writeFileSync(join(bin, name), tool, { mode: 0o755 })
  const calls = join(root, 'calls')
  const exported = join(root, 'exported')
  const commands = recipe(variant === 'standard' ? '## Rebuild' : '## Jar variant')
  const result = spawnSync('bash', ['-c', commands.replaceAll('/abs/path/to/assets/3d/brundlefly', dir)], {
    // Supply the shared variables used by the original jar recipe, too.
    env: { ...process.env, D: dir, OUT: oldWork, VIEWS: '', HOME: home, PATH: `${bin}:${process.env.PATH}`, CALLS: calls, EXPORTED: exported, FAIL_STAGE: failStage },
    encoding: 'utf8',
    timeout: 10000,
  })
  return { root, dir, result, exported: existsSync(exported) ? readFileSync(exported, 'utf8').trim().split('\n') : [], calls: existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\n') : [] }
}

mkdirSync(join(homedir(), 'scratch'), { recursive: true })
for (const variant of ['standard', 'jar'] as const) {
  for (const stage of ['build_from_mesh.py', 'export_model.py', ...(variant === 'standard' ? ['render_previews.py'] : ['stance_float.ts']), 'validate.ts']) {
    test(`${variant} recipe stops after ${stage} fails`, () => {
      const run = runRecipe(variant, stage)
      try {
        assert.notEqual(run.result.status, 0, `recipe hid ${stage} failure: ${run.result.stderr}`)
        assert.equal(run.calls.at(-1), stage, 'a downstream stage ran after failure')
        if (variant === 'jar' && stage === 'build_from_mesh.py') {
          assert.deepEqual(run.exported, [], 'jar artifacts were written after failure')
          assert.equal(run.calls.includes('export_model.py'), false, 'stale standard model was exported as jar')
          assert.equal(run.calls.includes('validate.ts'), false, 'jar validation ran after failed build')
        }
      }
      finally { rmSync(run.root, { recursive: true, force: true }) }
    })
  }
  test(`${variant} recipe exports and validates its own model`, () => {
    const run = runRecipe(variant)
    try {
      assert.equal(run.result.status, 0, run.result.stderr)
      assert.equal(run.calls.at(-1), 'validate.ts')
      assert.equal(JSON.parse(readFileSync(run.exported[0]!, 'utf8')).variant, variant)
    }
    finally { rmSync(run.root, { recursive: true, force: true }) }
  })
}
