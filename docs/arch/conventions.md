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
The root plugin.json uses the portable Agent Plugins format and includes OpenAI presentation metadata.
Claude Code and Cursor manifests live in .claude-plugin and .cursor-plugin.
Their marketplace files each point to the repository root as one Brundlefly plugin.
Every host reads the same skills directory. Never duplicate Skill instructions into provider directories.
Keep the name, version, description, author, homepage, repository, and license aligned across manifests.
Use COPY.md's approved tagline for plugin descriptions. Reuse the canonical avatar for plugin icons.
When releasing changed Skills, increase the plugin version in all three manifests together.
Validate Claude packaging with `claude plugin validate .` and `claude plugin validate .claude-plugin/marketplace.json`.

This follows [Hyperframes' packaging](https://github.com/heygen-com/hyperframes/tree/main/.claude-plugin),
adapted to [OpenAI's portable format](https://developers.openai.com/plugins/build/plugins)
and [Cursor's repository import](https://cursor.com/docs/reference/plugins).

im-not-a-fly adapts the owner's humanize-writing instructions.
Its personal skill links are replaced by self-contained source and copy-review rules.
It preserves the upstream MIT notice in its own directory.

readme owns README structure, positioning, and reader-path checks.
It carries its own positioning reference and a short writing checklist.
It can use an available im-not-a-fly skill for a prose review, without requiring it.
Keep readme's positioning reference separate from im-not-a-fly's instructions and references.

The optional Nuxt website lives in website, outside the installable skill directories.
It has its own dependency graph and Cloudflare deployment workflow.
Its browser-local demos illustrate workflow parts rather than executing the full skills.
Build scripts copy canonical assets and complete skills from the collection.

The website contains a standalone brand-kit Nuxt app under website/apps/brand-kit.
Both apps extend website/layers/brand. The downloadable layer includes its own public assets.
The combined static build mounts the kit under /brand-kit/.

glossary and copywriting adapt Harlan Agent Kit's naming and copy workflows.
Their references, templates, and MIT notices stay inside their own directories.
They follow the target project's delivery rules without requiring personal worktrees or sibling Skills.
Each repository keeps its own GLOSSARY.md and COPY.md. The portable Skills supply methods, not Brundlefly's brand vocabulary.
