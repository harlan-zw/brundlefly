import { parseDialogueReply } from './conversation.ts'
import type { ConversationReply, Result } from './conversation.ts'

export type PresetTarget = { _tag: 'Reply'; id: string } | { _tag: 'Compose' } | { _tag: 'Live' }
export type PresetNode = { id: string; reply: ConversationReply; targets: [PresetTarget, PresetTarget, PresetTarget] }
export type PresetGraph = { sourceHash: string; depth: number; model: string; roots: string[]; nodes: ReadonlyMap<string, PresetNode> }
export type PresetSelection = { _tag: 'Reply'; id: string; reply: ConversationReply } | { _tag: 'Compose' } | { _tag: 'Live'; text: string } | { _tag: 'Unavailable' }
export type ConversationTurn = { _tag: 'Empty' } | { _tag: 'Generated'; reply: ConversationReply } | { _tag: 'Preset'; id: string; reply: ConversationReply }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{1,100}$/.test(value)
const fail = (message: string): Result<PresetGraph> => ({ _tag: 'Err', message })

export const parsePresetGraph = (value: unknown): Result<PresetGraph> => {
  if (!record(value) || value.version !== 1 || typeof value.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceHash)
    || typeof value.depth !== 'number' || !Number.isInteger(value.depth) || value.depth < 1 || value.depth > 5
    || typeof value.model !== 'string' || !Array.isArray(value.roots) || !value.roots.length || !value.roots.every(id)
    || !Array.isArray(value.nodes) || !value.nodes.length) return fail('Invalid conversation presets.')
  const nodes = new Map<string, PresetNode>()
  for (const node of value.nodes) {
    if (!record(node) || !id(node.id) || nodes.has(node.id) || !Array.isArray(node.targets) || node.targets.length !== 3) return fail('Invalid preset node.')
    const parsed = parseDialogueReply(node.reply)
    if (parsed._tag === 'Err') return fail(`Invalid reply for preset ${node.id}.`)
    const targets: PresetTarget[] = []
    for (const target of node.targets) {
      if (!record(target)) return fail(`Invalid choice for preset ${node.id}.`)
      if (target._tag === 'Reply' && id(target.id)) targets.push({ _tag: 'Reply', id: target.id })
      else if (target._tag === 'Compose' || target._tag === 'Live') targets.push({ _tag: target._tag })
      else return fail(`Invalid choice for preset ${node.id}.`)
    }
    nodes.set(node.id, { id: node.id, reply: parsed.value, targets: targets as PresetNode['targets'] })
  }
  for (const root of value.roots) if (!nodes.has(root)) return fail(`Missing opening preset ${root}.`)
  for (const node of nodes.values()) for (const target of node.targets) {
    if (target._tag === 'Reply' && !nodes.has(target.id)) return fail(`Missing preset ${target.id}.`)
  }
  return { _tag: 'Ok', value: { sourceHash: value.sourceHash, depth: value.depth, model: value.model, roots: value.roots, nodes } }
}

export const resolvePresetChoice = (graph: PresetGraph, nodeId: string, choice: number): PresetSelection => {
  const node = graph.nodes.get(nodeId)
  if (!node || !Number.isInteger(choice) || choice < 0 || choice > 2) return { _tag: 'Unavailable' }
  const target = node.targets[choice]!
  if (target._tag === 'Compose') return target
  if (target._tag === 'Live') return { _tag: 'Live', text: node.reply.choices[choice]! }
  const next = graph.nodes.get(target.id)
  return next ? { _tag: 'Reply', id: next.id, reply: next.reply } : { _tag: 'Unavailable' }
}

export const resolveOpeningPreset = (graph: PresetGraph, reply: ConversationReply, opening: number): ConversationTurn => {
  const rootId = Number.isInteger(opening) && opening >= 0 ? graph.roots[opening] : undefined
  const root = rootId ? graph.nodes.get(rootId) : undefined
  if (!root || !reply.text.endsWith(root.reply.text) || reply.choices.some((choice, index) => choice !== root.reply.choices[index])) return { _tag: 'Generated', reply }
  return { _tag: 'Preset', id: root.id, reply }
}

// A button can ask to supply text. It cannot stand in for that text or a personal fact.
export const choiceNeedsInput = (choice: string): boolean => /\b(?:here(?:['’]s| is| are) (?:my|the)|(?:my|the) (?:first|opening) (?:line|sentence)|make it (?:more )?personal|(?:read|review|edit|look at|help with) my (?:sentence|line|text|draft|paragraph|writing))\b/i.test(choice)
  || /\b(?:I|let me)\b.{0,20}\b(?:share|paste|send|show|give|read)\b.{0,25}\b(?:sentence|line|text|draft|paragraph|writing|detail|example|it)\b/i.test(choice)
  || /\b(?:I['’]ll|I will|let me) (?:tell|explain|describe)\b/i.test(choice)
