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

readme extends write-human through a generated directory in references/write-human.
skills/write-human is the source of truth. Edit shared writing rules there.
The generator copies the complete directory, preserving relative links and license notices.
It names the bundled SKILL.md rules.md to avoid discovery as a second installed skill.
Never edit the generated directory directly.

From the repository root, run these commands with Node 24 or newer:

```sh
node scripts/sync-readme-bundle.mts
node scripts/sync-readme-bundle.mts --check
```

The first command updates the bundle. The second reports drift without writing files.
If the bundle differs, the check exits with code 1.
CI runs the check when either skill or its generator changes.
Installed skills need no generation command or Node runtime.
