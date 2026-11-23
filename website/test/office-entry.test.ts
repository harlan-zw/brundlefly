import assert from 'node:assert/strict'
import { test } from 'node:test'
import { handleApi } from '../worker/index.ts'

// The room stands in for the Durable Object. It records what the Worker hands it.
const office = () => {
  const seen: { name: string, request: Request }[] = []
  const env = { OFFICE_ROOM: { getByName: (name: string) => ({ fetch: async (request: Request) => { seen.push({ name, request }); return new Response('room') } }) } } as unknown as Env
  return { env, seen }
}
const upgrade = (headers: Record<string, string> = {}) => new Request('https://brundlefly.dev/api/office', { headers: { Upgrade: 'websocket', ...headers } })

test('a WebSocket upgrade from the site reaches the one shared office room', async () => {
  const { env, seen } = office()
  // A browser sends the page's origin with the upgrade.
  const response = await handleApi(upgrade({ Origin: 'https://brundlefly.dev', 'Sec-Fetch-Site': 'same-origin' }), env)
  assert.equal(await response.text(), 'room')
  assert.equal(seen.length, 1)
  assert.equal(seen[0]!.name, 'presentation')
  assert.equal(seen[0]!.request.headers.get('upgrade'), 'websocket')
  // The presenter's page watches the same room, with its mark in the address.
  await handleApi(new Request('https://brundlefly.dev/api/office?watch', { headers: { Upgrade: 'websocket', Origin: 'https://brundlefly.dev' } }), env)
  assert.equal(seen[1]!.name, 'presentation')
  assert.equal(new URL(seen[1]!.request.url).searchParams.has('watch'), true)
})

test('another site cannot open the office room from a visitor\'s browser', async () => {
  const { env, seen } = office()
  for (const headers of [{ Origin: 'https://evil.test' }, { 'Sec-Fetch-Site': 'cross-site' }]) assert.equal((await handleApi(upgrade(headers), env)).status, 403)
  assert.equal(seen.length, 0)
})
