---
tags: [trigger, pull-request-summary]
max_turns: 3
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill]
---

Write the pull request description for this diff.

--- a/src/date.ts
+++ b/src/date.ts
@@ export function parseDate(input: string) {
-  return new Date(input)
+  const date = new Date(input)
+  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) throw new InvalidDate(input)
+  return date
