---
name: slop-naming-recovery
description: "Find generic technical names that obscure user tasks and propose names grounded in the product domain. Use when vague terms enter code, features, UI copy, or GLOSSARY.md, including implicit names and explicitly approved terms."
license: MIT
---

# Slop naming recovery

Find implementation names that hide users' tasks. Recommend domain names with evidence before adopting them.
The domain comprises users' objects, actions, and decisions: bookings, payroll, source symbols, and import paths.
Treat naming slop as a problem in the name, never a judgment about its author.
This Skill extends im-not-a-fly's reader-focused editing with product naming review, and also works alone.

## Scope and authority

Read the target project's instructions, GLOSSARY.md, COPY.md, VISION.md, and naming decisions when available.
Look for term definitions in other project documents, such as CONTEXT.md, API docs, or decision records.
Missing GLOSSARY.md does not make a documented name implicit or authorize a new glossary.
Follow its delivery and approval rules. This Skill owns naming review, not publication or architectural redesign.
It works without sibling Skills, private services, or a particular rename tool.
Do not create root documents automatically.

Review documented and implicit names. Consistent canonical terms can still confuse users.
An approved term remains authoritative during review. Propose a supported revision rather than silently overriding it.
Record deliberate decisions and reasons. Reopen them only with relevant evidence or explicit user direction.

Default to an audit with proposed changes. Apply renames only within the user's authorized scope.
If naming approval is required, prepare the complete recommendation before asking.
Existing approval covers the agreed names and scope. Do not request it again.

When fixes and PRs are authorized, deliver supported changes within that scope.

### Optional mode: avoid breaking changes

Before selecting fixes in this mode, read [frozen contracts and database approval](references/recovery.md#frozen-contracts-and-database-approval).
For database changes outside this mode, read the same section before preparing a proposal.
Freeze only requested boundaries. Defer blocked renames and complete independent fixes.

Use [the bundled clarity block](references/blocks/clarity.md) for reader context, wording, order, and accessibility.
Reuse context supplied by im-not-a-fly or another caller. Do not repeat an already completed clarity pass.
Add domain meaning, concept mapping, glossary decisions, and rename scope to that review.

## 1. Understand the product and its language

Before collecting names, read [the product context procedure](references/recovery.md#establish-product-context).
Establish users, problems, outcomes, actions, limits, and audience language from product evidence and representative code paths.
Do not infer purpose from the glossary or architecture alone, or invent research, personas, purposes, or capabilities.
Label language without customer evidence as inference. If purpose remains unclear, report missing evidence before recommending names.
Base every proposal on this account. Word searches alone cannot establish a naming problem.

## 2. Find names and their users

Before discovery, read [the inspection procedure](references/recovery.md#inspect-the-requested-scope).
Inspect the full requested scope before ranking findings. Feedback limits do not limit discovery.
For a repository audit, cover main journeys and user surfaces; keep feature requests focused.
Trace representative inputs through producers to displayed results, including missing data and partial completion.
Record the inspected revision, local changes, journeys, exclusions, and coverage gaps.
Inspect ordinary domain names too. Generic technical words are search prompts, never a ban list.
Preserve accurate audience vocabulary. Recommend an explanation first when it resolves the problem.

## 3. Recover the domain meaning

Read [the naming checks and examples](references/naming-checks.md) and [the concept checklist](references/recovery.md#recover-each-concept).
Write one plain sentence: "[Person] uses [thing] to [task]."
If the task is unclear, report the gap instead of inventing a name.
Map terms to definitions, code owners, user tasks, and public wording, including internal-only feature names.
Separate concepts sharing a name; identify synonyms naming one concept. Preserve distinctions, relationships, and lifecycle states.

## 4. Propose and rank names

Prefer an established, accurate domain term from the project before introducing a new one.
Use concrete object names and task verbs that express user meaning or action.
Do not replace one vague label with another, such as changing every artifact to a resource.
Avoid cute metaphors, invented jargon, and names that imply unsupported capabilities or completed actions.
Preserve technical distinctions that affect user decisions. Plain language must remain precise.

Recommend one name per concept; offer an alternative only for an unresolved distinction.
Show a before-and-after label or identifier, its evidence, and the names it would displace.
Flag whether the name is implicit, glossary-approved, or required by an external contract.
Separate UI wording, internal identifiers, and externally fixed names in the recommendation.
Prefer the smallest surface change that resolves the reading problem. Public wording can improve without an API rename.
Rank by user impact and confidence in the meaning, not occurrence counts or dislike of technical words.
Show migration effort separately. Give highest priority to confusing names on important user actions.

## 5. Deliver or apply the recovery

Lead with the strongest supported finding.
Use a table: Current name | User task | Proposed name | Evidence | Impact /100 | Effort S/M/L | Confidence /100.
Link file lines or supplied sources. Explain scores briefly and identify missing evidence.
Include affected surfaces and any required approvals or migrations beside each finding.
Report justified technical names separately. If no supported problem exists, say so.

Turn actionable findings into numbered proposals using [the feedback format](references/proposals.md).
Show the exact proposed naming document change, its definition, displaced names, and map row when one exists.
Use stable IDs across revisions so users can accept, keep, defer, or edit proposals independently.
Group dependent proposals and explain why they need one decision.
Interpret feedback per proposal. Silence and approval of one proposal do not approve the others.
Revise affected definitions and examples before applying an edited name.

Before applying an authorized rename, read [the recovery procedure](references/recovery.md#apply-an-authorized-rename).

Use [the saved-choice and measurement examples](references/naming-checks.md#removing-a-saved-display-choice) when a removal or verdict affects consumers.
Check saved selections and real report boundaries, including dates, missing inputs, denominators, and source identity.

Run the target's focused checks for affected behavior, imports, consumers, and links.
In avoid-breaking-changes mode, verify the frozen contracts against the base revision and affected consumers.
Search for displaced names and explain intentional remaining uses.
Pass proposed wording and established context to the bundled clarity block; reuse its review of unchanged wording.
Check that each new name preserves meaning and lets its intended user predict the next action.
Report executed checks separately from source inspection and untested user understanding.
