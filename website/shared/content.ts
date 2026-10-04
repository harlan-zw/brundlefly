export const skills = [
  { name: 'write-human', description: 'Remove generated-sounding writing habits while preserving meaning and voice.' },
  { name: 'technical-guide', description: 'Research, write, verify, or refresh technical guides with working examples.' },
  { name: 'pr', description: 'Prepare, open, or update PRs using the target repository’s rules and contributor conventions.' },
] as const

export type SkillName = typeof skills[number]['name']
