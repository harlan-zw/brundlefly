---
tags: [trigger, slop-naming-recovery]
max_turns: 3
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill]
---

Our codebase is full of names like DataManager, ItemProcessor, and handleEntity. Review these names and suggest names grounded in what our users actually do.

export class DataManager { process(item: Item) { /* approves a timesheet for payroll */ } }
