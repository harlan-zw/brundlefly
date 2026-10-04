![BRUNDLEFLY with its mascot's claws hanging below the banner](assets/brand/github-banner-overhang-gross.png)

# Brundlefly

A collection of self-contained Agent Skills for writing and repository work.

## Why

Your agent needs different instructions for editing prose, verifying a guide, and submitting a PR.
Choose the skill for your task. Each directory includes the instructions and references it needs.
Copy one skill without bringing a personal checkout or private services with it.

## Features

- ✍️ **[write-human](skills/write-human/SKILL.md):** edit generated-sounding prose while preserving facts, uncertainty, and voice.
- 📖 **[technical-guide](skills/technical-guide/SKILL.md):** give readers supported instructions with checked examples and stated verification limits.
- 🔀 **[pr](skills/pr/SKILL.md):** prepare review submissions that follow the target repository's rules and templates.
- 🗜️ **[agentify-text](skills/agentify-text/SKILL.md):** reduce tokens while preserving facts, constraints, and working links.
- 🧾 **[readme](skills/readme/SKILL.md):** explain a project's value and setup using bundled write-human rules.

## Setup

Use an agent that supports the [Agent Skills format](https://agentskills.io/specification).
Clone this repository with Git, then run the examples from its root:

```sh
git clone https://github.com/harlan-zw/brundlefly.git
cd brundlefly
```

Copy a complete skill directory into your agent's supported skills directory.
For Codex on Linux or macOS:

If ~/.agents/skills/readme already exists, review it before replacing it.
Run the copy command only when that destination is absent.

```sh
mkdir -p ~/.agents/skills
cp -R skills/readme ~/.agents/skills/readme
```

The copy includes SKILL.md, bundled writing rules, the research reference, and the license.
For another skill, replace readme in both paths with its directory name.

Ask your agent:

```text
Use readme to refresh README.md. Follow this repository's conventions and verify the setup examples.
```

If you already have skilld, load the instructions without installing the skill:

```sh
skilld run ./skills/readme --json
```

This prints the skill instructions and supporting-file read commands. It writes no installed skill files.
Pass the instructions to your agent and read the references they name.

## Guides

### Skills

Use write-human for prose edits and technical-guide when the reader needs a verified technical workflow.
Use pr for submission, agentify-text for compression, and readme for the repository's opening documentation.

```text
Use write-human to edit this draft. Preserve its facts, uncertainty, and voice.
Use technical-guide to refresh this tutorial against the supported release. Verify its examples.
Use pr to submit these changes. Follow the repository template and recent maintainer conventions.
Use agentify-text to reduce tokens in this Markdown file. Preserve its rules, exceptions, and working links.
```

GitHub publication through pr needs an authorized GitHub integration.
Technical-guide uses the target project's tools and reports unavailable checks.
Keep personal stories in their author's voice.

For writing comparisons and local demos, read the [pilot instructions](evals/README.md)
and [review UI setup](evals/ui/README.md).
The [quality plan](docs/ideas/skill-quality.md) explains comparison scope and human review requirements.

### Brand assets

Use the [README banner](assets/brand/github-banner-overhang-gross.png),
[GitHub avatar](assets/brand/github-avatar.png), or [social preview](assets/brand/github-social-preview.jpg).
Read the [brand rules](docs/arch/brand.md) before changing artwork.
The [character sheet](assets/brand/character-sheet.png) supplies anatomy references.

High-resolution originals live in assets/source. Earlier concepts live in assets/archive.
Generation prompts live in assets/prompts.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) before adding a skill.
Each skill must work when its directory is copied alone.

## License

The skill instructions use the [MIT license](LICENSE.md).
