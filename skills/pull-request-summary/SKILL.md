---
name: pull-request-summary
description: "Draft, edit, or check pull request description text against the actual change and repository conventions. Use before publishing a PR body, when its scope changes, or as the description gate inside a delivery Skill."
license: MIT
---

# Pull request summary

Return a reviewable pull request description grounded in the actual change.
This Skill owns description text only. The caller owns delivery and repository policy.
Do not create branches, stage files, commit, push, publish, manage CI, or post replies.
Do not change the PR title, labels, draft state, or reviewer decisions.

## 1. Establish the description inputs

Read applicable user instructions, repository rules, and the caller's description requirements.
Read [repository conventions](references/conventions.md) to resolve the effective template and contributor guidance.
Use supplied context or permitted read-only tools. No GitHub integration is required when the inputs are supplied.

Confirm the intended base and inspect the complete net diff, relevant commits, and supplied issue context.
For an existing PR, obtain its current body and identify the requested edit.
Ground motivation in the user's request, issue, or recorded intent.
Ask only when missing intent materially changes the description.
If a required source is unavailable, return the specific gap instead of inventing its contents.

## 2. Draft or revise the body

Lead with the concrete problem or goal, then explain the resulting behavior.
Let the diff carry routine implementation details.
Scale detail to risk. Small changes normally need one to three sentences.
Include migration steps, measured comparisons, or examples only when they help the reviewer decide.

Follow the selected template and the caller's requirements.
Preserve mandatory headings, comments, disclosures, and checklists.
Remove optional empty sections only when the repository allows it.
Tick only supported facts. Leave human attestations for the human.
Report verification only where the applicable rules require or allow it.
Never turn missing checks into passing checks.

Preserve author-written notes, attachments, uncertainty, and decisions outside the requested edit.
Rewrite obsolete generated text around the final diff.
Use first-person experiences only when their author supplied them.
Never invent authorship, human review, measurements, consensus, deadlines, or promises.
Honor required AI disclosure. Preserve it during edits.
If disclosure rules require unknown facts, return that gap to the caller.

Use concrete words and short sentences. Cut prose that only shows effort.
Use sentence case for authored prose. Start sentences with a capital letter unless exact reference casing requires otherwise.
If a lowercase identifier starts a sentence, rephrase: "The `im-not-a-fly` skill...". Never change the identifier's casing.
Format exact skill names, identifiers, commands, and file paths as inline code.
Use descriptive Markdown links when readers should open a referenced file, PR, issue, document, or source.
Keep ordinary product names in plain text. Preserve required wording, quoted text, and existing author material outside the edit.
Use lists when they help review. Preserve required template checklists.
Do not use em dashes or hyphens as sentence punctuation.
Use exact names and stated pronouns. Otherwise use a username or singular they.

## 3. Check the description

Compare every factual claim with the diff and supplied evidence.
Check that motivation, scope, consequences, and migration match the final change.
Check the template, caller policy, disclosure, preserved material, and unsupported claims.
Check sentence starts for unnecessary lowercase. Preserve exact casing inside code, links, and quotations.
Check that technical references use inline code or useful links. Check link destinations against supplied or inspected evidence.
Revise the body until it passes these checks.

Return the final description text separately from any unresolved gaps.
If required inputs are missing, tell the caller which description checks could not complete.
A passing description check proves neither implementation correctness nor publication readiness.

## Caller contract

A delivery Skill supplies the diff, intent, effective template, existing body, and local description policy.
It may add disclosure formulas, section rules, diagrams, or repository-specific requirements.
This Skill applies those requirements and returns description text without taking over delivery.
The caller confirms the remote body before publication and reconciles concurrent edits.
