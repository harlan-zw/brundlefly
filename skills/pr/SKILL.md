---
name: pr
description: "Prepare, open, or update a GitHub pull request from actual changes. Use for branch delivery, PR titles and descriptions, or submitting work while following the target repository's templates and contributor conventions."
license: MIT
---

# Pull request

Turn the requested changes into a reviewable PR that fits the target repository.
Run the full delivery workflow when authorized. For prose-only requests, draft the title and body without publishing.

## 1. Identify the repository and scope

Read applicable Agent instructions and contribution rules.
Check whether the target prohibits AI contributions. If it does, stop submission and tell the operator.
Inspect the checkout root, working tree, current branch, remotes, and intended base.
Preserve unrelated changes. Stage only task-owned paths.
If unrelated changes are already staged, use repository-approved isolation or stop before committing them.
Follow the target's branch and worktree rules; do not require a particular worktree tool.

For GitHub delivery, use authenticated GitHub CLI or another available GitHub integration.
Check the target repository and identity before private reads or writes.
Use an existing authorized identity. Do not change accounts or credential scopes silently.
If publication access is missing, prepare the content and report the exact blocker.

**Done:** the repository, task-owned changes, delivery authority, and intended branch relationship are established.

## 2. Find the conventions

Read [repository conventions](references/conventions.md) before writing a title or body.
Resolve written rules and the effective PR template, including applicable inherited defaults.
Inspect recent merged PRs from maintainers or frequent contributors in the affected area for gaps in written guidance.
Record which evidence determines the title, body structure, validation reporting, and required disclosure.
This can be a short working note; it needs no new repository policy file.

Written requirements outrank inferred habits. A contributor example never overrides applicable user or repository instructions.
If requirements conflict, resolve the conflict before publishing dependent content.

**Done:** the selected conventions have specific sources, rather than personal defaults copied from another repository.

## 3. Inspect the actual change

Read the complete net diff against the intended base, relevant commits, and linked issue context.
Check staged, unstaged, and task-owned untracked files before committing.
Confirm the base instead of assuming `main`, `master`, or the current upstream is correct.
If the work depends on another PR, target the parent branch according to the repository's stack rules.

Look for an existing PR with the same base, head repository, and head branch.
Treat permission or network errors as errors, rather than evidence that no PR exists.
Update an existing matching PR in place. Preserve its draft state unless changing it was requested.
Check relevant open work to avoid duplicates. Flag meaningful overlap without silently rebasing onto someone else's work.
Do not submit an unsolicited expansion or duplicate that spends maintainers' attention without a clear benefit.

Ground the motivation in the user's request, issue, or recorded intent.
Ask when missing intent materially changes the description.
Explain behavior and consequences; let the diff carry routine implementation detail.

**Done:** the intended net change and actual branch relationship agree.

## 4. Verify and draft

Run documented checks relevant to the change.
Inspect the diff for accidental files, credentials, generated noise, and unrelated edits.
Fix task-owned mechanical failures. Surface product decisions and unavailable checks.
If checks are failing, describe that accurately and follow the repository's draft or submission rules.

Write the title using the target's format and limits.
Fill its selected template with actual scope, intent, impact, and supported evidence.
Keep required sections, comments, disclosures, and checklists.
Tick only completed checks. Human attestations remain for the human to make.

For updates, preserve author-written notes, attachments, required disclosures, and reviewer decisions outside the requested edit.
Re-read the remote body before replacing it. If it changed during drafting, reconcile instead of overwriting blindly.
Rewrite obsolete generated content around the final diff.

Keep the prose concise and concrete. Use first-person experience only when the author supplied it.
Use lists only when they help review. Keep authored items short, with five items or fewer by default.
Preserve mandatory template checklists rather than dropping required items to meet that limit.
Do not use em dashes or hyphens as sentence punctuation.
Use commas, semicolons, colons, or separate sentences. Keep this rule during editorial edits.
Never claim human identity, team membership, or an anecdote as the agent's own.
Name the operator and actual human review state in an early plain sentence inside the PR body.
Ask before publication if either is unknown. A planned review is not a completed review.
For example: "Prepared by an AI agent for @owner. Human review is pending."
Preserve this disclosure when updating the body, alongside required repository disclosures.
Use exact names and stated pronouns. Otherwise use a username or singular they.
Propose decisions without assigning others work, setting deadlines, or declaring consensus.
Avoid promises of follow-up, meetings, or changes unless the operator explicitly agreed to fulfil them.
Use measured figures only when the work produced them.
Report verification where the template or contribution rules require it.
Avoid adding a ceremonial results list when the repository has no need for one.

**Done:** the draft satisfies selected conventions and makes no unsupported claims about intent, checks, or authorship.

## 5. Publish or update

Read [GitHub delivery](references/github-delivery.md) before committing, pushing, opening, or updating a PR.
Follow the requested review state. For a new PR without another convention, use draft until it is ready for review.
Use explicit repository, base, and head identifiers for creation.
Use a file containing real newlines for the body.

Commit task-owned changes with the repository's format and enabled hooks.
Push only the authorized task branch. Fix forward when published work changes.
Never bypass hooks, force push, or push directly to the target's default branch as part of this workflow.
Permission failures require a supported fix within existing authority, rather than an unrelated merge or credential change.

Read the PR back after publication.
Verify its URL, base, head repository, head branch, head SHA, title, body, and draft state.
Use current-head CI and review evidence. Wait through the available provider's supported watch mechanism when scope includes waiting.
Distinguish absent checks from passed checks. Diagnose unexpected absence using workflow conditions and permissions.
If local work advances, repeat affected checks and update the PR for the new head.

**Done:** the remote PR matches the intended changes and the final report states the actual checks and remaining blockers.

## Handoff

Return the PR URL or prose draft, meaningful verification, and any decision still required.
Opening a PR does not authorize merging, deploying, posting reviewer replies, or changing repository settings.
If responding is authorized, bring a precise answer or verified change. Skip redundant acknowledgements and flattery.
Take criticism seriously. Give at most one calm reply to hostility, then hand back to the operator.
Optional review bots and factory integrations follow target rules. None is required by this skill.
