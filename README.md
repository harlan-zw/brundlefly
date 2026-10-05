# ![Brundlefly, with its mascot's claws hanging below the banner](https://github.com/harlan-zw/brundlefly/raw/main/assets/brand/github-banner-overhang-gross.png)

> Agent skills for grotesque text mutations.

<a href="https://skilld.dev/gh/harlan-zw/brundlefly">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://skilld.dev/b/harlan-zw/brundlefly?theme=dark">
    <source media="(prefers-color-scheme: light)" srcset="https://skilld.dev/b/harlan-zw/brundlefly?theme=light">
    <img alt="Skill repository on skilld.dev" src="https://skilld.dev/b/harlan-zw/brundlefly?theme=light">
  </picture>
</a>

## Why Brundlefly

You write because you want someone to understand.
Then an agent gets hold of the draft. The sentences swell. Stock phrases creep in. Your voice gets harder to find.

That is the slop Brundlefly cares about: words piling up between you and the person you wanted to reach.
Shortening the text can go wrong too. An agent can strip out the exception that held your meaning together.

write-human grew out of personal instructions for editing prose, called humanize-writing.
Brundlefly gives those instructions a home outside a personal collection, so you can use them with your own agent.
The collection carries that concern into guides, pull request descriptions, READMEs, and agent context.
Empathy has practical work to do here: explain the unfamiliar term, respect the reader's attention, keep the example usable.

The mascot is caught between flesh and something inhuman. The writing gets to change too, with its meaning still worth protecting.

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
| [glossary](skills/glossary/SKILL.md) | Create or audit GLOSSARY.md for names, meanings, and relationships |
| [copywriting](skills/copywriting/SKILL.md) | Create or audit COPY.md for voice and canonical wording; write copy against it |

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
glossary and copywriting each own one requested artifact. Neither creates VISION.md or a root document set automatically.

For writing comparisons and local demos, read the [writing evaluation](evals/REPORT.md), [pilot instructions](evals/README.md),
and [review UI setup](evals/ui/README.md).
The [quality plan](docs/ideas/skill-quality.md) explains comparison scope and human review requirements.
The writing evaluation compares prose edits with
[Humanizer](https://github.com/blader/humanizer/blob/225a6f39ac85f76ee48dbad772ea4abe4ed6c9d8/SKILL.md)
and [Stop Slop](https://github.com/hardikpandya/stop-slop/blob/8da1f030185bdfe8471220585162991eaeb970e9/SKILL.md).

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
