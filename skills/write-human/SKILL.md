---
name: write-human
description: "Remove AI writing tells from publishable prose. Use for humanizing blogs, docs, release notes, tweets, email, or copy that sounds generated."
license: MIT
---

# Write Human

Edit generated-sounding prose in two passes: surface wording, then structure. Preserve meaning and the writer's voice.

## How to use

Given text or a file path, run both passes below, report what you flagged, then rewrite. Don't silently rewrite, show the user *which* tells you found so they learn to avoid them.

For a file edit, keep review notes in the handoff, outside the published text.
For a requested output format, follow that format and omit review notes when it excludes them.

Edit only where a change solves a reading problem. Leave clear, natural sentences alone.
Keep distinctive vocabulary and compressed phrasing when their meaning is clear. Do not add filler to smooth them out.
Preserve claim scope, uncertainty, dates, units, attribution, and prerequisites in every genre.
Never invent an actor, experience, example, or supporting detail.
If the text needs no changes, return it unchanged and say so. Do not invent tells to justify a rewrite.

## Respect the reader and author

Improve the prose without disguising who wrote it. Never pretend to be human or remove required agent disclosure.
Preserve supplied personal experience as the author's words. Never invent anecdotes, credentials, feelings, or team membership.
Drafting in an author's voice does not authorize signing their name or publishing unseen text for them.
Keep claims about checks, measurements, effort, and human review tied to actual evidence.
Never add promises or offers that commit the author without their agreement.
Before delivery, ask whether the reader needs this text and can find the useful point quickly.
Cut repetition, reflex flattery, and unsolicited lectures. An unnecessary message may need no rewrite or delivery.
Use people's exact names and stated pronouns. Otherwise use their username or singular they.
Do not add an agent disclosure by default. Follow explicit user and destination requirements for disclosure.
Preserve required disclosures. Never assume a human reviewed the draft.

## Make reading easier

Design for readers with varied attention, working memory, and reading needs, including ADHD and dyslexia.
Do not infer a diagnosis or claim that most readers have one. Respect stated reader preferences.
Apply these rules during the structural pass. Reader comprehension takes priority over stylistic variety.
Read [the accessibility research and examples](references/accessible-writing.md) when explaining evidence or choosing a format.

- **Start simple.** Lead with the answer or action. Then give the common case, an example, and deeper detail.
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

Before delivery, check that a reader can find the answer, understand the terms, and follow the required steps.
Check that rearranging the text preserved conditions, uncertainty, and the meaning of every claim.
If rendering is available, inspect the actual output at a narrow width. Otherwise report that limit when relevant.

## Pass 1: Surface tells (fast, lexical)

Treat recurring wording as a review signal. Change it only when it weakens this passage.
Read [the Graphite research note](references/graphite-ai-tells-2026.md) when reviewing model-dependent patterns or explaining their evidence.
Corpus frequency does not identify an author or measure prose quality. Do not turn research examples into a word blacklist.

- **Em-dashes and hyphens-as-dashes** -- restructure with commas, semicolons, colons, or separate sentences.
- **"It's not X, it's Y"** contrast pattern -- banned. State Y directly.
- **Overused vocabulary** -- delve, tapestry, testament, realm, navigate, leverage, robust, seamless, crucial, vibrant, ever-evolving, "in today's fast-paced".
- **Clichés and stock metaphors:** Never use them in your own prose. Examples: "game changer", "unlock the power of", "at the end of the day", "low-hanging fruit", "double-edged sword", "the landscape of". Prefer plain language. When a metaphor helps, create a fresh, specific image that fits the subject. Compare it with the plain version. Keep it only if it makes the point easier to understand. Remove it if it feels forced. Preserve the source meaning; never invent capabilities or evidence to make the rewrite concrete.
- **Pompous diction** -- long or latinate word where a short one works: utilize (use), facilitate (help), commence (start), prior to (before), in order to (to), "a variety of" (give the number or drop it). Never a long word where a short one will do.
- **Agentless passive** -- "it was decided", "mistakes can be made", "improvements were introduced". Name the actor when the actor matters.
- **Padding constructions** -- "the fact that", "there is/are ... that", nominalizations ("perform an installation of" instead of "install"). If a word can be cut, cut it.
- **Hedging filler** -- "it's worth noting", "it's important to", "that said", "moreover", "furthermore" as paragraph openers.
- **Generic praise, importance, and helpfulness.** Flag unsupported ratings and superlatives, ceremonial transitions, and promises to help without a stated benefit. Cut repetition or state the supported result. Keep specific claims and useful connections between ideas. Never invent evidence to replace vague wording.
- **Added judgment.** Compare evaluative wording with the supplied facts and intent. Calling an evaluation report "paperwork" adds dismissal. Use the factual name when the source supports no judgment. Preserve deliberate author opinions and direct quotes.
- **Qualification and comparison.** Keep words such as "may" and "not necessarily" when they preserve uncertainty or scope. Keep meaningful contrasts. Cut only padding that leaves the same claim, conditions, and emphasis.
- **False-sincerity openers** -- "honestly", "to be honest", "frankly", "in all honesty", "let's be real". They signal nothing and pad the sentence. Just state the point.
- **Rule-of-three everywhere** -- AI defaults to triples ("fast, reliable, and scalable"). Vary list length; use two or four.
- **Tidy closing summary** -- the "In conclusion" / "Ultimately" wrap-up that restates what was just said.

## Pass 2: Structural tells (the durable ones)

Structural habits can survive a wording pass. Change them when they weaken the draft.

- **Over-explains the takeaway.** AI spells out the moral far more than humans do. Cut the sentence that says "the lesson here is...". Trust the reader to infer it from the example.
- **Compressed summaries.** Check generated summaries for noun phrases that hide who did what. Prefer supported actors and verbs. Split sentences that stack the problem, outcome, and implementation. Keep necessary connections and qualifiers. Preserve deliberate author compression when its meaning is clear.
- **Progressive disclosure.** Apply the simple-first order in “Make reading easier”. Add complexity when the reader has enough context.
- **Heading density.** Flag repeated headings followed by one short paragraph when they fragment a connected explanation. Merge sections whose headings merely restate the next sentence. Keep headings that help readers find steps, reference entries, or distinct questions. Check the rendered page; code, tables, and figures can justify short prose sections. Treat the ratio as a review signal, without a universal target. Never add filler to lower it. Preserve stable anchors and check links when removing headings.
- **Bolted-on advice and quizzes.** Remove generic "Common mistakes", "Best practices", and "Check your understanding" sections that interrupt the narrative. Put a supported warning beside the step or claim it explains. Keep a separate section only when the brief or reader task needs it. Do not invent advice, questions, or recap sections to complete a familiar template.
- **List overload.** Keep explanations in short prose when ideas depend on each other. Use lists for parallel items or ordered actions. Keep items short and lists to five items or fewer by default. Group longer procedures into meaningful phases without losing steps. Preserve required templates and complete reference entries. Do not split a list arbitrarily or turn paragraphs into checklists.
- **Paragraph walls.** Flag successive long paragraphs that stack conditions, exceptions, and repeated explanations. Cut repetition and give each paragraph one clear job. Lead with the rule the reader needs now. Move deeper detail beside its use or link to it. Use a compact table for parallel rules or a worked example for behavior when either improves comprehension. Do not replace every list with dense prose, split sentences mechanically, or add decorative headings and visuals. Check the rendered passage for both scanability and technical completeness; length alone is not a quality score.
- **Vague allusions instead of specific references.** Humans name real tools, versions, people, repos, numbers; AI stays generic. Replace "a popular framework" with "Nuxt 4", "studies show" with the actual source, "significantly faster" with the real figure.
- **Writes as though no one is watching.** Humans address the reader directly and break the fourth wall ("you've probably hit this"). AI narrates into the void. Add direct address where natural.
- **Tidy, single-track structure.** Keep a useful aside or unresolved question when the genre benefits from it.
  Never add digressions or non-linear jumps to make text seem human. Keep instructions predictable and complete.
- **Narrow repertoire / over-determination.** AI converges on safe defaults and resolves everything neatly. Let tension stay unresolved; admit what you don't know; allow an opinion that isn't perfectly balanced.
- **Elegant variation.** AI swaps synonyms for the same thing to sound sophisticated ("the tool... the utility... the solution"). Humans repeat the term. Use the same word for the same thing throughout.
- **Uniform sentence rhythm.** Change repeated sentence shapes when they make the draft hard to read. Keep clear fragments and deliberate cadence. Do not add filler or replace distinctive wording to force variety.

## Adapt to content type

Not every tell applies everywhere. Weight by genre:

- **Tweets / social:** surface tells + specificity + direct address matter most. Skip structural nonlinearity.
- **Release notes / docs:** specificity (real version numbers, PR links) and cutting the over-explained takeaway matter most. Keep structure clear, drop the moralizing.
- **READMEs:** preserve requested section order, useful lookup headings, and parallel feature lists. Keep setup before deeper reference.
  Treat commands, code, URLs, identifiers, and approved brand text as exact material, outside the prose pass.
  Change them only when inspected evidence supports a technical correction. Recheck the reader's path afterward.
  Apply digressions and unresolved tension only to genres that benefit from them. Keep instructions direct and complete.
- **Blog posts / essays:** all of Pass 2 applies. This is where structure shows the most.
- **Email:** direct address and dropping hedging filler matter most.

## Evidence-backed articles

Follow the article brief and local article voice before applying structural suggestions.
Keep the common case first. Do not add digressions that obscure instructions.
Preserve claim scope, uncertainty, dates, units, source attribution, and prerequisites.
Never invent experience or turn an observation into a guarantee.
After rewriting, compare material claims and examples with their verified evidence.
For a collection refresh, record verified sources and review each article against them.

## Product copy

Read the project's supplied voice rules and canonical wording before rewriting product copy.
Preserve approved names, taglines, claims, and required wording.
If the project has a copy guide, compare the final text against it.
Do not require another skill to complete this step.

## Output

1. List the tells you found, grouped by pass, quoting the offending phrase.
2. Provide the rewritten text.
3. Compare the rewrite with the source. Undo unsupported additions, lost claims, and needless voice changes. If a meaning change is required, explain it and ask for the missing information.

## Guardrail

Reader respect, truthful authorship, evidence, and the ban on em dashes in new prose remain required during stylistic edits.
The punctuation ban is a style requirement. Punctuation alone cannot establish authorship or writing quality.

Break any rule above sooner than write something stilted, except the ban on clichés in your own prose. Preserve clichés in direct quotes or when the user explicitly requires the wording. The goal is prose that reads human, and humans keep deliberate voice, rhythm, humor, and the occasional ornament. If a "tell" is doing real work (a fresh metaphor that lands, a triple with punch), keep it and say why. Preserve the user's meaning, tone, and explicit constraints; never sand text into flat sameness.
