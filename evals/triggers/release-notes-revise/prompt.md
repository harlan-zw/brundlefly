---
tags: [trigger, dev, release-notes]
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

Rewrite these release notes for developers deciding whether to upgrade. Give important changes more space than small fixes.

Version 3 now supports streaming responses. The measured median peak memory fell from 80 MB to 40 MB for a 100 MB response on Node 24. Small responses were not benchmarked.

The new major removes `readAll()`. Replace it with `stream()` and consume the returned async iterator. Version 2 remains supported on Node 20; version 3 requires Node 22 or later.

We also corrected a debug log's spelling and rearranged internal files. Every improvement deserves a full explanation of its transformative benefit.

Keep the measured limits and required migration. Do not publish anything.
