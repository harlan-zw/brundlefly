import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { Miniflare } from 'miniflare'
import { handleApi, reserveTurn } from '../worker/index.ts'

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
    const greetings = await Promise.all(replies.map(response => response.clone().json() as Promise<{ ordinal: number, returning: boolean }>))
    assert.deepEqual(greetings.map(value => value.ordinal).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8])
    assert.ok(greetings.every(value => !value.returning), 'A first visit is never a return.')
    const cookie = replies[0]!.headers.get('set-cookie')!.split(';')[0]!
    const repeated = await handleApi(new Request('https://example.test/api/visit', { headers: { Cookie: cookie } }), env)
    assert.deepEqual(await repeated.json(), greetings[0])
    assert.match(repeated.headers.get('set-cookie')!, /HttpOnly; SameSite=Strict; Max-Age=86400; Secure/)
    const session = cookie.split('=')[1]!
    const day = new Date().toISOString().slice(0, 10)
    // A visitor row from an earlier day makes this session a return visit. Its count for today stays.
    await env.DIALOGUE_DB.prepare('INSERT INTO visitors VALUES (?, ?, ?)').bind(new Date(Date.now() - 86400_000).toISOString().slice(0, 10), session, 1).run()
    const back = await handleApi(new Request('https://example.test/api/visit', { headers: { Cookie: cookie } }), env)
    assert.deepEqual(await back.json(), { ...greetings[0], returning: true })
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

test('one network can take 400 live turns a day, so a room of guests on one Wi-Fi can all talk, and the daily total still holds', async () => {
  const runtime = new Miniflare({ workers: [{ config: {
    name: 'dialogue-limit-test', compatibilityDate: '2026-10-04',
    manifest: { mainModule: 'test.mjs', modules: { 'test.mjs': { type: 'esm', contents: 'export default { fetch() { return new Response("Fixture") } }' } } },
    env: { DIALOGUE_DB: { type: 'd1', id: 'dialogue-limit-test' }, AI: { type: 'ai' } },
  } }] })
  await Promise.resolve().then(async () => {
    const env = await runtime.getBindings<Env>()
    const schema = await readFile(new URL('../worker/schema.sql', import.meta.url), 'utf8')
    await env.DIALOGUE_DB.batch(schema.split(';').filter(value => value.trim()).map(value => env.DIALOGUE_DB.prepare(value)))
    const day = '2026-11-27'
    const now = Date.parse(`${day}T20:00:00Z`)
    const from = (address: string) => new Request('https://example.test/api/dialogue', { method: 'POST', headers: { 'CF-Connecting-IP': address } })
    const networkHash = async (address: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}:${address}`))), byte => byte.toString(16).padStart(2, '0')).join('')
    const fill = (count: number, hash: string, label: string) => env.DIALOGUE_DB.batch(Array.from({ length: count }, (_, index) =>
      env.DIALOGUE_DB.prepare('INSERT INTO turns VALUES (?, ?, ?, ?, ?)').bind(`${label}-${index}`, day, `${label}-guest-${index % 30}`, hash, now - 60000)))
    // 399 turns from the guests of one venue. The 400th passes and the 401st does not.
    await fill(399, await networkHash('203.0.113.7'), 'venue')
    assert.equal(await reserveTurn(from('203.0.113.7'), env, day, 'late-guest', now), true)
    assert.equal(await reserveTurn(from('203.0.113.7'), env, day, 'one-more-guest', now), false)
    // Another network is not held back by the venue.
    assert.equal(await reserveTurn(from('198.51.100.9'), env, day, 'at-home', now), true)
    // The day still stops at 1,000 turns in total, so the most a day can cost does not change.
    await fill(599, await networkHash('192.0.2.44'), 'elsewhere')
    assert.equal(await reserveTurn(from('198.51.100.9'), env, day, 'thousand-and-first', now), false)
  }).finally(() => runtime.dispose())
})
