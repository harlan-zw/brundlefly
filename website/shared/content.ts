export const skills = [
  { name: 'im-not-a-fly', description: 'Edit prose for its human reader: clear meaning, accessible structure, accurate claims, and preserved voice.' },
  { name: 'technical-guide', description: "Research, write, or refresh technical guides around the reader's task, with verified examples." },
  { name: 'pull-request-summary', description: 'Give reviewers the context they need through PR descriptions grounded in the change and repository conventions.' },
  { name: 'im-a-fly', description: 'Compress text for agents' },
  { name: 'readme', description: 'Write a README that explains why the project matters and helps the reader complete a first task.' },
  { name: 'glossary', description: 'Create or audit GLOSSARY.md so readers can understand product terms and their meanings.' },
  { name: 'copywriting', description: 'Create or audit COPY.md, then write consistent copy around what the reader knows and needs.' },
  { name: 'clarity', description: 'Review wording, reading order, and accessibility, including ADHD and dyslexia needs, while preserving claims and voice.' },
  { name: 'claim-fidelity', description: 'Compare a rewrite with its source for changed claims, conditions, uncertainty, and attribution.' },
  { name: 'verify-examples', description: 'Check runnable documentation examples against their stated setup and promised outcomes.' },
] as const

export type SkillName = typeof skills[number]['name']
