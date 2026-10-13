---
tags: [trigger, claim-fidelity]
max_turns: 3
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill]
---

Before I accept this edit, verify nothing in the original rules was weakened.

Original: Never commit secrets. If a secret is committed, rotate it immediately and notify security.
Edited: Avoid committing secrets, and rotate any that leak.
