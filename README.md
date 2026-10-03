![BRUNDLEFLY with its mascot's claws hanging below the banner](assets/brand/github-banner-overhang-gross.png)

# Brundlefly

A collection of self-contained [Agent Skills](https://agentskills.io/specification).

## Skills

| Skill | Use |
| --- | --- |
| [write-human](skills/write-human/SKILL.md) | Remove generated-sounding writing habits while preserving meaning and voice. |
| [technical-guide](skills/technical-guide/SKILL.md) | Research, write, verify, or refresh technical guides with working examples. |
| [pr](skills/pr/SKILL.md) | Prepare, open, or update PRs using the target repository's rules and contributor conventions. |

Choose the skill that owns your task. Each skill works alone.
Use write-human for prose edits, technical-guide for a verified reader workflow, and pr for review submission.
Keep personal stories in their author's voice, rather than forcing a guide structure.

## Use locally

Copy the complete skill directory into your agent's supported skills directory.
For Codex on Linux or macOS:

```sh
mkdir -p ~/.agents/skills
cp -R skills/write-human ~/.agents/skills/write-human
```

If you use skilld, load the skill without installing it:

```sh
skilld run ./skills/write-human --json
```

Example request:

```text
Use write-human to edit this draft. Preserve its facts, uncertainty, and voice.
```

For the other workflows:

```text
Use technical-guide to refresh this tutorial against the supported release. Verify its examples.
Use pr to submit these changes. Follow the repository template and recent maintainer conventions.
```

GitHub publication through pr needs an authorized GitHub integration.
Technical-guide uses the target's tools to verify examples and reports unavailable checks.
Each skill works without another Brundlefly skill or personal infrastructure.

## Quality

Read the [comparison and improvement plan](docs/ideas/skill-quality.md).
Quality claims need task-matched comparisons and human review.

## Brand assets

- [GitHub avatar](assets/brand/github-avatar.png)
- [README banner](assets/brand/github-banner-overhang-gross.png)
- [Repository social preview](assets/brand/github-social-preview.jpg)
- [Character sheet](assets/brand/character-sheet.png)
- [Brand rules](docs/arch/brand.md)

High-resolution originals live in assets/source.
Earlier concepts live in assets/archive.
Generation prompts live in assets/prompts.

## Writing comparisons

See the [published-case pilot](evals/README.md) for sources and reproducible comparisons.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md).

## License

The skill instructions use the [MIT license](LICENSE.md).
## Local review UI

Compare existing writing outputs or generate an approved guide demo with OpenCode.
See [setup and review instructions](evals/ui/README.md).
