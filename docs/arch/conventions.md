# Repository conventions

This collection follows the [Agent Skills specification](https://agentskills.io/specification).
It uses the collection layout shown by [Anthropic](https://github.com/anthropics/skills) and [Vercel](https://github.com/vercel-labs/agent-skills).

Each skill has its own directory under skills.
SKILL.md starts with name and description metadata.
Supporting files stay within the same skill directory.
References load only when the instructions need them.

Repository branding lives in assets, outside installable skill directories.
That keeps image masters and archived concepts out of an individual skill installation.

No npm runtime, package exports, or build output are required for Markdown skills.
Provider-specific plugin packaging can be added when a consumer requires it.

write-human adapts the owner's humanize-writing instructions.
Its personal skill links are replaced by self-contained source and copy-review rules.
It preserves the upstream MIT notice in its own directory.

readme extends write-human through a bundled copy in references/write-human.md.
The bundle includes its research reference and MIT notice.
When changing shared writing rules, update the bundled copy in the same change.
Keep the copy identical apart from its relative research link.
