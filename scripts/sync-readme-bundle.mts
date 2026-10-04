import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

async function readTree(root: string, prefix = ''): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>()
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name)
    if (entry.isDirectory()) {
      for (const [name, content] of await readTree(root, path)) files.set(name, content)
    }
    else if (entry.isFile()) {
      files.set(path, await readFile(join(root, path)))
    }
    else {
      throw new Error(`Unsupported bundle entry: ${path}`)
    }
  }
  return files
}

export async function syncReadmeBundle(root: string, mode: 'check' | 'write'): Promise<string[]> {
  const sourceRoot = join(root, 'skills/write-human')
  const bundleRoot = join(root, 'skills/readme/references/write-human')
  const source = new Map([...await readTree(sourceRoot)]
    .map(([path, content]) => [path === 'SKILL.md' ? 'rules.md' : path, content]))
  const bundle = await readTree(bundleRoot).catch((error: unknown) => {
    // The output directory can be absent before its first generation.
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return new Map<string, Buffer>()
    throw error
  })
  const drift = [...new Set([...source.keys(), ...bundle.keys()])]
    .filter(path => !source.get(path)?.equals(bundle.get(path) ?? Buffer.alloc(0)) || !bundle.has(path))
    .sort()

  if (mode === 'write' && drift.length > 0) {
    await rm(bundleRoot, { recursive: true, force: true })
    for (const [path, content] of source) {
      const target = join(bundleRoot, path)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, content)
    }
  }
  return drift
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
    console.error('Usage: node scripts/sync-readme-bundle.mts [--check]')
    process.exitCode = 2
  }
  else {
    const mode = args[0] === '--check' ? 'check' : 'write'
    const root = fileURLToPath(new URL('../', import.meta.url))
    const drift = await syncReadmeBundle(root, mode)
    if (mode === 'check' && drift.length > 0) {
      console.error('The readme bundle differs from write-human:')
      for (const path of drift) console.error(`  ${path}`)
      console.error('Run node scripts/sync-readme-bundle.mts to update it.')
      process.exitCode = 1
    }
    else {
      console.log(mode === 'check' ? 'The readme bundle matches write-human.' : `Updated ${drift.length} bundle files.`)
    }
  }
}
