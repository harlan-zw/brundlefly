import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blind, extractText, parseRewrite, parseVerdicts, parseSingleVerdict, isOutsideRepository, loadInstructionBundle, hash } from './core.ts';

test('bundles linked Markdown once, including nested blocks, with reproducible hashes', async () => {
  const files: Record<string, string> = {
    'SKILL.md': 'Read [clarity](references/clarity.md). Read it [again](references/clarity.md#review). [Source](https://example.com/source.md)',
    'references/clarity.md': 'Read [fidelity](blocks/fidelity.md).',
    'references/blocks/fidelity.md': 'Preserve uncertainty. [Back](../../SKILL.md)',
  };
  const reads: string[] = [];
  const bundle = await loadInstructionBundle(async path => { reads.push(path); return files[path]; });
  assert.deepEqual(reads, ['SKILL.md', 'references/clarity.md', 'references/blocks/fidelity.md']);
  assert.ok(bundle.instructions.includes('Preserve uncertainty.'));
  assert.deepEqual(bundle.fileHashes, Object.fromEntries(Object.entries(files).map(([path, text]) => [path, hash(text)])));
  const changed = await loadInstructionBundle(async path => path.endsWith('fidelity.md') ? 'Preserve dates.' : files[path]);
  assert.notEqual(hash(bundle.instructions), hash(changed.instructions));
});

test('rejects local references outside the Skill and propagates missing references', async () => {
  for (const target of ['../private.md', '/private.md', '%2e%2e/private.md', '..\\private.md']) {
    await assert.rejects(loadInstructionBundle(async () => `[Read](${target})`), /outside the Skill/);
  }
  await assert.rejects(loadInstructionBundle(async path => {
    if (path !== 'SKILL.md') throw Error('Missing reference');
    return '[Required](references/missing.md)';
  }), /Missing reference/);
});

test('scratch rejects the repository itself and its descendants', () => {
  assert.equal(isOutsideRepository('/repo', '/repo'), false);
  assert.equal(isOutsideRepository('/repo', '/repo/logs'), false);
  assert.equal(isOutsideRepository('/repo', '/repo-other'), true);
});

test('extracts streamed text and rejects errors or tool use', () => {
  assert.equal(extractText('{"type":"text","part":{"text":"one"}}\n{"type":"text","part":{"text":"two"}}'), 'onetwo');
  assert.throws(() => extractText('{"type":"error"}'));
  assert.throws(() => extractText('{"type":"tool_use"}'));
  assert.throws(() => extractText('{"type":"step_start"}'));
});
test('parses only nonempty final rewrites', () => {
  assert.equal(parseRewrite('{"text":"Keep this."}'), 'Keep this.');
  assert.equal(parseRewrite('```json\n{"text":"Keep this."}\n```'), 'Keep this.');
  assert.throws(() => parseRewrite('{"text":""}'));
  assert.throws(() => parseRewrite('{"text":42}'));
});
test('anonymization preserves output and a reversible private mapping', () => {
  const original = [{ variant: 'alpha', text: 'First' }, { variant: 'beta', text: 'Second' }];
  const result = blind(original, 'seed');
  for (const candidate of result.candidates) assert.equal(candidate.text, original.find(item => item.variant === result.mapping[candidate.id])!.text);
  assert.deepEqual(blind(original, 'seed'), result);
});
test('verdict parser rejects missing, duplicate, and unknown candidates', () => {
  const candidates = [{ id: 'A', text: 'One' }, { id: 'B', text: 'Two' }];
  const verdict = (id: string) => ({ id, checks: [true], issues: [] });
  assert.equal(parseVerdicts(JSON.stringify({ verdicts: [verdict('A'), verdict('B')] }), candidates, 1).length, 2);
  for (const ids of [['A'], ['A', 'A'], ['A', 'C']]) assert.throws(() => parseVerdicts(JSON.stringify({ verdicts: ids.map(verdict) }), candidates, 1));
  assert.throws(() => parseVerdicts(JSON.stringify({ verdicts: [verdict('A'), verdict('B')] }), candidates, 2));
});
test('identical rewrites cannot receive different scores', () => {
  const candidates = [{ id: 'A', text: 'Same' }, { id: 'B', text: 'Same' }];
  assert.throws(() => parseVerdicts(JSON.stringify({ verdicts: [{ id: 'A', checks: [true], issues: [] }, { id: 'B', checks: [false], issues: ['failure'] }] }), candidates, 1));
});

test('single-candidate judging keeps the assigned identity and rejects malformed checks', () => {
  assert.deepEqual(parseSingleVerdict('```json\n{"checks":[true,false],"issues":["voice changed"]}\n```', 'A', 2), { id: 'A', checks: [true, false], issues: ['voice changed'] });
  assert.throws(() => parseSingleVerdict('{"checks":["true"],"issues":[]}', 'A', 1));
  assert.throws(() => parseSingleVerdict('{"checks":[true],"issues":[42]}', 'A', 1));
});
