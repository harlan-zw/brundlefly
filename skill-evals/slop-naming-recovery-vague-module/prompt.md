---
tags: [trigger, slop-naming-recovery]
max_turns: 3
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill]
---

The names in this module feel generic. Find the vague ones and propose domain names.

export function processResource(resource: Resource) {}
export function handleEntity(entity: Entity) {}
export type ItemData = { payload: unknown }
