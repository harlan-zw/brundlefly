---
name: release-notes
description: "Writes or revises release notes, changelogs, release announcements, and upgrade guidance from verified changes. Use when someone asks what a release should say, wants GitHub release notes, or asks to make an existing release article more useful and concise."
license: MIT
---

# Release notes

Help the reader decide whether to upgrade and understand what they must change.
Reader attention is finite. Allocate it before drafting, rather than giving every change equal space.

This Skill owns the text and its evidence. The caller owns branches, commits, publication, and release operations.
Follow the user's instructions and the destination's terminology, copy rules, templates, and disclosure requirements.
Do not create a release, publish under the author's name, or install another Skill automatically.

## 1. Establish the release and reader

Identify the product, previous version, target version or commit, audience, destination, and requested scope.
Read an existing draft in full. Read relevant release conventions and migration guides.
Infer clear inputs from the request and repository. Ask only when a missing choice materially changes the work.
Distinguish released behavior from later commits, plans, and unreleased dependencies.

Predict how much attention this piece will receive, using the reader's purpose and destination.
Use supplied preferences. Otherwise record a reasonable assumption in private evidence notes.
An initial scan should answer what changed, whether the reader can upgrade, and what requires action.
A detailed migration guide serves a different reading task from an announcement.

## 2. Verify and select changes

Use [release evidence](references/release-evidence.md) to inspect the actual range, public API changes, dependencies, and migration requirements.
Keep a private source record for material claims, examples, measurements, links, and unresolved gaps.
Commit labels and PR descriptions are leads, not proof of consumer impact.
Do not invent contributor credit, benchmarks, compatibility, or a migration path.

Rank changes by consequence for this reader:

- Changes that affect their upgrade decision deserve enough context to assess the value and limits.
- Required actions and consequential warnings belong on the main reading path.
- Smaller improvements need a short description or a useful changelog link.
- Specialist detail belongs beside its use, in optional detail, or in a checked migration guide.

Choose scope, order, and depth from that ranking and the predicted attention.
Author effort, commit count, and novelty alone do not establish reader importance.
Use as few highlights as the release warrants. Do not fill a target number.

## 3. Draft for the destination

Start with the important change or required action. Explain its effect in plain words.
Give strong changes more depth. Keep smaller fixes concise.
Use short prose, bullets, tables, or examples according to what the reader needs to compare or do.
Do not repeat the same feature in the introduction, highlights, upgrade section, and conclusion.
Repeat only the condition or warning needed at the point of action.

Keep exact versions, package names, commands, links, attribution, and meaningful qualifications.
Put test conditions beside performance figures. Distinguish measured outcomes from expected benefits.
Describe supported before-and-after behavior instead of generic praise or promises.
Never invent an author's experience, feelings, or team membership to make the prose sound personal.

Make support requirements and disruptive migration actions easy to find before the reader acts.
Separate required changes from optional configuration and deprecated APIs that still work.
Link to complete migration instructions when the reader needs more detail.
Do not hide a prerequisite or consequential warning inside optional content.

A GitHub release may use a short overview and upgrade checklist with links to the full article.
A site article may give the main changes more explanation and keep a detailed reference below.
Review each destination separately. Do not duplicate the complete article by default.
Keep changelog entries brief, grouped by user consequence, with checked PR or compare links.
Follow a required category scheme. Otherwise omit empty sections and internal changes that do not serve the requested scope.
Preserve existing contributor credit and generated changelog material unless the user asks to change it.

If an agent upgrade prompt would serve the request, use [the prompt template](templates/upgrade-prompt.md).
Keep it self-contained and optional. It must not replace human-readable migration instructions.

## 4. Review the complete output

Apply [clarity](references/blocks/clarity.md) to scope, emphasis, reading order, and wording.
Read the opening and headings as an initial scan. Then read the main path without optional detail.
Check that the important changes receive enough attention and the smaller changes do not crowd them out.
Remove repeated explanations and stock takeaways. Short sentences alone do not establish useful editing.

Apply [claim fidelity](references/blocks/claim-fidelity.md) against the source and authorized selection.
For new notes, compare claims with the evidence record. For revisions, also check the original draft.
Use [verify examples](references/blocks/verify-examples.md) for runnable commands and before-and-after code when relevant.
Check affected links, anchors, and the destination's Markdown features.
If rendering is available, inspect a narrow view and any optional sections. Report unavailable checks.

## 5. Deliver

Return the requested text or file edits. Keep evidence notes and review commentary outside the published copy.
Lead the handoff with the outcome. Name material evidence gaps or untested paths briefly.
Do not equate word-count reduction, an agent's approval, or a trigger evaluation with human reader approval.
Respect existing publication authority. Writing the notes does not authorize release operations.
