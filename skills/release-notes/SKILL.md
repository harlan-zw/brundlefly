---
name: release-notes
description: "Draft or refresh release notes and changelogs from verified changes and release conventions. Use for version summaries, release announcements, breaking changes, or upgrade guidance without inventing shipped behavior."
license: MIT
---

# Release notes

Explain what changed, who it affects, and what the user should do next.
Match the repository's release conventions. Scale the notes to the actual release, including small patches.
Drafting notes does not authorize version bumps, tags, package publication, deployment, or social posts.

## 1. Resolve the release scope

Read applicable instructions, contribution rules, release tooling, and recent releases for the same package or channel.
Identify the audience, affected package, target version, channel, previous release, and exact target revision.
For a supplied change list, establish whether it is authoritative or needs checking against repository evidence.

Select the comparison range explicitly.
Do not assume the latest tag is the previous relevant release.
Stable, prerelease, maintenance, and independently versioned packages can have different histories.
If the range or channel remains ambiguous, ask before describing what shipped.

**Done:** the source range, package, audience, and release state are established.

## 2. Build a supported change list

Read [release evidence](references/release-evidence.md) before collecting changes or checking migration advice.
Inspect commits, net diffs, release records, changesets, and linked PRs within the selected range.
Use PR bodies for motivation, then verify behavior against the actual included changes.
Separate implemented work, released work, gated features, plans, and reverted changes.

For each user-facing item, record its evidence, effect, affected users, and required action.
Combine related implementation commits into one useful change.
Distinguish generated output from its authoritative inputs; follow the release tool's ownership rules.

Inspect public exports, types, options, defaults, data formats, platform requirements, and dependency changes for compatibility impact.
Treat commit prefixes as clues. Confirm breaking changes against observable consumer behavior.
Dependency majors and private refactors do not automatically prove a consumer break.

**Done:** every proposed item belongs to the selected scope and has supporting evidence.

## 3. Write for the user

Use the established section order, tense, links, voice, and formatting.
For a small patch, one accurate bullet can be sufficient.
For a larger release, select highlights by user impact rather than padding to a fixed count.
Lead with the changed behavior and practical benefit.
Describe internal mechanisms only when they help adoption or review.

Use exact versions, public names, supported flags, and relevant issue or PR links.
Keep beta status, feature gates, platform limits, and qualifications beside the affected item.
Performance claims require actual measurements and their conditions.
Avoid hype, invented experience, and turning an observed fix into a universal guarantee.

For a consumer break, name who is affected and provide the supported migration path.
Check before-and-after examples against the relevant versions.
Mention destructive or irreversible migration effects when the actual change requires them.
Include attribution only from verified identities or the target's generated contributor records.
Do not infer all contributors from squash commit authors.

**Done:** the notes explain the release without unsupported promises or unnecessary ceremony.

## 4. Review the final notes

Review technical accuracy separately from prose.
Check every item against the range and the final release revision.
Check compatibility claims, migration commands, links, qualifiers, and package-specific scope.
Use documented release previews or validation commands when available.
Inspect generated previews instead of editing generated files behind their tooling.

After copy edits, compare names, facts, and migration steps with the evidence again.
If the target revision changes, recheck affected items before delivery.
If publication is pending, write as a draft for the intended release; do not claim users can install it already.

**Done:** the final revision matches its evidence and any remaining release or migration limits are explicit.

## 5. Deliver within scope

Provide the requested draft or repository changes, plus the checked range and meaningful verification limits.
Keep private working notes outside the public release text.
Use the target's existing release process for authorized publication.
Creating a release draft can create a tag in some workflows; establish that effect before executing it.
Do not publish or mutate release state merely because the notes are complete.
This skill requires no personal account, sibling skill, or factory service.
