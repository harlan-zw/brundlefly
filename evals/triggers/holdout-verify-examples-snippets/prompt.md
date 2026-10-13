---
tags: [trigger, holdout, verify-examples]
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

Test whether the snippets in this tutorial still work with the current version of zod.

```ts
import { z } from 'zod'
const User = z.object({ name: z.string() })
console.log(User.parse({ name: 'Ada' }))
```
Expected output: { name: 'Ada' }
