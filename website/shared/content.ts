export const skills = [
  { name: 'im-part-human', description: 'Edit prose for its human reader: clear meaning, accessible structure, accurate claims, and preserved voice.' },
  { name: 'technical-guide', description: "Research, write, or refresh technical guides around the reader's task, with verified examples." },
  { name: 'release-notes', description: 'Write release notes that help readers decide whether to upgrade and understand required changes.' },
  { name: 'pull-request-summary', description: 'Give reviewers the context they need through PR descriptions grounded in the change and repository conventions.' },
  { name: 'im-not-a-human', description: 'Compress text for agents' },
  { name: 'readme', description: 'Write a README that explains why the project matters and helps the reader complete a first task.' },
  { name: 'glossary', description: 'Create or audit GLOSSARY.md so readers can understand product terms and their meanings.' },
  { name: 'copywriting', description: 'Create or audit COPY.md, then write consistent copy around what the reader knows and needs.' },
  { name: 'slop-naming-recovery', description: 'Extend im-part-human with names grounded in what the product helps users do. It also works alone.' },
  { name: 'clarity', description: 'Review wording, reading order, and accessibility, including ADHD and dyslexia needs, while preserving claims and voice.' },
  { name: 'claim-fidelity', description: 'Compare a rewrite with its source for changed claims, conditions, uncertainty, and attribution.' },
  { name: 'verify-examples', description: 'Check runnable documentation examples against their stated setup and promised outcomes.' },
] as const

export type SkillName = typeof skills[number]['name']
