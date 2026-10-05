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

I want someone to understand what I write. I use agents to help, but I still want to recognise myself in the result.
The sentences can swell. Stock phrases creep in. A personal draft becomes something anyone could have generated.

I started collecting writing instructions in [Harlan Agent Kit](https://github.com/harlan-zw/harlan-agent-kit), my personal collection of agent tools and Skills.
One of those was humanize-writing, which became write-human here.

Skills such as [Humanizer](https://github.com/blader/humanizer) and [Stop Slop](https://github.com/hardikpandya/stop-slop) already tackle AI writing patterns.
That work overlaps with write-human. If you need a prose cleanup Skill, those are options too.

I built Brundlefly around the rules I want across my writing, from a personal story to a guide or PR description.
I want prose to keep its voice, technical guides to have examples that work, and shorter context to keep the exceptions.
Keeping those instructions together lets me refine them around the same priorities, then share them outside my personal kit.
You can use the Skills that fit your work.
An agent can mutate the text. I want to keep what made it worth writing.

## Skills

| Skill | Use it to |
| --- | --- |
| [write-human](skills/write-human/SKILL.md) | Edit prose while preserving meaning, facts, and voice |
| [technical-guide](skills/technical-guide/SKILL.md) | Research or refresh technical guides and verify their examples |
| [pull-request-summary](skills/pull-request-summary/SKILL.md) | Draft or check PR descriptions against the diff and repository conventions |
| [agentify-text](skills/agentify-text/SKILL.md) | Reduce agent context while preserving facts, rules, and working links |
| [readme](skills/readme/SKILL.md) | Write a README with a grounded story and clear setup |
| [glossary](skills/glossary/SKILL.md) | Create or audit GLOSSARY.md for names, meanings, and relationships |
| [copywriting](skills/copywriting/SKILL.md) | Create or audit COPY.md for voice and canonical wording; write copy against it |

## Setup

Browse [Brundlefly on skilld.dev](https://skilld.dev/gh/harlan-zw/brundlefly).
Install the [skilld CLI](https://skilld.dev) if you do not have it.
Run the remote commands below once the Skills appear in the listing and your account can access their source.

### Run once

Ask your agent to run this command for a one-off prose edit:

```sh
skilld run harlan-zw/brundlefly/write-human --json
```

This loads the instructions without installing the Skill. The agent reads them and follows them for your task.
Replace write-human with another name from the Skills table when you need a different task.

### Install

From your project's root, install a Skill for later sessions:

```sh
skilld install harlan-zw/brundlefly/write-human
```

To install the collection instead:

```sh
skilld add harlan-zw/brundlefly --all
```

skilld installs into the current project and detects your agent targets.
Add --global to install for your account across projects. Add --agent codex to select Codex explicitly.
If private-source access requires authentication, run skilld auth login and check your GitHub App access on skilld.dev.

## Usage

Tell your agent which text to work on and what must survive the edit.
With installed Skills, describe the task in plain words. Name a Skill when you want to choose it explicitly.

```text
Use write-human to edit docs/intro.md. Preserve its facts, uncertainty, and my voice.
```

For a one-off task, give the agent both the load command and your request:

```text
Run skilld run harlan-zw/brundlefly/readme --json, then use those instructions to refresh README.md.
Keep the project story separate from setup. Verify the examples.
```

skilld run loads instructions; it does not perform the edit itself.
The agent reads any references named by the Skill before doing the work.
For remote supporting files, use the exact read commands and revision returned by skilld.
Review the result before publishing it.

## Guides

### Edit prose without losing your voice

Use write-human for a draft or a named file. State what the reader needs and which facts or phrasing must stay.
Keep supplied personal experience in its author's voice. Separate storytelling from technical instructions.

```text
Use write-human on this draft. Keep the personal story, cut filler, and preserve the uncertainty in my claims.
```

### Verify a technical guide

Use technical-guide to check a tutorial against current code and official sources.
It uses the target project's tools, runs safe examples, and reports unavailable checks.

```text
Refresh this tutorial against the supported release. Verify its commands and examples.
```

### Draft a pull request description

Give pull-request-summary the diff, repository conventions, and applicable template.
It returns description text. The caller owns publication; supplied inputs need no GitHub integration.

```text
Use pull-request-summary to check this description against the diff and template. Return the revised text.
```

### Compress text for agents

Use agentify-text when agent instructions take too much context.
Preserve conditions and exceptions, even when they cost tokens.

```text
Reduce tokens in AGENTS.md. Preserve every rule, exception, and working link.
```

### Write a README with a story and useful setup

Use readme to explain why the project exists, then give the reader a clear first task.
Keep the human story in Why and technical detail in its own sections.

```text
Refresh README.md. Ground Why in the supplied project history. Verify setup and make the guides easy to find.
```

### Establish names and meanings

Use glossary to create or audit GLOSSARY.md.
It maps concepts to their public names and identifies vocabulary drift. Approve unresolved naming choices before adopting them.

```text
Audit GLOSSARY.md against this repository. Keep established names and propose fixes for any drift.
```

### Keep voice and wording consistent

Use copywriting to create or audit COPY.md, or to write against its approved strings.
It preserves canonical wording and matches the voice to the surface.
Neither copywriting nor glossary creates VISION.md or a root document set automatically.

```text
Use copywriting to audit COPY.md and the README. Flag changed taglines and mismatched voice before rewriting.
```

### Compare writing edits

Read the [writing evaluation](evals/REPORT.md) for comparisons with
[Humanizer](https://github.com/blader/humanizer/blob/225a6f39ac85f76ee48dbad772ea4abe4ed6c9d8/SKILL.md)
and [Stop Slop](https://github.com/hardikpandya/stop-slop/blob/8da1f030185bdfe8471220585162991eaeb970e9/SKILL.md).
Use the [pilot instructions](evals/README.md) and [review UI setup](evals/ui/README.md) for local comparisons.
The [quality plan](docs/ideas/skill-quality.md) explains comparison scope and human review requirements.

### Use the brand assets

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
