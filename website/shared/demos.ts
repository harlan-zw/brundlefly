export type Result<T> = ({ _tag: 'Ok' } & T) | { _tag: 'Err', message: string }
export type GuidePurpose = 'tutorial' | 'how-to' | 'reference' | 'explanation'
export type ChangeType = 'feat' | 'fix' | 'docs' | 'refactor' | 'chore'

type Signal = { phrase: string, suggestion: string, start: number, end: number }
const patterns = [
  { regex: /\bit(?:'s| is) worth noting(?: that)?\b/gi, suggestion: 'Lead with the useful point. Keep any uncertainty that matters.' },
  { regex: /\butilize\b/gi, suggestion: 'Consider “use” if it preserves the meaning.' },
  { regex: /\bin order to\b/gi, suggestion: 'Consider “to” if it preserves the meaning.' },
  { regex: /\bdelve into\b/gi, suggestion: 'Name the action, such as examine or explain.' },
  { regex: /\bseamless\b/gi, suggestion: 'State the supported benefit. Keep this word if it describes a real property.' },
  { regex: /\bin today(?:'s|’s) fast-paced(?: world)?\b/gi, suggestion: 'Check whether this opening adds useful context.' },
  { regex: /—/g, suggestion: 'Consider a comma, colon, or separate sentence.' },
]

export function analyzeWriting(source: string): Result<{ source: string, signals: Signal[] }> {
  if (!source.trim()) return { _tag: 'Err', message: 'Add some text first.' }
  if (source.length > 6000) return { _tag: 'Err', message: 'Keep the text under 6,001 characters.' }
  const signals = patterns.flatMap(({ regex, suggestion }) =>
    [...source.matchAll(regex)].map(match => ({ phrase: match[0], suggestion, start: match.index, end: match.index + match[0].length })),
  ).sort((a, b) => a.start - b.start)
  return { _tag: 'Ok', source, signals }
}

const structures: Record<GuidePurpose, string[]> = {
  tutorial: ['Starting point', 'Build the first working example', 'Extend the example', 'Check the result'],
  'how-to': ['Prerequisites', 'Steps', 'Verify the result', 'Troubleshooting'],
  reference: ['Public names', 'Inputs and outputs', 'Examples', 'Limits and errors'],
  explanation: ['The problem', 'How it works', 'Trade-offs', 'Supported evidence'],
}

export function createGuide(input: { task: string, reader: string, purpose: GuidePurpose }): Result<{ output: string }> {
  if (!input.task.trim()) return { _tag: 'Err', message: 'Add the task your reader needs to complete.' }
  if (!input.reader.trim()) return { _tag: 'Err', message: 'Add the intended reader.' }
  if (input.task.length > 160 || input.reader.length > 160) return { _tag: 'Err', message: 'Keep each field under 161 characters.' }
  const headings = structures[input.purpose]
  const output = `# ${input.task.trim()}\n\nReader: ${input.reader.trim()}\n\n${headings.map(heading => `## ${heading}\n\n`).join('')}## Evidence to collect\n\n- Supported version and official sources.\n- Commands and their observed results.\n- Facts that still need verification.\n`
  return { _tag: 'Ok', output }
}

export function createPullRequest(input: { type: ChangeType, scope: string, change: string, why: string }): Result<{ title: string, output: string }> {
  if (!input.change.trim() || !input.why.trim()) return { _tag: 'Err', message: 'Add the change and the reason for it.' }
  if (input.scope && !/^[a-z0-9][a-z0-9-]*$/.test(input.scope)) return { _tag: 'Err', message: 'Use lowercase letters, numbers, and single hyphens for the scope.' }
  if (input.why.length > 2000) return { _tag: 'Err', message: 'Keep the reason under 2,001 characters.' }
  const title = `${input.type}${input.scope ? `(${input.scope})` : ''}: ${input.change.trim().replace(/\.$/, '')}`
  if (title.length >= 70) return { _tag: 'Err', message: 'Keep the title under 70 characters.' }
  return { _tag: 'Ok', title, output: `${title}\n\n## Description\n\n${input.why.trim()}\n\n${input.change.trim()}${/[.!?]$/.test(input.change.trim()) ? '' : '.'}\n` }
}
