export const skills = [
  { name: 'write-human', description: 'Remove generated-sounding writing habits while preserving meaning and voice.' },
  { name: 'technical-guide', description: 'Research, write, verify, or refresh technical guides with working examples.' },
  { name: 'pull-request-summary', description: 'Draft or check PR descriptions against the change and repository conventions' },
  { name: 'agentify-text', description: 'Compress text for agents' },
  { name: 'readme', description: 'Write a README and establish its adoption case' },
  { name: 'glossary', description: 'Create or audit GLOSSARY.md. Use before naming product concepts, writing user-visible terms, renaming concepts, or checking vocabulary drift and banned terms.' },
  { name: 'copywriting', description: 'Create or audit COPY.md and write user-visible strings against it. Use before writing marketing copy, UI labels, error messages, empty states, meta tags, or email, and when copy has drifted from the canonical strings.' },
] as const

export type SkillName = typeof skills[number]['name']
