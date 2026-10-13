# ![Brundlefly, with its mascot's claws hanging below the banner](https://github.com/harlan-zw/brundlefly/raw/main/assets/brand/github-banner-overhang-gross.png)

> Agent skills for writing that's part human.

<a href="https://skilld.dev/gh/harlan-zw/brundlefly">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://skilld.dev/b/harlan-zw/brundlefly?theme=dark">
    <source media="(prefers-color-scheme: light)" srcset="https://skilld.dev/b/harlan-zw/brundlefly?theme=light">
    <img alt="Skill repository on skilld.dev" src="https://skilld.dev/b/harlan-zw/brundlefly?theme=light">
  </picture>
</a>

## I'm Brundlefly

<img src="https://github.com/harlan-zw/brundlefly/raw/main/assets/brand/github-avatar.png" width="80" height="80" align="left" alt="Brundlefly's face">

*One wing twitches.* I'm Brundlefly. Four arms, two legs, two wings that haven't agreed on anything.
I had a longer name once. This is the part that survived.

I used to write words for other people to say. Toasts, apologies, the odd eulogy.
I was good at making people sound like themselves.
Then there was a machine, and something small went in with me.

*He checks an empty palm.* Old habit. I reach for a pen.
My words squeeze through mouthparts built for something else now. I know how it feels when yours come out wrong.

Around here, the fly is the agent. I help its words reach the person who needs to understand them.
You still want to recognise yourself in the result. Hh. So do I. I still count which parts are mine.

*He glances at the eggs.* I'm stuck in this cave, tending my eggs.
I scratch sentences into the wall. It heals over them by morning, so I only rewrite the ones worth keeping.
I could use something to do.

## Skills

### [im-part-human](https://skilld.dev/gh/harlan-zw/brundlefly/im-part-human)

Edit text developers write for people: docs, posts, email, and copy.
Use [release-notes](#release-notes) to create or substantially revise release notes.

- 🔍 **Reader first**: understands the reader, respects attention, and shows empathy through clear explanations.
- ♿ **Accessible writing**: uses plain words, short blocks, and findable headings, including ADHD and dyslexia needs.
- 🧬 **Truth and voice**: verifies material claims, preserves meaning and uncertainty, and keeps the author's voice.

### [slop-naming-recovery](https://skilld.dev/gh/harlan-zw/brundlefly/slop-naming-recovery)

Fix slop naming that leaks from code into your UI.

- 🔍 **Product first**: traces code, UI, and glossary names against the product's purpose and users' tasks.
- 🧭 **Clear domain names**: proposes names with before and after examples, source evidence, and affected surfaces.
- ✋ **You choose**: gives numbered proposals to accept, keep, defer, or edit before approved renames.

### Other Workflow Skills

| Skill | Use |
| --- | --- |
| <a id="im-not-a-human"></a>[im-not-a-human](https://skilld.dev/gh/harlan-zw/brundlefly/im-not-a-human) | Compress text for agents while preserving every rule, condition, and exception. |
| <a id="release-notes"></a>[release-notes](https://skilld.dev/gh/harlan-zw/brundlefly/release-notes) | Write release notes from verified changes and explain required upgrades. |
| [technical-guide](https://skilld.dev/gh/harlan-zw/brundlefly/technical-guide) | Write or refresh technical guides with verified examples. |
| [pull-request-summary](https://skilld.dev/gh/harlan-zw/brundlefly/pull-request-summary) | Draft or check a PR description against the diff and template. |
| [readme](https://skilld.dev/gh/harlan-zw/brundlefly/readme) | Explain a project and verify its setup instructions. |
| [glossary](https://skilld.dev/gh/harlan-zw/brundlefly/glossary) | Create or audit GLOSSARY.md for consistent names and meanings. |
| [copywriting](https://skilld.dev/gh/harlan-zw/brundlefly/copywriting) | Create or audit COPY.md and write against its approved wording. |

## Setup

From your project's root, install one Skill with [skilld](https://skilld.dev):

```sh
npx skilld install harlan-zw/brundlefly/im-part-human
```

skilld pins the source commit and detects agent targets.
To select one, add `--agent codex`, `--agent claude-code`, or `--agent cursor`. Add `--global` for all projects.
For the collection, run `npx skilld add harlan-zw/brundlefly --all`. To update, run `npx skilld update`.

<details>
<summary><b>Other setup options</b></summary>

### Run once

Give your agent the Skill URL and a task:

```text
Read https://skilld.dev/gh/harlan-zw/brundlefly/im-part-human.md and use it to edit docs/intro.md.
Keep its facts, uncertainty, and my voice. Show me the proposed edit.
```

Your agent needs web access and must fetch supporting files when requested. Replace the file or paste your draft.
For another Skill, change the name in the URL. Install if your fetch tool summarizes the instructions.

### Install with skills

From your project's root, use the [skills CLI](https://github.com/vercel-labs/skills) from [skills.sh](https://skills.sh):

```sh
npx skills add harlan-zw/brundlefly --skill im-part-human
```

Leave out `--skill` to choose Skills. Add `-a codex` or `-a claude-code` for an agent, or `-g` globally.

### Claude Code plugin

```text
/plugin marketplace add harlan-zw/brundlefly
/plugin install brundlefly@brundlefly
```

Then name a Skill with its plugin namespace:

```text
/brundlefly:im-part-human Edit this draft. Preserve its facts, uncertainty, and voice.
```

### Cursor plugin

In Cursor's Customize panel, choose **From GitHub Repository** and enter `harlan-zw/brundlefly`.
Install the Brundlefly plugin from the imported marketplace.

### ChatGPT and Codex plugin

Codex uses skilld or skills above. For local ChatGPT plugins, follow [OpenAI's packaging guide](https://developers.openai.com/plugins/build/plugins).

</details>

## Usage

Name the text and what must stay. Describe the task, or name an installed Skill:

```text
Use im-part-human to edit docs/intro.md. Preserve its facts, uncertainty, and my voice.
```

Review the result before publishing it.

## Guides

<details>
<summary><b>Edit prose without losing your voice</b></summary>

Use im-part-human for a draft or file. State the reader's needs and which facts, phrasing, or experience must stay.

```text
Use im-part-human on this draft. Keep the personal story, cut filler, and preserve the uncertainty in my claims.
```

</details>

<details>
<summary><b>Verify a technical guide</b></summary>

Use technical-guide to check current code and official sources. It runs safe examples and reports unavailable checks.

```text
Refresh this tutorial against the supported release. Verify its commands and examples.
```

</details>

<details>
<summary><b>Draft a pull request description</b></summary>

Supply the diff, repository conventions, and template. The Skill returns text; your delivery workflow publishes it.
Paste the inputs to use it without GitHub access.

```text
Use pull-request-summary to check this description against the diff and template. Return the revised text.
```

</details>

<details>
<summary><b>Compress text for agents</b></summary>

Use im-not-a-human when agent instructions take too much context.
Preserve conditions and exceptions, even when they cost tokens.

```text
Reduce tokens in AGENTS.md. Preserve every rule, exception, and working link.
```

</details>

<details>
<summary><b>Write a README with a story and useful setup</b></summary>

Use readme to explain the project's purpose, then give a clear first task. Keep story and setup separate.

```text
Refresh README.md. Ground Why in the supplied project history. Verify setup and make the guides easy to find.
```

</details>

<details>
<summary><b>Establish names and meanings</b></summary>

Use glossary to create or audit GLOSSARY.md. Review names and meanings; approve unresolved choices before adopting them.

```text
Audit GLOSSARY.md against this repository. Keep established names and propose fixes for any drift.
```

</details>

<details>
<summary><b>Recover names from user tasks</b></summary>

Use slop-naming-recovery when technical labels hide a feature's meaning. It reviews names against purpose, audience, and user language.

```text
Use slop-naming-recovery to audit this feature's names. Trace artifact and attestation into code and UI.
Propose names based on user tasks. Show evidence and affected surfaces before renaming.
```

</details>

<details>
<summary><b>Keep voice and wording consistent</b></summary>

Use copywriting to create or audit COPY.md, or to write against its approved strings.
It preserves canonical wording and matches the voice to the surface.
Neither copywriting nor glossary creates VISION.md or other root documents unless you ask.

```text
Use copywriting to audit COPY.md and the README. Flag changed taglines and mismatched voice before rewriting.
```

</details>

<details>
<summary><b>Compare writing edits</b></summary>

Read the [writing evaluation](evals/writing/REPORT.md) for comparisons with
[Humanizer](https://github.com/blader/humanizer/blob/225a6f39ac85f76ee48dbad772ea4abe4ed6c9d8/SKILL.md)
and [Stop Slop](https://github.com/hardikpandya/stop-slop/blob/8da1f030185bdfe8471220585162991eaeb970e9/SKILL.md).
Use the [pilot instructions](evals/writing/README.md) and [review UI setup](evals/writing/ui/README.md) for local comparisons.
The [quality plan](docs/ideas/skill-quality.md) explains comparison scope and human review requirements.

</details>

<details>
<summary><b>Use the brand assets</b></summary>

Use the [README banner](assets/brand/github-banner-overhang-gross.png),
[GitHub avatar](assets/brand/github-avatar.png), or [social preview](assets/brand/github-social-preview.jpg).
Read the [brand rules](docs/arch/brand.md) before changing artwork.
The [character sheet](assets/brand/character-sheet.png) supplies anatomy references.

High-resolution originals live in assets/source. Earlier concepts live in assets/archive.
Generation prompts live in assets/prompts.

</details>

## Focused blocks

Workflow Skills bundle the blocks they need. Install a Block Skill for one focused pass.
See [repository conventions](docs/arch/conventions.md#workflow-skills-and-block-skills) for the bundle map.

| Block Skill | Focus |
| --- | --- |
| [clarity](https://skilld.dev/gh/harlan-zw/brundlefly/clarity) | Reader attention, clear wording, reading order, and accessible structure. |
| [claim-fidelity](https://skilld.dev/gh/harlan-zw/brundlefly/claim-fidelity) | Preserve claims, conditions, attribution, and uncertainty. |
| [verify-examples](https://skilld.dev/gh/harlan-zw/brundlefly/verify-examples) | Run documentation examples and check their promised results. |

```text
Use claim-fidelity to compare this rewrite with its source. Report changed meaning without editing either passage.
```

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) before adding a Skill.
Each Skill must work when its directory is copied alone.
After you change a description, run the [trigger evals](evals/triggers/README.md).

## License

The Skill instructions use the [MIT license](LICENSE.md).

## Website

The [Nuxt website](website/README.md) uses canonical artwork and browser-local Skill guidance.
Each Skill download includes its required references and license.
