# ![Brundlefly, with its mascot's claws hanging below the banner](https://github.com/harlan-zw/brundlefly/raw/main/assets/brand/github-banner-overhang-gross.png)

> Agent skills for human mutations

<a href="https://skilld.dev/gh/harlan-zw/brundlefly">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://skilld.dev/b/harlan-zw/brundlefly?theme=dark">
    <source media="(prefers-color-scheme: light)" srcset="https://skilld.dev/b/harlan-zw/brundlefly?theme=light">
    <img alt="Skill repository on skilld.dev" src="https://skilld.dev/b/harlan-zw/brundlefly?theme=light">
  </picture>
</a>

## Why Brundlefly

Brundlefly combines approaches from existing skills to shape writing for people and agents.
Edit prose for meaning and voice. Compress instructions while preserving their rules.
For guides and repository work, check examples and follow the target project's conventions.

The [writing evaluation](evals/REPORT.md) compares prose edits with
[Humanizer](https://github.com/blader/humanizer/blob/225a6f39ac85f76ee48dbad772ea4abe4ed6c9d8/SKILL.md)
and [Stop Slop](https://github.com/hardikpandya/stop-slop/blob/8da1f030185bdfe8471220585162991eaeb970e9/SKILL.md).
It records observed results and measurement limits.
Each skill carries its own references, so the workflows travel between repositories without a personal checkout or private services.

## Features

- ✍️ **Facts and voice:** edit prose while preserving claim scope, uncertainty, and the author's voice.
- 🔍 **Checked guide examples:** inspect current code and run safe examples, with unavailable checks called out.
- 🔀 **Repository conventions:** prepare review submissions using the target project's rules and templates.
- 🗜️ **Smaller agent context:** reduce tokens while preserving facts, constraints, and working links.
- 📦 **Self-contained workflows:** carry each skill's required references with it, without a sibling skill dependency.

## Setup

Use an agent that supports the [Agent Skills format](https://agentskills.io/specification).
Clone this repository with Git, then run the examples from its root:

```sh
git clone https://github.com/harlan-zw/brundlefly.git
cd brundlefly
```

Copy the skill collection into your agent's supported skills directory.
For Codex on Linux or macOS:

If matching skill directories already exist in ~/.agents/skills, review them before replacing them.
Run this copy command when those destinations are absent.

```sh
mkdir -p ~/.agents/skills
cp -R skills/. ~/.agents/skills/
```

The copy includes each skill's instructions, references, and license.
Your agent reads the descriptions to find the skill that matches your request.
It loads that skill's full instructions when the task calls for them.
See [how Agent Skills work](https://agentskills.io/home#how-do-agent-skills-work).

Ask your agent:

```text
Refresh README.md. Follow this repository's conventions and verify the setup examples.
```

If you already have skilld, load the instructions without installing the skill:

```sh
skilld run ./skills/readme --json
```

This prints the skill instructions and supporting-file read commands. It writes no installed skill files.
Pass the instructions to your agent and read the references they name.

## Guides

### Skills

Describe the outcome you want. Your agent selects a skill from its description.
You can name a skill when you want to request it explicitly.

| Skill | Task described in its trigger |
| --- | --- |
| [write-human](skills/write-human/SKILL.md) | Edit prose for meaning and voice |
| [technical-guide](skills/technical-guide/SKILL.md) | Research, verify, or refresh technical guides |
| [pull-request-summary](skills/pull-request-summary/SKILL.md) | Draft or check PR descriptions against the change and repository conventions |
| [agentify-text](skills/agentify-text/SKILL.md) | Compress text for agents |
| [readme](skills/readme/SKILL.md) | Write a README and establish its adoption case |

```text
Edit this draft. Preserve its facts, uncertainty, and voice.
Refresh this tutorial against the supported release. Verify its examples.
Use pull-request-summary to check this PR description against the diff and repository template. Return the revised text.
Reduce tokens in this Markdown file. Preserve its rules, exceptions, and working links.
```

A delivery Skill can call pull-request-summary and supply its own description policy.
The caller owns publication. Supplied inputs need no GitHub integration.
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
