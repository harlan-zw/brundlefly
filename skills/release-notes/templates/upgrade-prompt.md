# Optional coding-agent upgrade prompt

Fill this only with verified release facts. Remove unused sections and placeholders before delivery.
The prompt must work without the release article or this Skill installed.

```text
Help me upgrade [package] from [previous version] to [target version].
Inspect this project before proposing changes. Show a diff for each required migration.

Supported environment:
[Exact runtime and dependency ranges, with their source.]

Required changes, ordered by consequence:
For each change, provide:
- The condition that makes this project affected.
- Exact names or patterns to find.
- Verified old and new usage, including changed imports or configuration.
- Required steps and their order.
- The linked migration reference.

Optional changes and deprecations:
[Only verified items relevant to this project. Keep them separate from required work.]

Verify:
[The project's supported install, typecheck, build, and relevant behavior checks.]
Report checks that could not run. Do not publish, deploy, or change external state without authorization.
```
