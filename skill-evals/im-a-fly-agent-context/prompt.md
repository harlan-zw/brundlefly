---
tags: [trigger, im-a-fly]
max_turns: 3
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill]
---

I'm pasting these deployment notes into a coding agent's context. Cut tokens but keep all the facts.

Our deployment process works like this. First of all, you need to make sure that the staging environment is green. After that, and only after that, you can promote the build to production by running the promote command. Note that production deploys are not allowed on Fridays after 3pm UTC, except for hotfixes that have been approved by the release manager.
