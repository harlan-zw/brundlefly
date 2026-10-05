---
name: readme
description: "Create or refresh a repository README with a splash, project story, supported positioning, features, setup, and relevant guides or API reference. Use when writing a README, explaining why a project exists or why to adopt it, or aligning its documentation with repository conventions."
license: MIT
---

# README

Help a reader decide whether the project fits, then complete its first useful task.
This skill works without a sibling skill or personal checkout.
If write-human is available, use it for the final prose review.
It is optional; do not install it automatically.

## Inspect the project

Read the existing README, repository instructions, glossary, vision, contribution rules, and supplied copy rules.
Use the glossary's established product names and casing. Do not substitute synonyms for them.
Apply supplied wording bans within their stated scope. Preserve commands, identifiers, quotes, and required qualifications.
Existing prose shows vocabulary; it does not prove every sentence deserves reuse.
Inspect nearby READMEs when the user asks for collection conventions.
Local requirements and the user's requested structure take precedence over stylistic defaults.

Find approved splash assets, package metadata, supported tools, public entry points, examples, and documentation.
Research the adoption reason before drafting Why. Read [positioning guidance](references/positioning.md) for research and interview decisions.
Check the actual source and CLI help before describing behavior or choosing setup commands.
Distinguish the checkout from a published release. Do not claim registry availability from a package name alone.
Keep an evidence ledger outside the repository for uncertain claims and checks.
Ask only when missing information changes the reader's task materially.

## Build the reader's path

Use this order by default. Keep existing anchors when they remain useful.

| Section | Reader need |
| --- | --- |
| Splash | Approved banner or logo, project name, and a factual one-line description |
| Why | Why the project exists, what prompted it, and why that matters to the reader |
| Features | Supported capabilities with a useful benefit for each |
| Setup | Prerequisites, installation, and the smallest working example |
| Guides | Inline task guidance when dedicated guides do not cover it |
| API | Inline public reference when dedicated API docs do not cover it |

Splash describes the opening block. Do not add a literal Splash heading.
Name the Why heading after the project, such as "Why Brundlefly".
Treat Why as a chance to tell the project's human story. Follow the owner's requested emphasis.
Every story has a point of view. Establish whose perspective carries Why before drafting it.
If the author tells their own origin story, use their first-person voice: I, me, and my.
Use we only for a supported shared experience. Follow an explicitly requested narrator or perspective.
Do not replace the author's story with generic you or detached product narration.
Use supplied experience or documented origins to connect a concrete frustration with the decision to build the project.
When no origin is known, explain the reader's problem without inventing a founder story.
Competitive positioning can support Why; it does not have to be its opening or organizing structure.
Put capability lists in Features and usage details in Setup or Guides.
Keep story and technical detail in separate sections. Review their purposes separately.
If using write-human, request storytelling for Why and clear technical explanation for the task and reference sections.
When working alone, keep the same boundary: connect supported origins in Why; state prerequisites and actions directly in Setup.
Never carry narrative suspense or character arcs into instructions. Never bury a required step in the story.
Keep approved adoption reasons and useful evidence links. Removing filler must not erase their information.
If the owner requests only the problem, omit implementation detail and feature inventories. Preserve other approved points unless excluded.
Reuse approved assets and text. If artwork is absent, use a plain title and description.
If an approved banner carries the project name, it can serve as the H1 image with meaningful alt text.
Use the owner's approved tagline exactly. A blockquote can place it below the banner.
Use requested badges from the provider's documented embed. Include alt text and the intended destination.
Do not invent badges, slogans, support channels, measurements, or compatibility claims.

Write each feature as `- <emoji> **<feature>:** <why the feature is useful>`.
Keep the benefit concrete and supported. Preserve exact product terms.
Lead with reader-visible capabilities and outcomes. A list of skills, modules, or exports is an inventory, not necessarily Features.
Keep useful inventory in a separate discovery or reference section.
Use one capability per bullet by default. Follow an explicitly required format.
If bullets distort the project, use a short prose overview or a compact comparison table, or omit Features.
Explain that choice briefly in the handoff. Do not invent abstract benefits or ask merely to change the presentation.

Give setup commands a working directory and explain their expected result.
Use the project's package manager and documented runtime.
Show one common path before alternatives. Identify optional tools where they appear.
For a skill collection, show how to load or copy a complete skill and give an example request.
Lead with installing the collection, then asking for a task in natural language.
Explain that the agent matches installed descriptions to the task. Keep explicit skill selection as an optional override.
Check the host's discovery behavior before promising automatic activation. Do not present standard discovery as a unique feature.
Check for an existing destination before copying. Avoid nesting or replacing an installed skill without the reader's choice.
Do not invent a runtime API for a Markdown-only collection.

Decide guides and API coverage separately. A docs directory alone proves neither exists.
If dedicated docs cover the topic, link directly to them instead of duplicating the material.
If coverage is partial, include only the missing guidance or reference.
If the project has no public API, omit the API section.
Keep concise discovery links, contribution rules, attribution, and licenses where they serve the reader.

## Review and verify

Use plain words and direct sentences. Preserve required sections and the chosen feature presentation.
Keep product names, approved copy, commands, and links exact unless evidence supports a correction.
Preserve facts, qualifications, attribution, and voice. Cut repetition and unsupported claims.
Keep clear sentences unchanged. Remove unsupported claims rather than replacing them with invented evidence.
Keep review commentary outside README.md.
Apply the [Why review](references/positioning.md#review-why) before delivery, even when the prose sounds natural.
Judge generic wording by the sentence's purpose. Do not create a blacklist of ordinary words.

Compare the result with inspected evidence for names, conditions, claims, commands, and links.
Run safe setup examples from an isolated starting state when possible.
Respect authorization for installation, publication, and other external changes.
Check relative links and assets from the README's directory, including changed heading anchors.
Use the project's documentation renderer when available and inspect the rendered page.
If a check fails, fix the affected material and repeat that check.
Report unavailable checks in the handoff. Never call an untested reader path verified.

Deliver the requested file and a short handoff with observed repairs and verification limits.
Writing the README does not authorize publishing it under the user's name.
