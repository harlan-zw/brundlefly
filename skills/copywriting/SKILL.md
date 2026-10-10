---
name: copywriting
description: "Create or audit COPY.md and write user-visible strings against it. Use before writing marketing copy, UI labels, error messages, empty states, meta tags, or email, and when copy has drifted from the canonical strings."
license: MIT
compatibility: "Designed for agents that can read and edit project text files."
---

# Copywriting

`COPY.md` at the repo root is the canonical source for every user-visible string: the exact
assets nobody may paraphrase, the register each surface writes in, and the language the product
never uses.

## Ownership and dependencies

This Skill works when copied alone. Read the target project's instructions before editing.
Respect its branch, worktree, publication, and approval rules. This Skill does not own delivery.
Create or audit COPY.md only. Do not create GLOSSARY.md or VISION.md automatically.

## The failure mode this exists to stop

An agent asked for a hero headline writes a good one. The next agent, on the next page, writes
a different good one. Neither is wrong in isolation, and the product now describes itself two
ways. Six months later the npm blurb, the meta description, the social card and the landing H1
are four separate pitches, and nobody chose that.

The same drift runs through the small strings. One empty state apologises, the next scolds, a
third is silent. One error names the resource, another says "Something went wrong". The product
reads as though several companies built it, because several agents did.

A string is a product surface. Treat writing a new canonical one with the same caution as adding
a public export.

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
6. **State the specific thing.** "12 skills from 3 curators" beats "a growing ecosystem". Every
   claim concrete, every number sourced. This is also the tell that separates human copy from
   generated copy, so it does double duty.
7. **Copy is not decoration.** If a section needs filler to look finished, the layout is wrong.
   Never invent a stat, a testimonial, or a feature to fill space.
   Text that restates a heading, a value, or a visible fact is decoration too.

Rule 5 is the one that matters. Rules 1 to 3 only work on strings someone already decided.

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
