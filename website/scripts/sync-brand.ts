import { copyFile, cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { zipSync } from 'fflate'
import { skills } from '../shared/content.ts'

const source = new URL('../../assets/brand/', import.meta.url)
const target = new URL('../public/brand/', import.meta.url)
await mkdir(target, { recursive: true })
await Promise.all(['github-banner-overhang-gross.png', 'github-avatar.png'].map(name =>
  copyFile(new URL(name, source), new URL(name, target)),
))
await cp(new URL('kit/', source), new URL('kit/', target), { recursive: true })

async function collectFiles(directory: URL, prefix: string): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {}
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}/${entry.name}`
    if (entry.isDirectory()) Object.assign(files, await collectFiles(new URL(`${entry.name}/`, directory), path))
    else if (entry.isFile()) files[path] = await readFile(new URL(entry.name, directory))
    else throw new Error(`Skill bundle contains an unsupported file: ${path}`)
  }
  return files
}

const downloads = new URL('../public/skills/', import.meta.url)
await mkdir(downloads, { recursive: true })
for (const { name } of skills) {
  const directory = new URL(`../../skills/${name}/`, import.meta.url)
  const files = await collectFiles(directory, name)
  await writeFile(new URL(`${name}.zip`, downloads), zipSync(files))
  await writeFile(new URL(`${name}.md`, downloads), await readFile(new URL('SKILL.md', directory)))
}
