# ![Brundlefly, with its mascot's claws hanging below the banner](https://github.com/harlan-zw/brundlefly/raw/main/assets/brand/github-banner-overhang-gross.png)

> Agent skills for writing that's part human.

<a href="https://skilld.dev/gh/harlan-zw/brundlefly">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://skilld.dev/b/harlan-zw/brundlefly?theme=dark">
    <source media="(prefers-color-scheme: light)" srcset="https://skilld.dev/b/harlan-zw/brundlefly?theme=light">
    <img alt="Skill repository on skilld.dev" src="https://skilld.dev/b/harlan-zw/brundlefly?theme=light">
  </picture>
</a>

## Why Brundlefly

<img src="https://github.com/harlan-zw/brundlefly/raw/main/assets/brand/github-avatar.png" width="80" height="80" align="left" alt="Brundlefly's face">

*One wing twitches.* I'm Brundlefly. Four arms, two legs, two wings that haven't agreed on anything.
A fly got mixed into me, and I still count which parts are m... *His jaw catches.* mine.
Around here, the fly is the agent. You let it help so someone understands you, then your sentences swell and stock phrases creep in.
You still want to recognise yourself in the result. Hh. So do I.

Harlan built me from humanize-writing in [Harlan Agent Kit](https://github.com/harlan-zw/harlan-agent-kit), now [im-not-a-fly](skills/im-not-a-fly/SKILL.md).
[Humanizer](https://github.com/blader/humanizer) and [Stop Slop](https://github.com/hardikpandya/stop-slop) already hunt AI writing patterns.
Harlan also needed [technical-guide](skills/technical-guide/SKILL.md) for examples a developer runs, and [pull-request-summary](skills/pull-request-summary/SKILL.md) for descriptions grounded in their change.

Some writing is for agents. Drop one exception and the work can change.
[im-a-fly](skills/im-a-fly/SKILL.md) compresses that text and keeps every rule and exception attached.
I came out with extras. I don't recommend it.

## Skills

Seven Skills, four hands. Two hands never put these down.

### [im-not-a-fly](skills/im-not-a-fly/SKILL.md)

For text a person will read: blogs, docs, release notes, tweets, email, or copy. The name is aspirational.

- 🔍 **Two passes**: surface wording first, then structure.
- 🧬 **Keeps what's yours**: meaning, facts, claim scope, uncertainty, and voice survive the edit.
- 🧹 **Leaves clear prose alone**: it changes a sentence only to fix a reading problem.
- 📖 **Story or reference**: tells Why as a story and keeps setup and guides direct.
- ♿ **Easier to read**: short blocks and findable headings for readers with varied attention and reading needs.

### [im-a-fly](skills/im-a-fly/SKILL.md)

For text an agent will act on: Markdown files, instructions, docs, and context. No arguments there.

- 🗜️ **Fewer tokens, same rules**: cuts filler and duplicates, and keeps every requirement, condition, and exception.
- 🧷 **Protected Markdown**: frontmatter, code, commands, links, and anchors stay verbatim.
- ⚖️ **Checked both ways**: every source rule maps to the result, and every result rule maps back to the source.
- 🚫 **No dialects**: plain compact Markdown, with no invented abbreviations or decoding legend.

### The other five

Each one does a narrower job.

#### [technical-guide](skills/technical-guide/SKILL.md)

Research, write, or refresh a technical guide.

- 🧭 **Fits the reader's task**: a tutorial, how-to, reference, or explanation, chosen from what the reader needs.
- 🧪 **Verified examples**: runs safe examples against current code and official sources, and reports checks it could not run.
- 🩹 **Small refreshes**: fixes the reader's problem and keeps useful examples, anchors, and voice.

#### [pull-request-summary](skills/pull-request-summary/SKILL.md)

Draft or check a PR description.

- 🔎 **Grounded in the diff**: checks every claim against the change and the repository's conventions.
- 📋 **Follows your template**: keeps required sections, checklists, and AI disclosures.
- 📤 **Text only**: returns the description, and your delivery workflow publishes it.

#### [readme](skills/readme/SKILL.md)

Write or refresh a README.

- 📖 **Story first**: researches why the project exists before writing Why.
- 🛠️ **Checked setup**: reads the source and CLI help before describing a command.
- 🗺️ **A reader's path**: splash, Why, features, and setup, then guides and API.

#### [glossary](skills/glossary/SKILL.md)

Create or audit GLOSSARY.md. One name per thing. I share mine with the collection.

- 📚 **One concept, one word**: records each product name and bans its synonyms.
- 🔗 **Relationship map**: shows how terms relate, which is where ambiguity hides.
- ✋ **No silent names**: proposes a new term and waits for approval.

#### [copywriting](skills/copywriting/SKILL.md)

Create or audit COPY.md, or write copy against it. Even I follow it.

- 🔒 **Canonical strings**: approved taglines and copy are never paraphrased.
- 🎚️ **Register per surface**: a button, an error, and a hero each get the right voice.
- 🚷 **Banned language**: each ban carries its reason, so near misses get caught too.

## Setup

Browse [Brundlefly on skilld.dev](https://skilld.dev/gh/harlan-zw/brundlefly).
Install the [skilld CLI](https://skilld.dev) if you do not have it.
Run the remote commands below once the Skills appear in the listing and your account can access their source.

### Run once

Ask your agent to run this command for a one-off prose edit:

```sh
skilld run harlan-zw/brundlefly/im-not-a-fly --json
```

This loads the instructions without installing the Skill. The agent reads them and follows them for your task.
Replace im-not-a-fly with another Skill name from Skills when you need a different task.

### Install

From your project's root, install a Skill for later sessions:

```sh
skilld install harlan-zw/brundlefly/im-not-a-fly
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
Use im-not-a-fly to edit docs/intro.md. Preserve its facts, uncertainty, and my voice.
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

Use im-not-a-fly for a draft or a named file. State what the reader needs and which facts or phrasing must stay.
Keep supplied personal experience in its author's voice. Separate storytelling from technical instructions.

```text
Use im-not-a-fly on this draft. Keep the personal story, cut filler, and preserve the uncertainty in my claims.
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

Use im-a-fly when agent instructions take too much context.
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

## Website

The [Nuxt website](website/README.md) uses canonical artwork and browser-local skill guidance.
Each skill download includes its required references and license.
