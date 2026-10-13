---
tags: [trigger, dev, glossary]
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

We call the same thing "job", "task", and "run" across the UI, the API, and the docs. Audit our naming and pick canonical terms.

UI heading: "Run history"
API route: GET /api/jobs/:id
Docs: "Each task executes your pipeline once."
Database table: pipeline_runs
