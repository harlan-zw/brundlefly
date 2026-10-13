import { readFile } from 'node:fs/promises'
import { choiceNeedsInput, parsePresetGraph, resolvePresetChoice } from '../shared/preset-dialogue.ts'
import { PRESET_DEPTH, presetOpenings, presetSourceHash } from './dialogue-preset-source.ts'
import { MODEL } from '../worker/index.ts'

const data: unknown = JSON.parse(await readFile(new URL('../shared/dialogue-presets.generated.json', import.meta.url), 'utf8'))
const parsed = parsePresetGraph(data)
if (parsed._tag === 'Err') throw new Error(parsed.message)
const graph = parsed.value
if (graph.sourceHash !== presetSourceHash() || graph.model !== MODEL || graph.depth !== PRESET_DEPTH) throw new Error('Conversation presets need regeneration. Run pnpm presets:generate with the local generator.')
const openings = presetOpenings()
if (graph.roots.length !== openings.length) throw new Error('Conversation presets do not cover every opening.')
const visited = new Set<string>()
const visit = (id: string, depth: number) => {
  if (visited.has(id)) throw new Error(`Conversation preset contains a cycle or duplicate destination: ${id}.`)
  const node = graph.nodes.get(id)
  if (!node) throw new Error(`Missing conversation preset: ${id}.`)
  visited.add(id)
  for (let index = 0; index < 3; index++) {
    const selected = resolvePresetChoice(graph, id, index)
    if (choiceNeedsInput(node.reply.choices[index]!) !== (selected._tag === 'Compose')) throw new Error(`Preset input choice has an invalid destination: ${id}.`)
    if (selected._tag === 'Reply') {
      if (depth >= PRESET_DEPTH) throw new Error(`Preset exceeds the configured depth: ${id}.`)
      visit(selected.id, depth + 1)
    }
    else if (selected._tag === 'Live' && depth < PRESET_DEPTH) throw new Error(`Preset is missing a generated continuation: ${id}.`)
    else if (selected._tag === 'Unavailable') throw new Error(`Preset choice is unavailable: ${id}.`)
  }
}
for (const [index, opening] of openings.entries()) {
  const root = graph.nodes.get(graph.roots[index]!)
  if (!root || root.reply.text !== opening.text || root.reply.choices.some((choice, position) => choice !== opening.choices[position])) throw new Error('Conversation preset opening differs from the greeting.')
  visit(root.id, 0)
}
if (visited.size !== graph.nodes.size) throw new Error('Conversation presets contain unreachable replies.')
console.log(`Verified ${graph.nodes.size} conversation presets through ${PRESET_DEPTH} exchanges.`)
