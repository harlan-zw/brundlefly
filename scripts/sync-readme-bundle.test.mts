import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { syncReadmeBundle } from './sync-readme-bundle.mts'

test('check reports drift without changing the installed bundle', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'brundlefly-bundle-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const source = join(root, 'skills/write-human')
  const bundle = join(root, 'skills/readme/references/write-human')
  await mkdir(join(source, 'references'), { recursive: true })
  await mkdir(join(bundle, 'references'), { recursive: true })
  await writeFile(join(source, 'SKILL.md'), '# Writing rules\n')
  await writeFile(join(source, 'references/data.json'), '{"rule":"preserve facts"}\n')
  await writeFile(join(bundle, 'references/data.json'), '{"rule":"old rule"}\n')
  await writeFile(join(bundle, 'obsolete.json'), '{}\n')

  assert.deepEqual(await syncReadmeBundle(root, 'check'), ['obsolete.json', 'references/data.json', 'rules.md'])
  assert.deepEqual(JSON.parse(await readFile(join(bundle, 'references/data.json'), 'utf8')), { rule: 'old rule' })
  await access(join(bundle, 'obsolete.json'))
})

test('sync creates the complete bundle, removes stale files, and becomes idempotent', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'brundlefly-bundle-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const source = join(root, 'skills/write-human')
  const bundle = join(root, 'skills/readme/references/write-human')
  await mkdir(join(source, 'references/nested'), { recursive: true })
  await writeFile(join(source, 'SKILL.md'), '# Writing rules\n')
  await writeFile(join(source, 'references/nested/data.json'), '{"rule":"preserve facts"}\n')

  assert.deepEqual(await syncReadmeBundle(root, 'write'), ['references/nested/data.json', 'rules.md'])
  assert.deepEqual(JSON.parse(await readFile(join(bundle, 'references/nested/data.json'), 'utf8')), { rule: 'preserve facts' })
  assert.deepEqual(await syncReadmeBundle(root, 'check'), [])
  await writeFile(join(bundle, 'obsolete.json'), '{}\n')
  assert.deepEqual(await syncReadmeBundle(root, 'write'), ['obsolete.json'])
  await assert.rejects(access(join(bundle, 'obsolete.json')), { code: 'ENOENT' })
  assert.deepEqual(await syncReadmeBundle(root, 'write'), [])
})

test('missing source fails without replacing an existing bundle', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'brundlefly-bundle-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const bundle = join(root, 'skills/readme/references/write-human')
  await mkdir(bundle, { recursive: true })
  await writeFile(join(bundle, 'data.json'), '{"rule":"keep me"}\n')

  await assert.rejects(syncReadmeBundle(root, 'write'), { code: 'ENOENT' })
  assert.deepEqual(JSON.parse(await readFile(join(bundle, 'data.json'), 'utf8')), { rule: 'keep me' })
})
