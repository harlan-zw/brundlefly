---
tags: [trigger, dev, verify-examples]
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

Verify that the quickstart commands in our README work from a clean project, without rewriting the README.

## Quickstart

```sh
npm create vite@latest demo -- --template vanilla-ts
cd demo && npm install
npm run build
```
Expected: `dist/index.html` exists after the build.
