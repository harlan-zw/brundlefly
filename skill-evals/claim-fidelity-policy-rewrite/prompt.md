---
tags: [trigger, claim-fidelity]
max_turns: 3
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill]
---

Check whether this rewrite preserved every condition from the original policy.

Original: Contractors MUST NOT access production unless an on-call engineer approves the session and the session expires within 4 hours.
Rewrite: Contractors should get approval before accessing production.
