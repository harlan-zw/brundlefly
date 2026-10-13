# ![Brundlefly, with its mascot's claws hanging below the banner](https://github.com/harlan-zw/brundlefly/raw/main/assets/brand/github-banner-overhang-gross.png)

> Agent skills for writing that's part human.

<a href="https://skilld.dev/gh/harlan-zw/brundlefly">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://skilld.dev/b/harlan-zw/brundlefly?theme=dark">
    <source media="(prefers-color-scheme: light)" srcset="https://skilld.dev/b/harlan-zw/brundlefly?theme=light">
    <img alt="Skill repository on skilld.dev" src="https://skilld.dev/b/harlan-zw/brundlefly?theme=light">
  </picture>
</a>

Brundlefly is a collection of Agent Skills for writing, editing, and compressing text.
Use it for docs, release notes, PR descriptions, and instructions for agents.

## Why Brundlefly?

Agent drafts can bury useful information in filler and repeated explanations.
These Skills put the reader's needs first.
Choose what matters, keep the facts and voice, then edit the wording.
Text for agents gets a separate pass that reduces tokens while preserving every rule.

## Features

- ✍️ **Prose editing**: cut filler and repetition while preserving meaning, uncertainty, and the author's voice.
- 🔍 **Checked claims**: verify release changes, technical examples, and PR descriptions against their sources.
- ♿ **Accessible writing**: use plain words, short blocks, and findable headings, including ADHD and dyslexia needs.
- 🗜️ **Less agent context**: compress instructions without dropping conditions or exceptions.
- 📦 **Self-contained Skills**: each directory includes its required references, templates, and license.

## Installation

From your project's root, install the collection with [skilld](https://skilld.dev):

```sh
npx skilld add harlan-zw/brundlefly --all
```

skilld detects your agent targets. Add `--agent codex`, `--agent claude-code`, or `--agent cursor` to select one.
Add `--global` to use the Skills across projects.

To install one Skill:

```sh
npx skilld install harlan-zw/brundlefly/im-part-human
```

To update installed Skills:

```sh
npx skilld update
```

<details>
<summary>Other installation methods</summary>

### Run once

Give your agent the Skill URL and a task. This installs nothing:

```text
Read https://skilld.dev/gh/harlan-zw/brundlefly/im-part-human.md and use it to edit docs/intro.md.
Keep its facts, uncertainty, and my voice. Show me the proposed edit.
```

Your agent needs web access and must fetch the supporting files when the Skill requests them.
Some fetch tools summarize long pages. Install the Skill if your agent cannot read its complete instructions.

### Install with skills

From your project's root, use the [skills CLI](https://github.com/vercel-labs/skills):

```sh
npx skills add harlan-zw/brundlefly --skill im-part-human
```

Leave out `--skill` to choose from the collection. Use `-a` to select an agent, or `-g` to install globally.

### Claude Code plugin

```text
/plugin marketplace add harlan-zw/brundlefly
/plugin install brundlefly@brundlefly
```

To select a Skill explicitly:

```text
/brundlefly:im-part-human Edit this draft. Preserve its facts, uncertainty, and voice.
```

### Cursor plugin

In Cursor's Customize panel, choose **From GitHub Repository** and enter `harlan-zw/brundlefly`.
Install Brundlefly from the imported marketplace.
The plugin reads the same `skills/` directories as the other installers.

</details>

## Usage

Ask your agent for the task. Installed Skill descriptions help it choose the relevant workflow.
You can name a Skill when you want a specific workflow.

```text
Edit docs/intro.md. Keep the facts and my voice. Put the main point first and cut repeated explanations.
```

```text
Use release-notes to write GitHub notes for v2.0.0 against v1.4.0.
Lead with important changes and required upgrade steps. Link to the full changelog.
```

```text
Use im-not-a-human to reduce tokens in AGENTS.md.
Preserve every rule, condition, exception, and working link.
```

You review the result. Writing Skills return text or file edits; your delivery workflow owns publication.

## Skills

### Workflow Skills

| Skill | Use |
| --- | --- |
| [im-part-human](https://skilld.dev/gh/harlan-zw/brundlefly/im-part-human) | Edit prose while preserving facts and voice. |
| [im-not-a-human](https://skilld.dev/gh/harlan-zw/brundlefly/im-not-a-human) | Compress text for agents while preserving every rule. |
| [release-notes](https://skilld.dev/gh/harlan-zw/brundlefly/release-notes) | Select release highlights, verify claims, and explain required upgrades. |
| [technical-guide](https://skilld.dev/gh/harlan-zw/brundlefly/technical-guide) | Write or refresh technical guides with verified examples. |
| [pull-request-summary](https://skilld.dev/gh/harlan-zw/brundlefly/pull-request-summary) | Draft or check a PR description against the diff and template. |
| [readme](https://skilld.dev/gh/harlan-zw/brundlefly/readme) | Explain a project and verify its setup instructions. |
| [glossary](https://skilld.dev/gh/harlan-zw/brundlefly/glossary) | Create or audit GLOSSARY.md for consistent names and meanings. |
| [copywriting](https://skilld.dev/gh/harlan-zw/brundlefly/copywriting) | Create or audit COPY.md and write copy against it. |
| [slop-naming-recovery](https://skilld.dev/gh/harlan-zw/brundlefly/slop-naming-recovery) | Review names against user tasks and propose clearer terms. |

### Block Skills

Workflow Skills include the blocks they need. You can also install a Block Skill for one focused pass.

| Skill | Use |
| --- | --- |
| [clarity](https://skilld.dev/gh/harlan-zw/brundlefly/clarity) | Review reader attention, wording, reading order, and accessibility. |
| [claim-fidelity](https://skilld.dev/gh/harlan-zw/brundlefly/claim-fidelity) | Check for changed claims, conditions, uncertainty, and attribution. |
| [verify-examples](https://skilld.dev/gh/harlan-zw/brundlefly/verify-examples) | Run documentation examples and check their promised outcomes. |

For example:

```text
Use claim-fidelity to compare this rewrite with its source.
Report changed meaning without editing either passage.
```

## Documentation

- [Read or download a complete Skill](https://brundlefly.dev).
- [Repository conventions](docs/arch/conventions.md), including which blocks each workflow bundles.
- [Writing evaluation](evals/writing/REPORT.md), with its comparison scope and limits.
- [Local writing comparisons](evals/writing/README.md) and [review UI setup](evals/writing/ui/README.md).
- [Quality plan](docs/ideas/skill-quality.md) and [trigger evaluations](evals/triggers/README.md).
- [Brand rules](docs/arch/brand.md), [README banner](assets/brand/github-banner-overhang-gross.png), [avatar](assets/brand/github-avatar.png), and [social preview](assets/brand/github-social-preview.jpg).
- [Website source](website/README.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before adding a Skill.
Each Skill must work when its directory is copied alone.
After changing a description, run the [trigger evaluations](evals/triggers/README.md).

## License

[MIT](LICENSE.md).
