---
tags: [trigger, technical-guide]
max_turns: 3
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill]
---

Our docs page on configuring the Redis cache is stale since we released v3 of our SDK. Refresh it against the current release.

# Redis cache
Install the adapter with `npm i @acme/cache-redis@2`, then call `createCache({ driver: 'redis', url })`.
