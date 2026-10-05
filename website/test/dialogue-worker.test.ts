import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { Miniflare } from 'miniflare'
import { handleApi } from '../worker/index.ts'

test('visitor assignment is atomic, preserves a session, and enforces quota before inference', async () => {
  const runtime = new Miniflare({ workers: [{ config: {
    name: 'dialogue-test', compatibilityDate: '2026-10-04',
    manifest: { mainModule: 'test.mjs', modules: { 'test.mjs': { type: 'esm', contents: 'export default { fetch() { return new Response("Fixture") } }' } } },
    env: { DIALOGUE_DB: { type: 'd1', id: 'dialogue-test' }, AI: { type: 'ai' } },
  } }] })
  await Promise.resolve().then(async () => {
    const env = await runtime.getBindings<Env>()
    const schema = await readFile(new URL('../worker/schema.sql', import.meta.url), 'utf8')
    await env.DIALOGUE_DB.batch(schema.split(';').filter(value => value.trim()).map(value => env.DIALOGUE_DB.prepare(value)))
    const replies = await Promise.all(Array.from({ length: 8 }, () => handleApi(new Request('https://example.test/api/visit'), env)))
    const greetings = await Promise.all(replies.map(response => response.clone().json() as Promise<{ greeting: { text: string } }>))
    assert.equal(new Set(greetings.map(value => value.greeting.text)).size, 8)
    const cookie = replies[0]!.headers.get('set-cookie')!.split(';')[0]!
    const repeated = await handleApi(new Request('https://example.test/api/visit', { headers: { Cookie: cookie } }), env)
    assert.deepEqual(await repeated.json(), greetings[0])
    assert.match(repeated.headers.get('set-cookie')!, /HttpOnly; SameSite=Strict; Max-Age=86400; Secure/)
    const session = cookie.split('=')[1]!
    const day = new Date().toISOString().slice(0, 10)
    await env.DIALOGUE_DB.batch(Array.from({ length: 40 }, (_, index) => env.DIALOGUE_DB.prepare('INSERT INTO turns VALUES (?, ?, ?, ?, ?)').bind(`turn-${index}`, day, session, 'fixture', Date.now() - 60000)))
    const limited = await handleApi(new Request('https://example.test/api/dialogue', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Are you all right?', history: [] }) }), env)
    assert.equal(limited.status, 429)
    assert.equal(limited.headers.get('retry-after'), '60')
    const hostile = await handleApi(new Request('https://example.test/api/dialogue', { method: 'POST', headers: { Origin: 'https://evil.test' } }), env)
    assert.equal(hostile.status, 403)
    const excessive = await handleApi(new Request('https://example.test/api/dialogue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x'.repeat(17000), history: [] }) }), env)
    assert.equal(excessive.status, 400)
  }).finally(() => runtime.dispose())
})
