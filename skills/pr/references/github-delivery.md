# GitHub delivery

Use these commands when Git and GitHub CLI are the available integrations.
Equivalent authenticated APIs can perform the same workflow.
Check the installed interface before using an unfamiliar option.
Identifiers below are variables resolved from the actual repository, not fixed branch names.

## Inspect

```sh
git rev-parse --show-toplevel
git status --short
git branch --show-current
git remote
gh --version
gh auth status
gh repo view --repo "$target_repo" --json nameWithOwner,defaultBranchRef
```

Keep credentials private. Inspect remote URLs through a redacting integration when they may contain credentials.
Set `target_repo` to the contribution target, which may differ from the push remote in a fork workflow.
Resolve `base_ref`, `head_repo`, `head_branch`, and the push remote before mutation.
If current remote refs are needed, fetch the permitted remote without changing unrelated working files.

```sh
git log "$base_ref"..HEAD --oneline
git diff --find-renames "$base_ref"...HEAD
git diff
git diff --cached
gh pr list --repo "$target_repo" --state open \
  --json number,title,baseRefName,headRefName,headRepository,headRepositoryOwner,isDraft,url
```

Check task-owned untracked files separately. They are absent from these diffs.
Filter PR results by both head identity and intended base.
For a large repository, use supported branch or search filters and pagination so a matching PR is not missed.

## Resolve inherited template

```sh
gh api "repos/$target_repo/community/profile"
```

Inspect `files.pull_request_template` and read its returned API URL if present.
If access fails, preserve the error and prepare a draft with that limitation.

## Publish task-owned changes

Follow the repository's isolation and branch naming rules before editing.
Stage explicit paths, inspect the staged diff, run required checks, then commit through enabled hooks.
Confirm the index contains only task-owned changes before committing. Preserve unrelated staged work through approved isolation.

```sh
git add -- "$owned_path"
git diff --cached --check
git diff --cached
git commit -m "$commit_subject"
git push "$push_remote" "HEAD:refs/heads/$head_branch"
git rev-parse HEAD
```

Repeat explicit paths as needed. Do not replace this with staging the whole working tree.
Remember the local SHA that should appear remotely.
If push fails, retain the exact cause. Retry only after a supported correction within the authorized scope.

For a new PR, use the selected draft state and a reviewed body file:

```sh
gh pr create --repo "$target_repo" --base "$base_branch" \
  --head "$head_selector" --draft --title "$pr_title" --body-file "$body_file"
```

`head_selector` must identify the actual head owner and branch in a fork workflow.
Use the installed CLI's supported syntax. Omit `--draft` when readiness and requested state justify it.

For an existing PR, read its current content before updating:

```sh
gh pr view "$pr_number" --repo "$target_repo" --json title,body,isDraft,headRefOid
gh pr edit "$pr_number" --repo "$target_repo" --title "$pr_title" --body-file "$body_file"
```

Keep author notes and required disclosure in the reviewed body file.
Do not change draft state as a side effect of updating prose.

## Confirm the result

```sh
gh pr view "$pr_number" --repo "$target_repo" \
  --json url,title,body,baseRefName,headRefName,headRefOid,headRepository,headRepositoryOwner,isDraft,state
gh pr checks "$pr_number" --repo "$target_repo"
```

Compare the remote head SHA with the local SHA recorded after the push.
An unexpected head change invalidates conclusions about the previous revision.
Reconcile concurrent work rather than overwriting it or declaring the new revision verified.

If waiting is in scope, use `gh pr checks --watch` or the provider's run watcher.
Inspect failed check logs before repairing task-owned defects.
If checks are absent, inspect workflow path filters, events, and permissions.
Report a verified exclusion separately from an unexplained missing run.
Keep incomplete human review separate from completed CI.
