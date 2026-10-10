---
name: glossary
description: "Create or audit GLOSSARY.md. Use before naming product concepts, writing user-visible terms, renaming concepts, or checking vocabulary drift and banned terms."
license: MIT
---

# Glossary

Help readers understand product concepts and distinguish them without learning competing names.
Consider their knowledge, context, and reading needs, including ADHD and dyslexia.
Respect their attention through familiar terms, accurate definitions, and concise explanations that keep necessary distinctions.

`GLOSSARY.md` owns product terms across UI strings, public APIs, headings, routes, errors, and commit subjects.
Use one established term for each concept. Consistency alone does not prove the reader understands it.

## Ownership and dependencies

This Skill works when copied alone. Read the target project's instructions before editing.
Respect its branch, worktree, publication, and approval rules. This Skill does not own delivery.
Create or audit GLOSSARY.md only. Do not create COPY.md or VISION.md automatically.

## The failure mode this exists to stop

Independent naming choices can give one concept different names across the UI, SDK, docs, and routes.
Readers must then infer which names mean the same thing. Published names also carry a cost to change.
Treat a new product term with the same caution as a public export.

## Rules

1. **Read `GLOSSARY.md` before naming anything user-visible.** If the repo has one, its terms win over anything that reads better in the moment.
2. **Never introduce a synonym for a term that exists.** If the glossary says Sprint, do not write "run", "batch", or "job", not even in a tooltip, a variable name, or a log line.
3. **Never use a term on the ban list.** The ban list carries a replacement; use it.
4. **A concept with no term does not get named silently.** Propose an addition, state the candidate term and the synonyms it displaces, and get confirmation. Inventing quietly is the whole failure mode.
5. **Take the platform's word before inventing one.** GitHub, Nuxt, Vue, and HTTP have already named most things. `auto merge` beats a coined `merge tier`, because the reader knows it and nobody has to confirm it. Propose at most one new term per change; a set of new terms is a redesign, not a name.
6. **Match the recorded casing exactly.** `Nuxt SEO` and `NuxtSEO` are different brands to a reader.
7. **A term list without a relationship map is half a glossary.** See below. Terms are only ambiguous in relation to each other, so the map is what makes the list decidable.

Rule 4 protects naming decisions that nobody has approved yet.

## Review for understanding

Identify who uses each term and which distinctions they need to understand.
Explain unfamiliar concepts in plain words. Show their relationships and actual use without circular definitions or new synonyms.
Apply [clarity](references/blocks/clarity.md), including ADHD and dyslexia guidance, to definitions and relationship explanations.
The block is bundled here. No sibling Skill installation is required.
Keep map labels, table cells, and definitions easy to scan. Retain complete relationships and exact public identifiers.
Preserve established names and casing. If a name confuses readers, show the problem and propose a change for approval.
Do not rename public surfaces or remove required maps to make the glossary shorter.
Before removing a substantial section or feature, explain the proposed loss and ask unless already authorized.

## Workflow

Read [the workflow reference](references/workflows.md) and [the format reference](references/format.md) before creating or auditing a glossary.
Use init for a missing glossary, audit for an existing one, and add for an approved new term.
Apply the relationship map, frozen-surface checks, decision records, and scope rules in the workflow reference.
Ask only about unresolved naming decisions. Existing explicit approval remains valid.
If a decision needs approval, prepare the evidence and proposed terms before asking.
Keep unresolved choices in Open questions. Do not silently make them canonical.

## Scope

Glossary governs **nouns for product concepts**: what a thing is called. It does not govern voice, tone, or sentence style. A supplied `COPY.md` owns those. Read it directly; no sibling Skill is required. When they disagree on a product noun, the glossary wins; on the sentence around it, `COPY.md` wins.

A term list found inside a `COPY.md` belongs here, not there. Step 0 of `init` already greps for one; fold it in and leave a pointer behind.
