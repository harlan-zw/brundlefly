---
tags: [trigger, clarity]
max_turns: 3
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill]
---

Do a clarity pass on this paragraph only. Do not change the claims or the tone.

Configuration of the retry behavior, which is something that can be adjusted by way of the maxRetries option that is available in the client constructor, will by default result in three attempts being made before an error is surfaced to the caller.
