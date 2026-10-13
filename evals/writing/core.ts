import { createHash } from 'node:crypto';
import { relative, isAbsolute, sep, posix } from 'node:path';

export const hash = (text: string) => createHash('sha256').update(text).digest('hex');

// Tool-free comparisons preload inline-linked Markdown. This measures the supplied
// instructions, rather than an agent's ability to select references with tools.
export async function loadInstructionBundle(read: (path: string) => Promise<string>): Promise<{
  instructions: string;
  fileHashes: Record<string, string>;
}> {
  const files = new Map<string, string>();
  async function visit(path: string): Promise<void> {
    if (files.has(path)) return;
    const text = await read(path);
    if (typeof text !== 'string') throw Error(`Missing Skill reference: ${path}`);
    files.set(path, text);
    for (const match of text.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      const target = decodeURIComponent(match[1]).split(/[?#]/)[0];
      if (!target || /^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//') || !target.endsWith('.md')) continue;
      const destination = posix.normalize(posix.join(posix.dirname(path), target));
      if (target.startsWith('/') || target.includes('\\') || destination === '..' || destination.startsWith('../')) {
        throw Error(`Reference is outside the Skill: ${target}`);
      }
      await visit(destination);
    }
  }
  await visit('SKILL.md');
  return {
    instructions: [...files].map(([path, text]) => `\nBundled file: ${path}\n${text}`).join('\n'),
    fileHashes: Object.fromEntries([...files].map(([path, text]) => [path, hash(text)])),
  };
}
export function isOutsideRepository(repository: string, scratch: string): boolean {
  const path = relative(repository, scratch);
  return path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
}
export type Candidate = { variant: string; text: string };
export type BlindCandidate = { id: string; text: string };
export type Verdict = { id: string; checks: boolean[]; issues: string[] };
const parseJson = (text: string): unknown => JSON.parse(text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1'));

export function extractText(trace: string): string {
  const events = trace.trim().split('\n').map(line => JSON.parse(line));
  if (events.some(event => event.type === 'error')) throw Error('OpenCode returned an error');
  if (events.some(event => event.type === 'tool_use' || event.part?.type === 'tool')) throw Error('Tool use invalidates isolation');
  const text = events.filter(event => event.type === 'text').map(event => event.part.text).join('');
  if (!text) throw Error('OpenCode returned no text');
  return text;
}

export function parseRewrite(text: string): string {
  const value = parseJson(text) as { text?: unknown };
  if (typeof value.text !== 'string' || !value.text.trim()) throw Error('Expected nonempty rewrite text');
  return value.text;
}

export function blind(candidates: Candidate[], seed: string): { candidates: BlindCandidate[]; mapping: Record<string, string> } {
  const shuffled = [...candidates].sort((a, b) => hash(seed + a.variant).localeCompare(hash(seed + b.variant)));
  const mapping: Record<string, string> = {};
  return { candidates: shuffled.map((candidate, index) => {
    const id = String.fromCharCode(65 + index);
    mapping[id] = candidate.variant;
    return { id, text: candidate.text };
  }), mapping };
}

export function parseVerdicts(text: string, candidates: BlindCandidate[], checkCount: number): Verdict[] {
  const value = parseJson(text) as { verdicts?: unknown[] };
  if (!Array.isArray(value.verdicts) || value.verdicts.length !== candidates.length) throw Error('Incomplete verdicts');
  const ids = new Set<string>();
  const verdicts: Verdict[] = value.verdicts.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw Error('Invalid verdict');
    const verdict = item as Record<string, unknown>;
    if (typeof verdict.id !== 'string' || !candidates.some(candidate => candidate.id === verdict.id) || ids.has(verdict.id)) throw Error('Invalid candidate ID');
    ids.add(verdict.id);
    if (!Array.isArray(verdict.checks) || verdict.checks.length !== checkCount || verdict.checks.some(check => typeof check !== 'boolean')) throw Error('Invalid checks');
    if (!Array.isArray(verdict.issues) || verdict.issues.some(issue => typeof issue !== 'string')) throw Error('Invalid issues');
    return verdict as Verdict;
  });
  for (const candidate of candidates) {
    for (const other of candidates.filter(other => other.id !== candidate.id && other.text === candidate.text)) {
      const left = verdicts.find(verdict => verdict.id === candidate.id)!;
      const right = verdicts.find(verdict => verdict.id === other.id)!;
      if (JSON.stringify(left.checks) !== JSON.stringify(right.checks)) throw Error('Identical outputs received different verdicts');
    }
  }
  return verdicts;
}

export function parseSingleVerdict(text: string, id: string, checkCount: number): Verdict {
  const value = parseJson(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid verdict');
  return parseVerdicts(JSON.stringify({ verdicts: [{ ...value, id }] }), [{ id, text: '' }], checkCount)[0];
}
