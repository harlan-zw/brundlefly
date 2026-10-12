# Recovery procedures

Load each section when SKILL.md directs you. Shared rules stay in the main workflow.

## Frozen contracts and database approval

Record the requested mode and frozen surfaces before selecting fixes.
An endpoint freeze does not prevent improving its UI label.
For endpoints, preserve paths, methods, request and response fields, and externally used identifiers.
For databases, preserve stored names and values, including tables, columns, indexes, and constraints.
Also preserve public exports, CLI flags, and serialized formats when the user requests no breaking changes.
Trace producers and consumers before separating a public label from a fixed identifier.
Improve wording or explanations around those identifiers. Show intentional retained names beside each change.
Do not introduce compatibility aliases or migrations merely to make a naming change possible.

Follow project approval rules for database changes outside this mode.
When explicit database confirmation is required, general naming approval does not cover stored-object renames.
Prepare the exact mapping, migration draft, affected consumers, environment, deployment order, and recovery plan first.
Distinguish approval to adopt a schema change from approval to execute its migration.

## Apply an authorized rename

If a rename is authorized, update its existing naming decision before propagating the approved names.
If no naming document exists, record the decision in the requested output. Create a glossary only when requested.
Update relevant canonical copy, identifiers, consumers, docs, and bundled references within the agreed scope.
Use the project's AST-aware rename tool when available. Read prose occurrences individually.
RipIDE is optional for supported code renames. Prefer a supplied launcher or the project's existing CLI.
Read its local instructions and command help before use. Do not require a personal checkout or sibling Skill.
Review an uncertain target with a dry run, then apply the approved mapping with type verification enabled.
Use RipIDE for supported symbols and file renames. Edit glossary entries, prose, and UI wording in context.
If the tool fails, report it. Never claim success or disable verification to force it.
Do not blindly replace stored values, routes, exports, provider fields, or protocol identifiers.
Inspect compatibility requirements and migration needs before changing these surfaces.
Add compatibility layers only under the project’s explicit policy.
If a required migration is outside scope, report the dependency before making partial changes.

## Inspect the requested scope

For a repository-wide audit, map its main user journeys and the concepts each journey exposes.
Cover navigation, actions, results, empty states, errors, documentation, and developer surfaces where relevant.
A familiar domain name can promise the wrong behavior.
Read UI labels, actions, errors, docs, routes, and public APIs.
Then trace their concepts into types, functions, modules, storage, and producers or consumers.
Use available diffs or history to find new names; neither is required.
Distinguish working-tree evidence from committed behavior.
Use repository search, such as `rg`, and inspect each hit in context.

Look for generic containers and process terms: artifact, attestation, entity, resource, payload, record, pipeline, and orchestration.
Exclude generated files, dependencies, and unrelated ordinary uses.
Keep provider identifiers, protocol terms, and necessary technical vocabulary when they express the audience's actual task.

Prefer customer language from supplied requirements, support material, documentation, or observed UI behavior.
For a developer product, the developer is the user. Familiar technical terms can be the clearest names.
Separate naming problems from missing explanations, feature defects, and unfinished brand migrations.
Do not claim user research, confusion, or historical intent without evidence.

## Establish product context

Read the product vision, requirements, README, important user journeys, and supplied customer evidence.
Trace representative actions into code to confirm the promised behavior.

Write a short, evidence-backed account of:

- The user problem, using clarity’s reader context.
- The desired outcome and actions needed.
- Product behavior, limits, and distinctions.
- Their task language and suitable product voice.

Ground proposed names in audience evidence and supplied voice rules.

## Recover each concept

Read [the naming checks and examples](naming-checks.md).
For each candidate, answer:

- Who creates, views, changes, or relies on this thing?
- What user action produces it, and what action does it enable?
- What object, decision, or outcome does it represent for this user?
- Which distinctions, relationships, and lifecycle states must the name preserve?
- Where does the name reach users, and where could an internal name reach them next?

Include internal names that supply UI strings.

