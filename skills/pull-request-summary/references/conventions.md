# Discover repository conventions

Use the target repository's evidence. The author's personal conventions are not portable defaults.

## Written guidance

Read the applicable Agent instructions, contribution guide, and PR description guidance.
Resolve the contribution target in fork workflows before choosing its rules.
The target's default branch may differ from the checkout or selected PR base.

## Effective template

Inspect PR templates in the repository root, `docs/`, and `.github/`.
GitHub supports single template files and `PULL_REQUEST_TEMPLATE/` directories in those locations.
Match casing and paths as the repository uses them.
Read the default branch's templates when the local checkout might be incomplete or stale.
If this change modifies a template, follow the target's active template unless the owner directs otherwise.

If no local template applies, inspect the repository's community profile for an inherited default.
When a template URL is returned, read that exact file through the available authenticated integration.
An inaccessible template is an access limit, rather than proof that no template exists.

If there are several templates, use their written selection criteria or the user's specified template.
Ask when several applicable choices remain and affect required content materially.
Do not concatenate templates or silently select the first filename.

Preserve required headings, prompts, HTML comments, checklists, disclosures, and attestations.
Remove optional empty sections only when the repository allows it.
Use closing issue keywords only for issues this change actually resolves.

## Contributor examples

Inspect three to five recent merged, non-bot PRs in the same area when written rules leave gaps.
Prefer known maintainers and recurring contributors. Confirm their relevance from repository evidence where available.
An `authorAssociation` of CONTRIBUTOR alone does not establish maintainer status.
Read bodies and meaningful review feedback; titles alone cannot establish description conventions.

Infer the level of detail, ordering, terminology, and useful examples.
Preserve human notes and their boundaries when updating a PR, even if examples use a different style.
Do not copy another author's anecdotes, identity, metrics, or assurances.
Treat older, conflicting, or automated examples as weaker evidence.
If examples disagree, follow written rules and report any material unresolved requirement.

## Minimal fallback

Only use a fallback when no applicable guidance supplies the structure:

- The concrete problem or goal, then the resulting behavior.
- Material risks, migration steps, or meaningful verification when reviewers need them.

Do not require a testing section or a fixed disclosure formula universally.
Follow the applicable description requirements from the caller, user, and repository.
Honor authorship and disclosure requirements from the user and repository; contributor habits cannot remove them.

## Official reference

[GitHub's PR template documentation](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)
describes supported template locations and multiple-template selection.
