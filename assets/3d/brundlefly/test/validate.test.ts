import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { test } from 'node:test'

const scratch = join(homedir(), 'scratch')
mkdirSync(scratch, { recursive: true })

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
