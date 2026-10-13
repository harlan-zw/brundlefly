---
tags: [trigger, dev, readme]
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

Write a README for my CLI tool. It splits CSV files into separate files by a column value.

package.json:
{ "name": "csvslice", "version": "0.3.0", "bin": { "csvslice": "./dist/cli.js" }, "description": "Split CSV files by column value" }
