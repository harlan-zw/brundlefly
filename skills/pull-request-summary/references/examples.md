# Description examples

These examples are illustrative. The repository, issue, diff, and names are invented.
Ground a real description in the target repository's evidence.

## Revise a generated description

Inputs:

- Template: a `## Summary` heading and a `- [ ] I tested this change` checklist that the human ticks.
- Intent: issue #412 reports that users lose unsaved drafts when their session expires mid-edit.
- Net diff: `useDraft()` saves the draft to `localStorage` every 5 seconds. The editor restores it after login. A test covers the restore path.

Generated draft:

```md
## Summary

This PR introduces a robust, seamless draft persistence mechanism that significantly improves the editing experience. It leverages localStorage to ensure users never lose work again.

- [x] I tested this change
```

Problems:

- It opens with praise instead of the problem.
- "Never lose work again" overstates the diff. Edits from the last 5 seconds can still be lost.
- It ticks a human attestation that the agent cannot make.
- It omits the issue and the save interval that a reviewer needs.

Revised description:

```md
## Summary

Fixes #412. Users lost unsaved drafts when their session expired mid-edit.

`useDraft()` now saves the draft to `localStorage` every 5 seconds, and the editor restores it after login. Edits from the last 5 seconds before expiry can still be lost.

- [ ] I tested this change
```

## Describe a small change

Inputs: the repository has no template and no linked issue. The diff changes one condition in `parseDate()`.

```md
`parseDate()` accepted impossible dates such as `2026-02-30` and rolled them into March. It now rejects them with the existing `InvalidDate` error.
```

Two sentences give the reviewer the problem and the new behavior. The diff carries the rest.
