import { parseDialogueInput } from '../shared/conversation.ts'
import { MODEL, buildDialogueRequest, dialogueGateway } from '../worker/index.ts'

export default {
  async fetch(request: Request, env: Pick<Env, 'AI'>): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('origin')
    if (url.hostname !== '127.0.0.1' || url.pathname !== '/generate' || request.method !== 'POST'
      || (origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return new Response('Unavailable.', { status: 403 })
    const parsed = parseDialogueInput(await request.json())
    if (parsed._tag === 'Err') return Response.json(parsed, { status: 400 })
    const completion = await env.AI.run(MODEL, buildDialogueRequest(parsed.value, null), {
      ...dialogueGateway, signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
    })
    return Response.json(completion)
  },
} satisfies ExportedHandler<Pick<Env, 'AI'>>
