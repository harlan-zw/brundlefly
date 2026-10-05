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

readme owns README structure, positioning, and reader-path checks.
It carries its own positioning reference and a short writing checklist.
It can use an available write-human skill for a prose review, without requiring it.
Keep readme's positioning reference separate from write-human's instructions and references.

The optional Nuxt website lives in website, outside the installable skill directories.
It has its own dependency graph and Cloudflare deployment workflow.
Its browser-local demos illustrate workflow parts rather than executing the full skills.
Build scripts copy canonical assets and complete skills from the collection.

The website contains a standalone brand-kit Nuxt app under website/apps/brand-kit.
Both apps extend website/layers/brand. The downloadable layer includes its own public assets.
The combined static build mounts the kit under /brand-kit/.
