import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { test } from 'node:test'

const scratch = join(homedir(), 'scratch')
mkdirSync(scratch, { recursive: true })

for (const size of [80, 100]) {
  for (const check of ['height_ok', 'non_manifold_edges', 'boundary_edges', 'degenerate_faces', 'loose_vertices', 'shells', 'volume_cm3', 'self_intersecting_face_pairs']) {
    test(`rejects ${size} mm STL when ${check} fails despite Blender exiting zero`, (t) => {
      const root = mkdtempSync(join(scratch, 'brundlefly-validate-test-'))
      t.after(() => rmSync(root, { recursive: true, force: true }))
      const dir = join(root, 'models')
      const bin = join(root, 'bin')
      mkdirSync(dir)
      mkdirSync(bin)
      const tool = join(bin, 'check-tool.ts')
      copyFileSync(resolve(import.meta.dirname, 'fixtures/check-tool.ts'), tool)
      chmodSync(tool, 0o755)
      for (const command of ['flatpak', 'uv'])
        symlinkSync(tool, join(bin, command))
      for (const height of [80, 100])
        writeFileSync(join(dir, `brundlefly-${height}mm.stl`), 'solid fixture\nendsolid fixture\n')
      const file = `brundlefly-${size}mm.stl`
      const run = spawnSync(process.execPath, [resolve(import.meta.dirname, '../validate.ts'), '--dir', dir, '--work', join(root, 'work')], {
        encoding: 'utf8',
        timeout: 10000,
        env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, FIXTURE_SKIP_MESH: '0', FIXTURE_FAILED_FILE: file, FIXTURE_FAILED_CHECK: check },
      })

      assert.equal(run.error, undefined)
      assert.notEqual(run.status, 0, 'accepted a failed mesh verdict')
      assert.ok(run.stderr.includes(file), run.stderr)
      assert.ok(run.stderr.includes(check), run.stderr)
      const report = JSON.parse(readFileSync(join(dir, 'validation-report.json'), 'utf8'))
      assert.equal(report[`mesh_${size}mm`].passes_mesh_checks, false)
    })
  }
}

for (const failure of ['missing', 'unreadable', 'no-output'] as const) {
  test(`rejects ${failure} mesh output after a successful run with the same --work`, (t) => {
    const root = mkdtempSync(join(scratch, 'brundlefly-validate-test-'))
    t.after(() => rmSync(root, { recursive: true, force: true }))
    const dir = join(root, 'models')
    const work = join(root, 'work')
    const bin = join(root, 'bin')
    mkdirSync(dir)
    mkdirSync(bin)
    const tool = join(bin, 'check-tool.ts')
    copyFileSync(resolve(import.meta.dirname, 'fixtures/check-tool.ts'), tool)
    chmodSync(tool, 0o755)
    for (const command of ['flatpak', 'uv'])
      symlinkSync(tool, join(bin, command))
    const stl100 = join(dir, 'brundlefly-100mm.stl')
    for (const name of ['brundlefly-80mm.stl', 'brundlefly-100mm.stl'])
      writeFileSync(join(dir, name), 'solid fixture\nendsolid fixture\n')
    const run = (skipMesh = false) => spawnSync(process.execPath, [resolve(import.meta.dirname, '../validate.ts'), '--dir', dir, '--work', work], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, FIXTURE_SKIP_MESH: skipMesh ? '1' : '0' },
    })

    const first = run()
    assert.equal(first.status, 0, first.stderr)
    const reportPath = join(dir, 'validation-report.json')
    const report = JSON.parse(readFileSync(reportPath, 'utf8'))
    assert.equal(report.mesh_100mm.passes_mesh_checks, true)
    // A failed invocation must not publish a report, even when old outputs remain.
    rmSync(reportPath)
    if (failure === 'missing')
      rmSync(stl100)
    if (failure === 'unreadable')
      writeFileSync(stl100, 'invalid STL')

    const second = run(failure === 'no-output')
    assert.notEqual(second.status, 0, 'accepted a stale passing mesh result')
    assert.throws(() => readFileSync(reportPath), { code: 'ENOENT' })
    assert.match(second.stderr, failure === 'no-output' ? /ENOENT/ : /STL import failed/)
  })
}

test('--name reads the named STL files and writes a report of its own', (t) => {
  const root = mkdtempSync(join(scratch, 'brundlefly-validate-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const dir = join(root, 'models')
  const bin = join(root, 'bin')
  mkdirSync(dir)
  mkdirSync(bin)
  const tool = join(bin, 'check-tool.ts')
  copyFileSync(resolve(import.meta.dirname, 'fixtures/check-tool.ts'), tool)
  chmodSync(tool, 0o755)
  for (const command of ['flatpak', 'uv'])
    symlinkSync(tool, join(bin, command))
  for (const name of ['brundlefly-jar-80mm.stl', 'brundlefly-jar-100mm.stl'])
    writeFileSync(join(dir, name), 'solid fixture\nendsolid fixture\n')
  const main = join(dir, 'validation-report.json')
  writeFileSync(main, 'the report of the main files\n')

  const run = spawnSync(process.execPath, [resolve(import.meta.dirname, '../validate.ts'), '--dir', dir, '--work', join(root, 'work'), '--name', 'brundlefly-jar'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, FIXTURE_SKIP_MESH: '0' },
  })

  assert.equal(run.status, 0, run.stderr)
  const report = JSON.parse(readFileSync(join(dir, 'brundlefly-jar-validation-report.json'), 'utf8'))
  assert.equal(report.mesh_80mm.file, 'brundlefly-jar-80mm.stl')
  assert.equal(report.mesh_100mm.file, 'brundlefly-jar-100mm.stl')
  assert.equal(readFileSync(main, 'utf8'), 'the report of the main files\n')
  // Without --heights the two files must be 80 and 100 mm tall.
  assert.equal(report.mesh_80mm.expected_height_mm, 80)
  assert.equal(report.mesh_100mm.expected_height_mm, 100)
})

test('--heights sets the height that each file must have', (t) => {
  const root = mkdtempSync(join(scratch, 'brundlefly-validate-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const dir = join(root, 'models')
  const bin = join(root, 'bin')
  mkdirSync(dir)
  mkdirSync(bin)
  const tool = join(bin, 'check-tool.ts')
  copyFileSync(resolve(import.meta.dirname, 'fixtures/check-tool.ts'), tool)
  chmodSync(tool, 0o755)
  for (const command of ['flatpak', 'uv'])
    symlinkSync(tool, join(bin, command))
  for (const name of ['brundlefly-80mm.stl', 'brundlefly-100mm.stl'])
    writeFileSync(join(dir, name), 'solid fixture\nendsolid fixture\n')
  const run = (heights: string) => spawnSync(process.execPath, [resolve(import.meta.dirname, '../validate.ts'), '--dir', dir, '--work', join(root, 'work'), '--heights', heights], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, FIXTURE_SKIP_MESH: '0' },
  })

  const good = run('87.2,109')
  assert.equal(good.status, 0, good.stderr)
  const report = JSON.parse(readFileSync(join(dir, 'validation-report.json'), 'utf8'))
  assert.equal(report.mesh_80mm.expected_height_mm, 87.2)
  assert.equal(report.mesh_100mm.expected_height_mm, 109)

  const bad = run('87.2')
  assert.notEqual(bad.status, 0)
  assert.match(bad.stderr, /--heights takes two heights/)
})
