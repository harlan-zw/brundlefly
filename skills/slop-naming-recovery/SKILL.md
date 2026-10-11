---
name: slop-naming-recovery
description: "Find generic technical names that obscure user tasks and propose names grounded in the product domain. Use when vague terms enter code, features, UI copy, or GLOSSARY.md, including implicit names and explicitly approved terms."
license: MIT
---

# Slop naming recovery

Find names that describe implementation while hiding what a person needs to understand or do.
Recommend names grounded in the product's domain and users' actual tasks. Show evidence before adopting them.
The product domain means the objects, actions, and decisions users work with.
For example: bookings, payroll, source symbols, and import paths.
Treat naming slop as a problem in the name, never a judgment about its author.
This Skill extends im-not-a-fly's reader-focused editing with a deeper product naming review.
It also works alone. No other Skill needs to be installed.

## Scope and authority

Read the target project's instructions, GLOSSARY.md, COPY.md, VISION.md, and naming decisions when available.
Look for term definitions in other project documents, such as CONTEXT.md, API docs, or decision records.
Missing GLOSSARY.md does not make a documented name implicit or authorize a new glossary.
Follow its delivery and approval rules. This Skill owns naming review, not publication or architectural redesign.
It works without sibling Skills, private services, or a particular rename tool.
Do not create root documents automatically.

Review existing glossary entries as well as names introduced without an entry.
A canonical term can be confusing even when every occurrence uses it consistently.
An approved term remains authoritative during review. Propose a supported revision rather than silently overriding it.
Record deliberate naming decisions and their reasons. Reopen them only with relevant evidence or explicit user direction.

Default to an audit with proposed changes. Apply renames only within the user's authorized scope.
If naming approval is required, prepare the complete recommendation before asking.
Existing approval covers the agreed names and scope. Do not request it again.

Use [the bundled clarity block](references/blocks/clarity.md) for reader context, wording, order, and accessibility.
Reuse context supplied by im-not-a-fly or another caller. Do not repeat an already completed clarity pass.
This workflow adds domain meaning, concept mapping, glossary decisions, and rename scope to that shared review.

## 1. Understand the product and its language

Before collecting names, establish what the application fundamentally helps people accomplish.
For a collection, library, or CLI, identify the equivalent purpose and user tasks.
Read the product vision, requirements, README, important user journeys, and supplied customer evidence.
Trace representative actions into code to confirm the promised behavior.
Do not infer the product's purpose solely from its current glossary or technical architecture.

Write a short, evidence-backed account of:

- Which user problem the product addresses, using the reader context established by clarity.
- The main outcome they want and the actions they take to reach it.
- What the product does for them, including important limits and distinctions.
- The language they already use for those tasks and how the product should speak to them.

Ground proposed names in audience evidence and supplied voice rules.
If customer language is unavailable, label the proposed language as an inference.
Do not invent research, personas, product purposes, or capabilities.
If the fundamental purpose remains unclear, report the missing evidence before recommending names.
Use this account as the basis for every later proposal. Word searches alone cannot establish a naming problem.

## 2. Find names and their users

Start with the requested feature, changed files, or repository scope.
Read UI labels, actions, errors, docs, routes, and public APIs.
Then trace their concepts into types, functions, modules, storage, and producers or consumers.
Use a diff or history when available to find newly introduced names. Do not require either.
Record the inspected revision and relevant local changes. Distinguish working-tree evidence from committed behavior.
Use repository search, such as `rg`, and inspect each hit in context.

Look for generic containers and process terms: artifact, attestation, entity, resource, payload, record, pipeline, and orchestration.
These are search prompts, not a ban list. Find other vague names from the product itself.
Exclude generated files, dependencies, and unrelated ordinary uses.
Keep provider identifiers, protocol terms, and necessary technical vocabulary when they express the audience's actual task.

Connect each concept to the established users and their tasks.
Prefer customer language from supplied requirements, support material, documentation, or observed UI behavior.
For a developer product, the developer is the user. Familiar technical terms can be the clearest names.
Separate naming problems from missing explanations, feature defects, and unfinished brand migrations.
If an explanation solves the problem, recommend that before a rename.
Do not claim user research, confusion, or historical intent without evidence.

## 3. Recover the domain meaning

Read [the naming checks and examples](references/naming-checks.md).
For each candidate, answer:

- Who creates, views, changes, or relies on this thing?
- What user action produces it, and what action does it enable?
- What object, decision, or outcome does it represent for this user?
- Which distinctions, relationships, and lifecycle states must the name preserve?
- Where does the name reach users, and where could an internal name reach them next?

Write one plain sentence: "[Person] uses [thing] to [task]."
Ground it in inspected behavior. If the task is unclear, report the gap instead of inventing a name.
Map the current term to its definition, code owner, user task, and public wording.
Separate different concepts that share a name. Identify synonyms for the same concept.
Treat internal-only names as candidates too, especially when they name a feature or supply UI strings.

## 4. Propose and rank names

Prefer an established, accurate domain term from the project before introducing a new one.
Use concrete object names and task verbs. Name what the thing means or does for its user.
Do not replace one vague label with another, such as changing every artifact to a resource.
Avoid cute metaphors, invented jargon, and names that imply unsupported capabilities or completed actions.
Preserve technical distinctions that affect user decisions. Plain language must remain precise.

Recommend one name per concept. Give an alternative only when a real distinction remains unresolved.
Show a before-and-after label or identifier, its evidence, and the names it would displace.
Flag whether the name is implicit, glossary-approved, or required by an external contract.
Separate UI wording, internal identifiers, and externally fixed names in the recommendation.
Prefer the smallest surface change that resolves the reading problem. Public wording can improve without an API rename.
Rank by user impact and confidence in the meaning, not occurrence counts or dislike of technical words.
Show migration effort separately. Give highest priority to confusing names on important user actions.

## 5. Deliver or apply the recovery

Lead with the strongest supported finding.
Use a table: Current name | User task | Proposed name | Evidence | Impact /100 | Effort S/M/L | Confidence /100.
Link evidence to file lines or supplied sources. Explain scores briefly and name missing evidence.
Include affected surfaces and any required approvals or migrations beside each finding.
Report justified technical names separately. If no supported problem exists, say so.

Turn actionable findings into numbered proposals using [the feedback format](references/proposals.md).
Show the exact proposed naming document change, its definition, displaced names, and map row when one exists.
Let the user accept, keep, defer, or edit each proposal independently using its stable ID.
Keep IDs stable across revisions. Group dependent proposals and explain why they need one decision.
Interpret feedback per proposal. Silence and approval of one proposal do not approve the others.
Revise affected definitions and examples before applying an edited name.

If a rename is authorized, update its existing naming decision before propagating the approved names.
If no naming document exists, record the decision in the requested output. Create a glossary only when requested.
Update relevant canonical copy, identifiers, consumers, docs, and bundled references within the agreed scope.
Use the project's AST-aware rename tool when available. Read prose occurrences individually.
RipIDE is optional for supported code renames. Prefer a supplied launcher or the project's existing CLI.
Read its local instructions and command help before use. Do not require a personal checkout or sibling Skill.
Review an uncertain target with a dry run, then apply the approved mapping with type verification enabled.
Use RipIDE for supported symbols and file renames. Edit glossary entries, prose, and UI wording in context.
If the tool fails, report the failure. Do not claim the rename passed or disable verification to force it.
Do not blindly replace stored values, routes, exports, provider fields, or protocol identifiers.
Inspect compatibility requirements and migration needs before changing these surfaces.
Do not add compatibility layers automatically. Follow the project's explicit policy.
If a required migration is outside scope, report the dependency before making partial changes.

Run the target's focused checks for affected behavior, imports, consumers, and links.
Search for displaced names and explain intentional remaining uses.
Pass the proposed wording and established context to the bundled clarity block.
If the caller already reviewed unchanged wording with clarity, reuse that result.
Check that each new name preserves meaning and lets its intended user predict the next action.
Report executed checks separately from source inspection and untested user understanding.
