import assert from 'node:assert/strict'
import { test } from 'node:test'
import { replyToConversation } from '../shared/conversation.ts'

test('local replies reject empty and oversized input without inventing a response', () => {
  assert.deepEqual(replyToConversation(' \n '), { _tag: 'Err', message: 'Add some text first.' })
  assert.deepEqual(replyToConversation('a'.repeat(1001)), { _tag: 'Err', message: 'Keep your text under 1,001 characters.' })
  assert.equal(replyToConversation('a'.repeat(1000))._tag, 'Ok')
})

test('install requests explain copying a complete skill and link to usable downloads', () => {
  const response = replyToConversation('How do I install write-human?')
  assert.equal(response._tag, 'Ok')
  if (response._tag !== 'Ok') return
  assert.match(response.reply.text, /Copy the complete skill directory/)
  assert.ok(response.reply.links.some(link => link.href === '/skills/write-human.zip'))
})

test('specific skill questions return factual scope and the matching instructions', () => {
  for (const name of ['write-human', 'technical-guide', 'pr']) {
    const response = replyToConversation(`Tell me about ${name}`)
    assert.equal(response._tag, 'Ok')
    if (response._tag !== 'Ok') continue
    assert.ok(response.reply.links.some(link => link.href === `/skills/${name}.md`))
    assert.doesNotMatch(response.reply.text, /I ran|checks pass|guarantee/i)
  }
})

test('brand kit requests link to the kit, while unknown input states the local reply boundary', () => {
  const kit = replyToConversation('Where is the brand kit?')
  assert.equal(kit._tag, 'Ok')
  if (kit._tag === 'Ok') assert.ok(kit.reply.links.some(link => link.href === '/brand-kit/'))
  const unknown = replyToConversation('<script>alert("arbitrary")</script>')
  assert.equal(unknown._tag, 'Ok')
  if (unknown._tag === 'Ok') {
    assert.match(unknown.reply.text, /Local replies cover/)
    assert.doesNotMatch(unknown.reply.text, /<script>/)
  }
})
