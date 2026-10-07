import { mkdir, readFile, writeFile } from 'node:fs/promises'

// These copies let every workflow work without sibling Skills installed.
const consumers = {
  clarity: ['im-not-a-fly', 'technical-guide', 'readme'],
  'claim-fidelity': ['im-not-a-fly', 'technical-guide', 'readme', 'im-a-fly', 'pull-request-summary'],
  'verify-examples': ['technical-guide', 'readme'],
} as const

const args = process.argv.slice(2)
if (args.length > 1 || args.some(arg => arg !== '--check')) throw new Error('Use node scripts/sync-blocks.ts [--check].')
const check = args.includes('--check')
const skills = new URL('../skills/', import.meta.url)
let stale = false

for (const [block, workflows] of Object.entries(consumers)) {
  const source = await readFile(new URL(`${block}/SKILL.md`, skills), 'utf8')
  for (const workflow of workflows) {
    const directory = new URL(`${workflow}/references/blocks/`, skills)
    const destination = new URL(`${block}.md`, directory)
    if (check) {
      const current = await readFile(destination, 'utf8').catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error
        return undefined
      })
      if (current !== source) {
        console.error(`Refresh ${workflow}/references/blocks/${block}.md.`)
        stale = true
      }
    }
    else {
      await mkdir(directory, { recursive: true })
      await writeFile(destination, source)
    }
  }
}

if (stale) process.exitCode = 1
else console.log(check ? 'Bundled blocks match their source Skills.' : 'Bundled blocks refreshed.')
