---
name: technical-guide
description: "Research, write, verify, or refresh technical guides against current code and official sources. Use for tutorials, how-to guides, developer documentation, or stale instructions that need working examples."
license: MIT
---

# Technical guide

Help a reader complete or understand a technical task with accurate information and useful examples.
Create a guide or refresh an existing one. Keep each change within the requested scope.

## 1. Establish the reader's task

Read the target's instructions, contribution rules, terminology, style guide, and nearby documentation.
Use established rules and filenames. A missing editorial framework does not require creating one.
Read an existing page in full before editing it.

Identify the reader, starting knowledge, desired outcome, supported version, and destination.
Respect their time and knowledge. Do not explain prerequisites they already meet or blame them for unclear instructions.
Infer these from the request and repository when clear.
Ask only when a missing choice changes the procedure or audience materially.

Choose the structure that serves the task:

| Reader needs | Structure |
| --- | --- |
| Learn by doing | Tutorial with a visible result after each stage |
| Complete a known task | How-to guide with prerequisites and ordered steps |
| Look up exact behavior | Reference organized around public names |
| Understand a design | Explanation with supported mechanisms and trade-offs |

Keep one primary purpose. Link deeper background where it would interrupt the steps.
Read [guide primitives](references/guide-primitives.md) and ensure the reader receives each applicable element.
Treat these as a completeness check, rather than mandatory headings or a fixed page length.
During the initial sweep, identify which code examples, diagrams, captures, and supporting sources the destination can use.
Record what exists, what needs creation, and what cannot be verified in this context.
Follow the primitive selection procedure in that reference before proposing additional work.
Read [content boundaries](references/content-types.md) when the page mixes guidance, comparison, research, or personal experience.
For a refresh, prefer the smallest change that resolves the reader's problem.
Preserve useful examples, routes, anchors, and deliberate voice.

**Done:** the reader's goal, version, page scope, and constraints are clear.

## 2. Establish evidence before drafting

Read [evidence and verification](references/verification.md) before adding technical claims or executing examples.
Use official documentation for public support and platform guarantees.
Use the matching source revision, exports, tests, and CLI help for implementation details.
Reconcile differences between the checkout and the release the reader can install.

Record the source and version behind material claims in existing project records or a small private working ledger.
The ledger needs the claim, evidence location, scope, and any unresolved question.
Keep working evidence outside published collections and generated public outputs.
Do not require four new policy files for a single page.

Issues and support reports explain reader problems. Verify the suggested remedy against supported behavior.
Plans describe intent. Announcements describe release history. Neither proves current behavior alone.
If evidence conflicts, narrow the claim or report the missing decision.

**Done:** the supported path and its material claims have inspected evidence.

## 3. Draft for the next action

Lead with the outcome and essential prerequisites.
Show the common path before alternatives.
Introduce a concept before the reader must use it, unless it is an explicit prerequisite.
Put version limits and consequential conditions beside the affected step.

For each step, explain what to do and what success looks like.
Provide complete imports, setup, configuration, and working-directory context for runnable examples.
Distinguish runnable code from pseudocode and schematic output.
Use the project's language and package manager. Preserve exact identifiers and units.
Use placeholders that readers can recognize and replace. Keep credentials out of examples.

Write direct, natural prose. Keep useful qualifications, uncertainty, and attribution.
Prefer a concrete explanation to hype or stock transitions.
Use consistent terms. Leave strong sentences unchanged.
Use passive voice when the actor is irrelevant or the object deserves emphasis.
Add diagrams or screenshots when they answer a reader question, rather than to decorate the page.
Use supplied experience and measurements. Missing evidence stays missing; never invent it for personality.
Preserve the author's supplied voice without claiming their experience as the agent's own.
Never use the mascot or an agent persona to imply human authorship.
Use exact names and stated pronouns; otherwise use a username or singular they.

**Done:** the draft covers the supported task without assuming hidden setup.

## 4. Verify the reader's path

For procedural content, run safe examples from the documented starting state when the environment permits.
Use the actual documented commands and record their results.
For state-changing steps, respect the user's authorization and use an isolated environment where possible.
Read the verification reference for limitations, failures, and publication checks.
Turn material claims and promised outcomes into concrete checks before calling the guide verified.
Check relevant conditions and response metadata, rather than only a successful command or visible result.
Render diagrams with the destination's renderer when available. Inspect actual captures and their captions.
If a check fails, repair the example, explanation, or visual, then repeat the affected checks.
Keep the initial draft and observed failures in private evidence so the repair remains inspectable.

Perform two distinct reviews:

1. **Technical:** check behavior, versions, code, prerequisites, outcomes, and link destinations against evidence.
2. **Editorial:** check task order, understandable concepts, useful detail, and preservation of meaning and voice.

After prose edits, recheck technical meaning and examples.
For a refresh, search adjacent pages for repeated claims and links to changed anchors.
Use the target's documented docs checks and preview when applicable.

**Done:** material claims are supported; repairs pass their affected checks; remaining limits appear in the handoff.

## 5. Deliver

Provide the guide or requested file changes, then a short evidence handoff.
State the version checked, meaningful verification, and unresolved paths.
Keep the working ledger and review commentary out of the public article.
If a claim blocks the core procedure, deliver a draft with the blocker identified in the handoff.
Do not label that procedure verified.

Repository edits, publication, deployment, and external messages follow the user's requested delivery scope.
Writing a guide does not grant permission to publish it or operate a production service.
If publication is authorized, check contribution rules for restrictions on AI-authored content.
If those rules prohibit the contribution, stop publication and tell the operator.
Include an early plain authorship sentence naming the operator and actual human review state in a public artifact.
Ask before publication if either is unknown. Never claim review from an intention to review later.
This skill needs no sibling skills or private infrastructure.

## Background

The structure uses the reader needs described by [Diátaxis](https://diataxis.fr/).
For general developer prose, consult Google's [voice and tone guidance](https://developers.google.com/style/tone).
Local editorial rules take precedence over these defaults.
