---
tags: [trigger, pull-request-summary]
max_turns: 3
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill]
---

The scope of my PR changed: I dropped the caching part and only kept the retry logic. Update the PR body to match.

Current body:
## Summary
Adds retries with backoff to the HTTP client and caches GET responses for 60 seconds.
