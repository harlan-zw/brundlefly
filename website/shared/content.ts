export const skills = [
  { name: 'write-human', description: 'Remove generated-sounding writing habits while preserving meaning and voice.' },
  { name: 'technical-guide', description: 'Research, write, verify, or refresh technical guides with working examples.' },
  { name: 'pull-request-summary', description: 'Draft or check PR descriptions against the change and repository conventions' },
  { name: 'agentify-text', description: 'Compress text for agents' },
  { name: 'readme', description: 'Write a README and establish its adoption case' },
] as const

export type SkillName = typeof skills[number]['name']
