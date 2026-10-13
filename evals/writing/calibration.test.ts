import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareCalibration, parseAssessment, summarizeCalibration, compareHuman } from './calibration.ts';

const input = [{ id: 'approved', source: 'Original.', task: 'Preserve meaning.', provenance: 'Approved source packet', candidates: [{ variant: 'copy-only', text: 'Original.' }, { variant: 'editor', text: 'Changed.' }] }];
const assessment = (fidelity = 'preserved', benefit = 'improved') => JSON.stringify({ fidelity, benefit, evidence: ['Specific reading change.'] });

test('copying receives no improvement without a model request', () => {
  const plan = prepareCalibration(input, 'seed');
  assert.equal(plan.requests.length, 1);
  const rows = summarizeCalibration(plan, [{ requestId: plan.requests[0].id, response: assessment() }]);
  assert.equal(rows.find(row => row.variant === 'copy-only')!.improved, 0);
  assert.equal(rows.find(row => row.variant === 'copy-only')!.unchanged, 1);
  assert.equal(rows.find(row => row.variant === 'editor')!.useful, 1);
});

test('unsupported improvements cannot count as useful, and uncertainty stays visible', () => {
  const plan = prepareCalibration(input, 'seed');
  assert.equal(summarizeCalibration(plan, [{ requestId: plan.requests[0].id, response: assessment('changed') }])[1].useful, 0);
  assert.equal(parseAssessment(assessment('uncertain', 'uncertain')).fidelity, 'uncertain');
  for (const text of [assessment('yes'), assessment('preserved', 'yes'), '{}', JSON.stringify({ fidelity: 'preserved', benefit: 'improved', evidence: [] })]) assert.throws(() => parseAssessment(text));
});

test('identical outputs share evidence and anonymous prompts omit editor names', () => {
  const plan = prepareCalibration([{ ...input[0], candidates: [...input[0].candidates, { variant: 'another-editor', text: 'Changed.' }] }], 'seed');
  assert.equal(plan.requests.length, 1);
  assert.ok(!plan.requests[0].prompt.includes('another-editor'));
  assert.equal(summarizeCalibration(plan, [{ requestId: plan.requests[0].id, response: assessment() }]).filter(row => row.useful === 1).length, 2);
});

test('missing and duplicate responses fail instead of producing partial rankings', () => {
  const plan = prepareCalibration(input, 'seed');
  assert.throws(() => summarizeCalibration(plan, []));
  const answer = { requestId: plan.requests[0].id, response: assessment() };
  assert.throws(() => summarizeCalibration(plan, [answer, answer]));
  assert.throws(() => prepareCalibration([...input, ...input], 'seed'));
});

test('human agreement counts assessed inputs and exposes disagreement without treating agents as humans', () => {
  const plan = prepareCalibration(input, 'seed');
  const answers = [{ requestId: plan.requests[0].id, response: assessment() }];
  assert.deepEqual(compareHuman(plan, answers, []), { assessed: 0, fidelityAgreement: 0, benefitAgreement: 0, disagreements: [] });
  const result = compareHuman(plan, answers, [{ requestId: plan.requests[0].id, assessor: 'Owner', fidelity: 'preserved', benefit: 'worse', evidence: ['Voice lost.'] }]);
  assert.equal(result.assessed, 1);
  assert.equal(result.fidelityAgreement, 1);
  assert.equal(result.benefitAgreement, 0);
  assert.equal(result.disagreements.length, 1);
});

test('changed inputs and source order cannot reuse stale assessments', () => {
  const first = prepareCalibration(input, 'first');
  const second = prepareCalibration(input, 'second');
  assert.notEqual(first.requests[0].id, second.requests[0].id);
  const answers = [{ requestId: first.requests[0].id, response: assessment() }];
  assert.throws(() => summarizeCalibration(second, answers));
  const changed = prepareCalibration([{ ...input[0], task: 'Preserve all punctuation.' }], 'first');
  assert.throws(() => summarizeCalibration(changed, answers));
});

test('input parsing rejects absent provenance and malformed candidates', () => {
  for (const value of [null, [], [{ ...input[0], provenance: '' }], [{ ...input[0], candidates: [{ variant: 'editor', text: 2 }] }], [{ ...input[0], candidates: [input[0].candidates[0], input[0].candidates[0]] }]]) assert.throws(() => prepareCalibration(value, 'seed'));
});

test('assessment enums reject arrays instead of coercing them to strings', () => {
  assert.throws(() => parseAssessment(JSON.stringify({ fidelity: ['preserved'], benefit: 'improved', evidence: ['Clearer.'] })));
  assert.throws(() => parseAssessment(JSON.stringify({ fidelity: 'preserved', benefit: ['improved'], evidence: ['Clearer.'] })));
});
