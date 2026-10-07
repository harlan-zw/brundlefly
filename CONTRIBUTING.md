# Contributing

Each skill lives at skills/name/SKILL.md.
Use lowercase letters, numbers, and single hyphens in its name.
The frontmatter name must match its directory.
Include a description stating what it does and when to use it.

Bundle required references, scripts, and templates inside the skill directory.
Keep optional tool requirements explicit.
Use the Agent Skills format rather than a provider-specific plugin structure.

Use a Workflow Skill for a complete task and a Block Skill for one focused pass.
Both live directly under skills. Group detailed reference material inside its owning Skill.
Before adding a block, define its input, output, trigger, and limits.
Keep each block useful when installed alone.

Edit block instructions in their own SKILL.md.
The consumer map in scripts/sync-blocks.ts declares which workflows bundle each block.
Run `node scripts/sync-blocks.ts` after changing a block or its consumers.
Never edit the generated files in references/blocks by hand.
Run `node scripts/sync-blocks.ts --check` before submission. CI checks the same copies.
When a block needs supporting files, extend the bundling step before adding dependent references.

Check local loading with skilld run and inspect the returned metadata and instructions.
For writing skills, review rewrites for changed facts, scope, uncertainty, and voice.
Prefer real before-and-after examples over word-count or file-shape assertions.

Read the brand rules before changing images.
Keep exploration assets separate from canonical assets.
Preserve authorship and license notices when adapting an existing skill.
