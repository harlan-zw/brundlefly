# Release evidence

## Establish the range

Resolve previous and target revisions from the requested package and release channel.
Inspect release metadata and tag ancestry rather than sorting tag names and assuming the first is correct.
Date-based PR searches are discovery aids. A merged date alone does not prove inclusion in a release.
Maintenance branches, cherry-picks, and monorepos require checking the actual revision range.

If Git is available, inspect the resolved range:

```sh
git log "$previous_ref".."$target_ref" --format='%H %s%n%b'
git diff --find-renames "$previous_ref" "$target_ref"
```

Read net changes and linked PR context. Preserve relevant changes whose titles lack semantic prefixes.
Check reverts and superseding fixes before describing behavior.
If only a supplied list is available, state that evidence boundary in the handoff.

## Inspect the consumer contract

Check public APIs, CLI flags, configuration, defaults, schemas, runtime requirements, and installation constraints.
A type-only public change can break consumer compilation. Private changes can alter observable behavior.
Use actual consumer impact, rather than labeling either category harmless by default.
Check changed dependency requirements against the published interface and supported environments.

For each compatibility issue, establish:

- The affected users and versions.
- The old and new behavior or interface.
- The required action and supported example.
- The evidence behind the claim and any verification limit.

Follow the repository's versioning policy. Raise a mismatch between its policy and observed compatibility impact.
Do not silently change the target version.

## Verify migration guidance

Use the documented starting version, setup, and toolchain.
Run safe before-and-after examples in isolated environments when practical.
Check imports, names, defaults, and configuration against both relevant revisions.
Respect authorization for data changes and production operations.
If execution is unavailable, inspect versioned source and name the untested path.
Successful release generation does not prove migration correctness.

## Match the repository's release machinery

If changesets or pending change files are authoritative, edit those inputs and preview their generated output.
Preserve auto-appended links and formatting rules.
Do not edit already released notes to describe unreleased changes.
For corrections to historical notes, preserve their release scope and follow the target's correction policy.

Keep factual verification distinct from prose preference.
An attractive announcement cannot substitute for an accurate included-change list.
