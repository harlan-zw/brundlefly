import { copyFile, cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { zipSync } from 'fflate'
import { skills } from '../shared/content.ts'
import { defaultPreset, parts, palette } from '../layers/brand/shared/catalogue.ts'

const source = new URL('../../assets/brand/', import.meta.url)
const target = new URL('../public/brand/', import.meta.url)
await mkdir(target, { recursive: true })
await Promise.all(['github-banner-overhang-gross.png', 'github-avatar.png', 'character.png'].map(name =>
  copyFile(new URL(name, source), new URL(name, target)),
))
await cp(new URL('kit/', source), new URL('kit/', target), { recursive: true })
const layer = new URL('../layers/brand/', import.meta.url)
const layerArt = new URL('public/brand/', layer)
await mkdir(layerArt, { recursive: true })
await cp(target, layerArt, { recursive: true })

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

const kit = new URL('../public/kit/', import.meta.url)
await mkdir(kit, { recursive: true })
const bundle: Record<string, Uint8Array> = {}
for (const name of ['nuxt.config.ts', 'package.json', 'README.md']) {
  bundle[`brundlefly-brand/${name}`] = await readFile(new URL(name, layer))
}
for (const directory of ['app', 'shared', 'public']) {
  Object.assign(bundle, await collectFiles(new URL(`${directory}/`, layer), `brundlefly-brand/${directory}`))
}
// The portable layer needs runtime parts. Concepts and interchange models have separate download URLs.
for (const path of Object.keys(bundle)) {
  if (path.endsWith('.glb') || ['github-banner-overhang-gross.png', 'github-avatar.png', 'design-direction.png', 'lair-direction.png', 'cave-direction.webp', 'visceral-direction.png', 'mascot-sculpt-reference.png', 'head-sculpt-direction.png', 'material-board.png', 'instrument-surround.png'].some(name => path.endsWith(`/${name}`))) delete bundle[path]
}
await writeFile(new URL('brand-layer.zip', kit), zipSync(bundle))
await writeFile(new URL('catalogue.json', kit), JSON.stringify({ palette, parts, preset: defaultPreset }, null, 2))
