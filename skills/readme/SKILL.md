---
name: readme
description: "Create or refresh a repository README with a splash, competitive positioning, features, setup, and relevant guides or API reference. Use when writing a README, explaining why to adopt a package, or aligning its documentation with repository conventions."
license: MIT
---

# README

Help a reader decide whether the project fits, then complete its first useful task.
This skill extends write-human. Read [the bundled writing rules](references/write-human/rules.md) before drafting.
The bundle works without a sibling skill or personal checkout.

## Inspect the project

Read the existing README, repository instructions, glossary, vision, contribution rules, and supplied copy rules.
Inspect nearby READMEs when the user asks for collection conventions.
Local requirements and the user's requested structure take precedence over stylistic defaults.

Find approved splash assets, package metadata, supported tools, public entry points, examples, and documentation.
Inspect relevant alternatives before claiming differentiation. Read [positioning guidance](references/positioning.md) for evidence and comparison boundaries.
Check the actual source and CLI help before describing behavior or choosing setup commands.
Distinguish the checkout from a published release. Do not claim registry availability from a package name alone.
Keep an evidence ledger outside the repository for uncertain claims and checks.
Ask only when missing information changes the reader's task materially.

## Build the reader's path

Use this order by default. Keep existing anchors when they remain useful.

| Section | Reader need |
| --- | --- |
| Splash | Approved banner or logo, project name, and a factual one-line description |
| Why | Why adopt this package over relevant alternatives, and which unmet problem it addresses |
| Features | Supported capabilities with a useful benefit for each |
| Setup | Prerequisites, installation, and the smallest working example |
| Guides | Inline task guidance when dedicated guides do not cover it |
| API | Inline public reference when dedicated API docs do not cover it |

Splash describes the opening block. Do not add a literal Splash heading.
Name the Why heading after the project, such as "Why Brundlefly".
Reuse approved assets and text. If artwork is absent, use a plain title and description.
Do not invent badges, slogans, support channels, measurements, or compatibility claims.

Write each feature as `- <emoji> **<feature>:** <why the feature is useful>`.
Keep the benefit concrete and supported. Preserve exact product terms.
Use one feature per bullet. Do not turn the features into prose during the writing pass.

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

Apply both bundled writing passes. Preserve required sections and feature syntax.
Keep clear sentences unchanged. Remove unsupported claims rather than replacing them with invented evidence.
Keep review commentary outside README.md.

Compare the result with inspected evidence for names, conditions, claims, commands, and links.
Run safe setup examples from an isolated starting state when possible.
Respect authorization for installation, publication, and other external changes.
Check relative links and assets from the README's directory, including changed heading anchors.
Use the project's documentation renderer when available and inspect the rendered page.
If a check fails, fix the affected material and repeat that check.
Report unavailable checks in the handoff. Never call an untested reader path verified.

Deliver the requested file and a short handoff with observed repairs and verification limits.
Writing the README does not authorize publishing it under the user's name.
