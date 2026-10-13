---
tags: [trigger, dev, verify-examples]
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

Check that the code examples in this guide actually run and produce what the guide says.

```sh
npm create vite@latest my-app -- --template vue-ts
cd my-app && npm install && npm run dev
```
Expected: the dev server prints a local URL on port 5173.
