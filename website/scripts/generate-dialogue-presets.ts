import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { choiceNeedsInput, parsePresetGraph } from '../shared/preset-dialogue.ts'
import type { PresetTarget } from '../shared/preset-dialogue.ts'
import type { ConversationHistoryMessage, ConversationReply } from '../shared/conversation.ts'
import { MODEL, parseDialogueCompletion } from '../worker/index.ts'
import { PRESET_DEPTH, presetOpenings, presetSourceHash } from './dialogue-preset-source.ts'

const scratch = process.env.BRUNDLEFLY_PRESET_SCRATCH ?? join(homedir(), 'scratch', 'brundlefly-dialogue-presets')
await mkdir(scratch, { recursive: true })
type WireReply = { speech: string; beat: string; mood: string; choices: string[]; linkIds: string[] }
type Node = { id: string; reply: WireReply; targets: PresetTarget[] }
const wireReply = (reply: ConversationReply): WireReply => ({
  speech: reply.text, beat: reply.beat, mood: reply.mood, choices: reply.choices,
  linkIds: [...new Set(reply.links.map(link => link.href === '/brand-kit/' ? 'brand-kit' : /\/skills\/([^/]+)\./.exec(link.href)?.[1]).filter((id): id is string => Boolean(id)))],
})
const nodes: Node[] = []
const roots: string[] = []
const sourceHash = presetSourceHash()
let generated = 0
let lastStart = 0

const generate = async (text: string, history: ConversationHistoryMessage[], id: string): Promise<ConversationReply> => {
  const file = join(scratch, `${sourceHash}-${id}.json`)
  const saved = await readFile(file, 'utf8').then(value => ({ _tag: 'Saved' as const, value })).catch((error: unknown) => {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return { _tag: 'Missing' as const }
    throw error
  })
  if (saved._tag === 'Saved') {
    const parsed = await parseDialogueCompletion(JSON.parse(saved.value))
    if (parsed._tag === 'Err') throw new Error(`Invalid saved reply: ${id}`)
    return parsed.value
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    await setTimeout(Math.max(0, 2300 - (Date.now() - lastStart)))
    lastStart = Date.now()
    const response = await fetch('http://127.0.0.1:8790/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, history: history.slice(-8) }), signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw new Error(`Generator returned HTTP ${response.status}.`)
    const completion: unknown = await response.json()
    const parsed = await parseDialogueCompletion(completion)
    if (parsed._tag === 'Ok') {
      await writeFile(file, JSON.stringify(completion, null, 2))
      generated++
      console.log(JSON.stringify({ id, generated, event: 'generated', attempt }))
      return parsed.value
    }
    console.error(JSON.stringify({ id, event: 'invalid_reply', attempt }))
  }
  throw new Error(`Generation failed for ${id}.`)
}

const expand = async (reply: ConversationReply, id: string, depth: number, history: ConversationHistoryMessage[]) => {
  const node: Node = { id, reply: wireReply(reply), targets: [] }
  nodes.push(node)
  for (const [index, choice] of reply.choices.entries()) {
    if (choiceNeedsInput(choice)) node.targets.push({ _tag: 'Compose' })
    else if (depth === PRESET_DEPTH) node.targets.push({ _tag: 'Live' })
    else {
      const nextId = `${id}-${index}`
      const next = await generate(choice, history, nextId)
      node.targets.push({ _tag: 'Reply', id: nextId })
      await expand(next, nextId, depth + 1, [...history.slice(-6), { role: 'user', content: choice }, { role: 'assistant', content: next.text }])
    }
  }
}

for (const [index, reply] of presetOpenings().entries()) {
  const id = `opening-${index}`
  roots.push(id)
  await expand(reply, id, 0, [{ role: 'assistant', content: reply.text }])
}
const graph = { version: 1, sourceHash, depth: PRESET_DEPTH, model: MODEL, roots, nodes }
const parsed = parsePresetGraph(graph)
if (parsed._tag === 'Err') throw new Error(parsed.message)
await writeFile(new URL('../shared/dialogue-presets.generated.json', import.meta.url), `${JSON.stringify(graph, null, 2)}\n`)
console.log(JSON.stringify({ event: 'complete', nodes: nodes.length, generated, sourceHash }))
