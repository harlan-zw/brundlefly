---
tags: [trigger, holdout, negative]
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

Rename the variable x to count in this function.

function tally(items: string[]) { let x = 0; for (const item of items) x++; return x }
