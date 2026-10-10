---
name: clarity
description: Review text for clear wording, useful order, and accessible structure. Use for a focused clarity pass without changing claims, voice, or the document's purpose.
license: MIT
compatibility: "Designed for agents that can read and edit project text files."
---

# Clarity

Help the intended reader find the point and understand the next action.
This block reviews wording and structure. It does not run a full style rewrite or verify factual truth.
Follow the target's instructions, terminology, canonical wording, and requested output format.
Installing this Skill does not authorize publication or unrelated edits.

## Establish the reading task

Read the complete passage and any supplied reader preferences.
Identify the reader, purpose, and requested scope. Infer them when the context is clear.
If a missing choice changes the result materially, ask before dependent edits.
For mixed documents, distinguish stories, instructions, explanations, and reference sections.
Preserve deliberate narrative openings. Keep technical instructions predictable.

## Review wording and structure

Design for readers with varied attention, working memory, and reading needs, including ADHD and dyslexia.
Do not infer a diagnosis or claim that most readers have one. Respect stated reader preferences.
Reader comprehension takes priority over stylistic variety.

- **Start simple.** Lead with the answer or action. Then give the common case, an example, and deeper detail.
  For a story, preserve a deliberate narrative opening. Apply answer-first ordering to its technical sections.
  Define necessary terms before using them. Keep prerequisites and consequential warnings beside the action.
  Put optional exceptions and background later. A deep dive still needs a clear entry point.
- **Keep blocks small.** Give each sentence one main idea and each paragraph one job.
  Prefer familiar words, explicit actors, and direct instructions. Explain necessary jargon on first use.
  As editing defaults, aim for sentences under 20 words and paragraphs of one to three sentences.
  Review three consecutive prose paragraphs for a useful heading, list, example, table, or diagram.
  These numbers are review prompts, not research thresholds. Preserve meaning and deliberate literary voice.
- **Make sections findable.** Use descriptive headings for distinct questions, tasks, or reference entries.
  Keep a logical heading hierarchy. Avoid vague labels, decorative headings, and filler between sections.
  Readers should find the answer by scanning headings and opening lines.
- **Choose the useful format.** Use bullets for parallel points, numbers for ordered steps, and tables for comparisons.
  Use diagrams for relationships or branching processes. Keep connected explanations in short prose.
  Add an artifact only when it reduces reading effort. Avoid long lists, wide tables, and decorative visuals.
- **Keep alternatives accessible.** Explain a visual's useful point in nearby text. Supply meaningful text alternatives for images.
  Label table columns and keep cells short. Never make color, position, or an icon the only carrier of meaning.
  Use whitespace and restrained emphasis. Avoid full paragraphs in bold, italics, or capitals.

Leave clear sentences and useful headings unchanged. Do not split sentences mechanically or add filler for rhythm.
Preserve stable anchors and check affected links when changing headings.
Keep exact code, commands, names, numbers, units, attribution, uncertainty, and required wording.
Keep conditions, negation, exceptions, permissions, and step order attached to their actions.
Never invent an actor, explanation, experience, or example to make a passage sound clearer.
Do not use em dashes or hyphens as sentence punctuation in new prose.

## Deliver the requested pass

For review only, return concrete reading problems and proposed repairs. Leave the source unchanged.
For an edit, change only passages with a reading problem. Explain meaningful repairs outside the edited text.
Before delivery, check that the reader can find the answer, understand the terms, and follow the required steps.
Compare the result with the source for changed claims, conditions, uncertainty, and voice.
If rendering is available, inspect the actual output at a narrow width. Otherwise report that limit when relevant.
If no repair is needed, say so. Do not invent findings or claim an accessibility audit passed.
