---
name: copywriting
description: "Create or audit COPY.md and write user-visible strings against it. Use before writing marketing copy, UI labels, error messages, empty states, meta tags, or email, and when copy has drifted from the canonical strings."
license: MIT
---

# Copywriting

Help the intended reader understand the message and their next action.
Respect their knowledge, attention, and context. Optimize for clarity, accuracy, and brevity without losing needed explanation.
Design for varied reading, attention, and working memory needs, including ADHD and dyslexia.
Storytelling and style techniques serve meaning, understanding, and connection. Preserve the supplied voice and truthful experience.

`COPY.md` owns canonical assets, each surface's register, and banned language.
Keep approved wording exact. If it creates a reading problem, propose a change rather than silently paraphrasing it.

## Ownership and dependencies

This Skill works when copied alone. Read the target project's instructions before editing.
Respect its branch, worktree, publication, and approval rules. This Skill does not own delivery.
Create or audit COPY.md only. Do not create GLOSSARY.md or VISION.md automatically.

## The failure mode this exists to stop

Independent rewrites can give one product conflicting descriptions, labels, and error messages.
Readers must then work out whether those differences have meaning.
Use the approved wording and register. Treat a new canonical string with the same caution as a public export.

## Boundaries

Use the target project's supplied document ownership rules.
When they disagree: `VISION.md` wins over everything, `GLOSSARY.md` wins on a product noun, and
`COPY.md` wins on the sentence around it.

Read a supplied GLOSSARY.md before naming a concept. Read this Skill before writing a sentence.
If no glossary exists, preserve established names and ask about new concepts rather than generating another artifact.

## Rules

1. **Read `COPY.md` before writing anything a user sees.** Its canonical assets win over
   anything that reads better in the moment.
2. **Never paraphrase a canonical asset.** A tagline with one word changed is a second tagline.
   If the string is wrong, change it in `COPY.md` first, then propagate.
3. **Never use banned language.** The ban list carries a reason; the reason is what tells you
   whether a near-miss is also banned.
4. **Write in the register the surface calls for.** A button is not a paragraph, and a hero is
   not a tooltip. `COPY.md`'s register table decides, not the sentence's own momentum.
5. **A new canonical string does not get written silently.** Propose it, say what it displaces,
   and get confirmation. Inventing quietly is the whole failure mode.
6. **State supported specifics.** Use inspected names, quantities, and behavior when they help the reader.
   Source material claims and numbers. Concrete wording cannot establish authorship or make an unsupported claim accurate.
7. **Copy is not decoration.** If a section needs filler to look finished, the layout is wrong.
   Never invent a stat, a testimonial, or a feature to fill space.
   Text that restates a heading, a value, or a visible fact is decoration too.

Rule 5 protects wording decisions that nobody has approved yet.

## Review for the reader

Identify who reads each surface, what they already know, and what they need to understand or do.
Apply [clarity](references/blocks/clarity.md), including ADHD and dyslexia guidance, before accepting new copy or a proposed correction.
The block is bundled here. No sibling Skill installation is required.
Keep labels brief and specific. Put instructions, conditions, and consequences beside the action they explain.
Explain errors without blame. Give a supported recovery action when one exists.
Preserve required wording, register, and meaningful links. Recheck canonical assets after editorial changes.
If an approved asset needs correction, show the exact proposal and follow the existing approval rules.
Before removing a substantial section or feature, explain the proposed loss and ask unless already authorized.

## Workflow

Read [the workflow reference](references/workflows.md) and [the COPY.md template](templates/COPY.md) before creating or auditing a copy file.
Use init for a requested missing copy file, audit for drift, and write for a specific surface.
Ask only about unresolved voice or canonical wording decisions. Existing explicit approval remains valid.
Preserve approved strings exactly. Prepare proposed wording before requesting approval.
Review prose directly, or use an available im-not-a-fly Skill optionally. Recheck canonical wording afterward.

## Scope

Copywriting governs **sentences a user reads**: the exact wording, the register per surface, and
the banned language. It does not govern what a concept is called, which is
a supplied `GLOSSARY.md`, and it does not govern what may be claimed, which is
`VISION.md`. When a noun and a sentence disagree, the noun wins.
