import { readFile, writeFile, realpath } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareCalibration, summarizeCalibration, compareHuman } from './calibration.ts';
import type { Response, HumanAssessment } from './calibration.ts';
import { isOutsideRepository } from './core.ts';

const [mode, inputFile, outputFile, responsesFile, humansFile] = process.argv.slice(2);
if (!['prepare', 'score'].includes(mode) || !inputFile || !outputFile || (mode === 'score' && !responsesFile)) {
  throw Error('Usage: node evals/calibrate.ts prepare|score INPUT OUTPUT [RESPONSES] [HUMANS]');
}
const repository = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const output = resolve(outputFile);
const outputDirectory = await realpath(dirname(output));
if (!isOutsideRepository(repository, outputDirectory)) throw Error('Write calibration output outside the repository.');
const destination = await realpath(output).catch(error => {
  if (error.code === 'ENOENT') return resolve(outputDirectory, basename(output));
  throw error;
});
if (!isOutsideRepository(repository, destination)) throw Error('Write calibration output outside the repository.');
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));
const seed = process.env.EVAL_CALIBRATION_SEED ?? 'brundlefly-calibration-v1';
const plan = prepareCalibration(await read(inputFile), seed);
let value: unknown = plan;
if (mode === 'score') {
  const responses = await read(responsesFile);
  const humans = humansFile ? await read(humansFile) : [];
  if (!Array.isArray(responses) || !Array.isArray(humans)) throw Error('Provide response and human assessment arrays.');
  value = { protocol: plan.protocol, inputsHash: plan.inputsHash, seed, rows: summarizeCalibration(plan, responses as Response[]), humanCalibration: compareHuman(plan, responses as Response[], humans as HumanAssessment[]) };
}
await writeFile(destination, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
console.log(`${mode}: ${plan.entries.length} candidates, ${plan.requests.length} distinct edits`);
