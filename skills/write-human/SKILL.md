---
name: write-human
description: "Remove AI writing tells from publishable prose. Use for humanizing blogs, docs, release notes, tweets, email, or copy that sounds generated."
license: MIT
---

# Write Human

Edit generated-sounding prose in two passes: surface wording, then structure. Preserve meaning and the writer's voice.

## How to use

Given text or a file path, run both passes below, report what you flagged, then rewrite. Don't silently rewrite, show the user *which* tells you found so they learn to avoid them.

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

## Pass 1: Surface tells (fast, lexical)

These are the well-known signatures. Fix them, but know they are the easy half.

- **Em-dashes and hyphens-as-dashes** -- restructure with commas, semicolons, colons, or separate sentences.
- **"It's not X, it's Y"** contrast pattern -- banned. State Y directly.
- **Overused vocabulary** -- delve, tapestry, testament, realm, navigate, leverage, robust, seamless, crucial, vibrant, ever-evolving, "in today's fast-paced".
- **Clichés and stock metaphors:** Never use them in your own prose. Examples: "game changer", "unlock the power of", "at the end of the day", "low-hanging fruit", "double-edged sword", "the landscape of". Prefer plain language. When a metaphor helps, create a fresh, specific image that fits the subject. Compare it with the plain version. Keep it only if it makes the point easier to understand. Remove it if it feels forced. Preserve the source meaning; never invent capabilities or evidence to make the rewrite concrete.
- **Pompous diction** -- long or latinate word where a short one works: utilize (use), facilitate (help), commence (start), prior to (before), in order to (to), "a variety of" (give the number or drop it). Never a long word where a short one will do.
- **Agentless passive** -- "it was decided", "mistakes can be made", "improvements were introduced". Name the actor when the actor matters.
- **Padding constructions** -- "the fact that", "there is/are ... that", nominalizations ("perform an installation of" instead of "install"). If a word can be cut, cut it.
- **Hedging filler** -- "it's worth noting", "it's important to", "that said", "moreover", "furthermore" as paragraph openers.
- **False-sincerity openers** -- "honestly", "to be honest", "frankly", "in all honesty", "let's be real". They signal nothing and pad the sentence. Just state the point.
- **Rule-of-three everywhere** -- AI defaults to triples ("fast, reliable, and scalable"). Vary list length; use two or four.
- **Tidy closing summary** -- the "In conclusion" / "Ultimately" wrap-up that restates what was just said.

## Pass 2: Structural tells (the durable ones)

Structural habits can survive a wording pass. Change them when they weaken the draft.

- **Over-explains the takeaway.** AI spells out the moral far more than humans do. Cut the sentence that says "the lesson here is...". Trust the reader to infer it from the example.
- **Progressive disclosure.** Keep information light by default. Lead with what the reader needs now. Add detail only when it helps the next question or decision. Go deep only when the text explicitly intends a deep dive.
- **Vague allusions instead of specific references.** Humans name real tools, versions, people, repos, numbers; AI stays generic. Replace "a popular framework" with "Nuxt 4", "studies show" with the actual source, "significantly faster" with the real figure.
- **Writes as though no one is watching.** Humans address the reader directly and break the fourth wall ("you've probably hit this"). AI narrates into the void. Add direct address where natural.
- **Tidy, single-track structure.** AI marches clue to reveal in a straight line with no loose ends. Humans digress, backtrack, leave threads open. Allow an aside or a non-linear jump.
- **Narrow repertoire / over-determination.** AI converges on safe defaults and resolves everything neatly. Let tension stay unresolved; admit what you don't know; allow an opinion that isn't perfectly balanced.
- **Elegant variation.** AI swaps synonyms for the same thing to sound sophisticated ("the tool... the utility... the solution"). Humans repeat the term. Use the same word for the same thing throughout.
- **Uniform sentence rhythm.** Change repeated sentence shapes when they make the draft hard to read. Keep clear fragments and deliberate cadence. Do not add filler or replace distinctive wording to force variety.

## Adapt to content type

Not every tell applies everywhere. Weight by genre:

- **Tweets / social:** surface tells + specificity + direct address matter most. Skip structural nonlinearity.
- **Release notes / docs:** specificity (real version numbers, PR links) and cutting the over-explained takeaway matter most. Keep structure clear, drop the moralizing.
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

Reader respect, truthful authorship, and evidence remain required even when a stylistic rule would suggest otherwise.

Break any rule above sooner than write something stilted, except the ban on clichés in your own prose. Preserve clichés in direct quotes or when the user explicitly requires the wording. The goal is prose that reads human, and humans keep deliberate voice, rhythm, humor, and the occasional ornament. If a "tell" is doing real work (a fresh metaphor that lands, a triple with punch), keep it and say why. Preserve the user's meaning, tone, and explicit constraints; never sand text into flat sameness.
