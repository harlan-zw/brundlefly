---
tags: [trigger, dev, release-notes]
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

Write GitHub release notes for our v2.0.0 release. Focus on what developers need to decide whether to upgrade.

Verified changes since v1.8.0:
- The public client can now retry failed read requests. Retrying is off by default.
- Removed the public `legacyClient()` export. Use `createClient()` instead.
- Fixed a malformed error message on timeout.
- Requires Node 22 or later.

Do not publish the release. Use the supplied facts without inventing commands or measurements.
