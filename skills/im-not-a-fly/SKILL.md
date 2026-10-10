---
name: im-not-a-fly
description: "Edit prose for its human reader: clear meaning, accurate claims, concise wording, and preserved voice. Use for blogs, docs, release notes, tweets, email, or copy that needs a reader-focused rewrite."
license: MIT
---

# im-not-a-fly

Consider who will read the text and what they need to understand or do.
Respect their knowledge, attention, and reading preferences. Optimize for clarity, accuracy, and brevity.
Design for varied attention, working memory, and reading needs, including ADHD and dyslexia.
Show empathy through explanations that fit the reader's context. Never substitute flattery or simulated intimacy.
Storytelling and style techniques build on this core. Use them to communicate meaning and support understanding and connection.

## Establish the reader and meaning

Read the complete text, request, supplied reader preferences, and local wording rules.
Identify the reader's purpose, starting knowledge, context, and the author's intended meaning.
Infer these when clear. Ask only when missing information materially changes the work.
Do not assume the reader's experience, feelings, or diagnosis.

Edit only where a change solves a reading problem. Leave clear, natural sentences alone.
Preserve distinctive vocabulary, compressed phrasing, humor, rhythm, and deliberate voice when their meaning is clear.
Brevity removes unnecessary words and effort. Keep explanations, connections, and qualifications the reader needs.
Before removing a substantial section or feature, explain the proposed loss and ask unless removal is already authorized.
Compact overlapping guidance before proposing a larger removal.

Verify material facts and relevant assumptions before rewriting. Recheck them after both passes.
Preserve scope, uncertainty, dates, units, attribution, prerequisites, and required wording in every genre.
Never invent an actor, experience, example, or supporting detail to make writing concrete.

## Choose how to communicate

Route each section by its purpose. A file can combine a story with technical detail.

| Purpose | Read and apply |
| --- | --- |
| Communicate an experience, origin, or meaningful change | [Storytelling](references/storytelling.md): supported perspective, goal, disruption, response, and consequence |
| Explain facts or help someone complete a task | [Writing well](references/writing-well.md): plain language, explicit conditions, and predictable order |
| Both, such as a README | Use storytelling for the requested story; explain Features, Setup, Guides, and API directly |

Storytelling helps someone understand meaning and connect with a piece of text.
Keep the author's perspective. Use I for their own story, and we only for a supported shared experience.
Follow an explicitly requested narrator. Never replace personal perspective with generic you or detached project narration.
Keep story and instructions distinct through useful paragraph or section boundaries.
Never add suspense, character arcs, or withheld prerequisites to instructions.
Never turn an approved story into a feature list or force its ending into a moral.
These references offer craft guidance, not proof of authorship or guaranteed reader response.

## Pass 1: Make the wording useful

Review these techniques in context. Keep a phrase when it serves meaning or deliberate voice.

- **Plain words and clear actions.** Prefer use to utilize, start to commence, and install to perform an installation.
  Name the actor when it matters. Keep passive voice when the actor is irrelevant or the object deserves emphasis.
  Unpack compressed summaries that hide who did what. Keep necessary technical terms and explain unfamiliar ones.
- **Less filler.** Cut padding, repeated praise, ceremonial transitions, false sincerity, and offers without a useful purpose.
  Review phrases such as "the fact that", "it's worth noting", and "to be honest" for unnecessary words.
  Keep transitions that connect ideas and qualifications such as may or not necessarily that preserve the claim.
- **Supported specifics.** Replace vague allusions, ratings, and comparisons with inspected names, sources, or measurements when available.
  Preserve deliberate author opinions. Never add judgment, benefits, or evidence that the source does not support.
  Address the reader where useful, without assuming "you've probably hit this" or inventing shared experience.
- **Consistent terms and useful rhythm.** Use the same term for the same concept. Follow the supplied glossary.
  Change repeated sentence shapes only when they hinder reading. Keep clear fragments and deliberate cadence.
  Choose list length by the information. Never force two or four items to avoid a useful triple.
- **Purposeful imagery and punctuation.** Prefer plain language to clichés such as "game changer" or "unlock the power of".
  Do not introduce clichés. Preserve them in direct quotes or explicitly required wording.
  Compare a fresh, specific metaphor with the plain version. Keep it only when it makes meaning easier to understand.
  Do not use em dashes or hyphens as sentence punctuation. State the point directly instead of "It's not X, it's Y".
  Preserve necessary contrasts and qualifications. Punctuation alone cannot establish authorship or quality.

When reviewing model-dependent patterns or explaining their evidence, read [the Graphite research note](references/graphite-ai-tells-2026.md).
Corpus frequency does not identify an author or measure prose quality. Never turn ordinary words into a blacklist.

## Pass 2: Make understanding easier

Apply [clarity](references/blocks/clarity.md) to reading order, wording, and accessible structure.
Apply the guidance for ADHD and dyslexia during this review. Reader comprehension takes priority over stylistic variety.
Read [accessibility research and examples](references/accessible-writing.md) when explaining evidence or choosing a format.

Lead with the answer or action in explanations and procedures. Preserve a deliberate narrative opening in a story.
Use familiar words, short focused blocks, descriptive headings, whitespace, and restrained emphasis.
Keep definitions, prerequisites, and consequential warnings beside their use. Reduce reliance on memory across sections.
Choose prose, lists, tables, or visuals by the reader's task. Provide meaningful text alternatives for visuals.
Never rely on color, position, or icons alone. Respect stated preferences without claiming one universally accessible format.
Use numerical length defaults as review prompts, not proof of comprehension. Preserve complete meaning and necessary steps.

- **Connected structure.** Merge headings that fragment one explanation. Keep useful lookup headings, stable anchors, and required templates.
  Check affected links. Do not add filler, decorative headings, or visuals merely to vary the page.
- **Useful detail.** Keep the common case first. Add deeper detail when the reader has enough context.
  Put supported warnings beside the affected step. Keep separate advice or quiz sections only when the brief or task needs them.
  Never invent appendices to complete a familiar template.
- **Helpful endings and uncertainty.** Cut repeated takeaways and closing summaries; keep explanations or summaries the reader needs.
  Preserve supported opinions, uncertainty, useful asides, and unresolved tension where they communicate the story.
  Never invent digressions or loose ends to seem human. Keep procedures predictable and complete.

Adapt to the section, rather than applying every technique mechanically:

| Content | Emphasis |
| --- | --- |
| Tweets and email | Specific meaning, useful direct address, and concise wording |
| Release notes and docs | Exact versions and references, clear actions, and necessary explanations |
| READMEs | Requested section order, supported story, parallel features, setup before deeper reference |
| Blogs and essays | Supported perspective, connected ideas, meaningful narrative pacing, and deliberate voice |

Treat commands, code, URLs, identifiers, and approved brand text as exact material outside the prose pass.
Change them only when inspected evidence supports a technical correction. Recheck the reader's path afterward.

## Verify facts and assumptions

Source every non-trivial factual claim, including claims already present in the draft.
These include numbers, comparisons, causal claims, capabilities, and claims that affect a reader's decision.

- **Inspect evidence.** Prefer primary sources, inspected code, or recorded measurements. Match scope, date, conditions, and exact claims.
  Verify current claims with current evidence. Place citations beside claims when allowed; otherwise keep source links in the handoff.
- **Test relevant assumptions.** Identify assumptions that affect the conclusion. Seek evidence that could disprove them.
  Use authorized reproducible checks or counterexamples where appropriate. Report results and limits.
  A plausible assumption or supporting citation alone does not prove the conclusion.
- **Expose gaps.** Distinguish verified facts, inferences, opinions, and supplied personal experience. Attribute experience without claiming independent verification.
  If evidence is missing or conflicting, flag the claim and propose qualification or removal.
  Never silently change meaning, invent checks, or call an unresolved claim verified.

Keep verification proportionate. Opinions and ordinary phrasing need no artificial citations.
If tools or sources are unavailable, identify unchecked claims and assumptions.
For evidence-backed articles, follow the brief and local voice. Never turn an observation into a guarantee.
For a collection refresh, record verified sources and review each article against them.

## Respect the author and destination

Read supplied voice rules and canonical product wording. Preserve approved names, taglines, claims, and required text.
Compare the final copy with any supplied copy guide. No sibling Skill is required.
Never pretend to be human, invent credentials or feelings, or claim the author's experience as your own.
Do not add promises, offers, or team membership without the author's agreement.
Drafting in their voice does not authorize signing their name or publishing unseen text for them.
Keep claims about checks, measurements, effort, and human review tied to evidence.
Use exact names and stated pronouns; otherwise use a username or singular they.
Follow user and destination disclosure requirements. Preserve required disclosures; do not add one by default or assume human review.

## Check and deliver

Apply [claim fidelity](references/blocks/claim-fidelity.md) against the source after editing.
Undo unsupported additions, lost claims, and needless voice changes. Ask for missing information when a required meaning change is unresolved.
Check that the reader can find the point, understand the terms, and follow required steps.
When simplifying these instructions, preserve narrative voice rules, accuracy checks, and explicit ADHD and dyslexia guidance.
If rendering is available, inspect the result at a narrow width. Report that limit when relevant otherwise.
These blocks are bundled here. No sibling installation is required.

Deliver the requested text or file edit in the requested format.
Explain meaningful repairs when requested or useful. Do not require a routine list of supposed AI tells.
Keep review notes, sources, assumption checks, and evidence gaps outside the published text when its format excludes them.
For output-only requests, omit review notes unless an unresolved gap blocks the result.
If no edit is needed, return the text unchanged and say so when the format permits. Never invent problems to justify a rewrite.
Before delivery, check whether the reader needs the message. Cut reflex flattery, repetition, and unsolicited lectures.
Respect the requested scope if no delivery is useful.

Reader respect, accessibility, truthful authorship, evidence, and explicit style requirements govern both passes.
Keep useful techniques flexible. Never sacrifice meaning or voice to make prose appear human.
