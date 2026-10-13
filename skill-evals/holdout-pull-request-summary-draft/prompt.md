---
tags: [trigger, holdout, pull-request-summary]
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

Draft a PR body for this change.

--- a/src/config.ts
+++ b/src/config.ts
-export const TIMEOUT_MS = 5000
+export const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 5000)
