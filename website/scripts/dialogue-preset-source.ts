import { createHash } from 'node:crypto'
import { openingSeeds } from '../shared/conversation.ts'
import { MODEL, buildDialogueRequest, dialogueGateway } from '../worker/index.ts'

export const PRESET_DEPTH = 3
export const presetOpenings = openingSeeds
export const presetSourceHash = () => createHash('sha256').update(JSON.stringify({
  model: MODEL, input: buildDialogueRequest({ text: '', history: [] }, null), options: dialogueGateway,
  openings: presetOpenings(), depth: PRESET_DEPTH,
})).digest('hex')
