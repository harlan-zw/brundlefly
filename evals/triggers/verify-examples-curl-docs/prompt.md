---
tags: [trigger, dev, verify-examples]
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

Do the curl examples in this API doc return what the doc promises?

```sh
curl -s https://httpbin.org/status/418 -o /dev/null -w '%{http_code}'
```
Expected output: 418
