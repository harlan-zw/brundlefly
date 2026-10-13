import { createHash } from 'node:crypto'
import { linkIds, openingSeeds } from '../shared/conversation.ts'
import { MODEL, buildDialogueRequest, dialogueGateway } from '../worker/index.ts'

export const PRESET_DEPTH = 3
export const presetOpenings = openingSeeds
export const presetSourceHash = (catalog: readonly string[] = linkIds) => createHash('sha256').update(JSON.stringify({
  model: MODEL, input: buildDialogueRequest({ text: '', history: [] }, null, catalog), options: dialogueGateway,
  openings: presetOpenings(), depth: PRESET_DEPTH,
})).digest('hex')
