# Copy examples

These examples are illustrative. The product, its COPY.md rows, and its strings are invented.
Use the target project's recorded wording for real copy.

## Write a surface against COPY.md

Request: "Write the empty state for the saved searches page."

COPY.md excerpt:

```md
| Context | Register | Example |
| --- | --- | --- |
| Empty states | Acknowledge, explain value, give the action | "No reports yet. Reports collect your saved charts in one place. Create a report" |

| Never | Use instead | Why |
| --- | --- | --- |
| Oops, Uh oh | State what happened | Cute openers delay the information |
```

GLOSSARY.md names the concept Saved search and bans filter preset.

Draft:

```text
Oops! You haven't saved any filter presets yet :( Save one to get started!
```

Problems:

- "Oops" is banned language.
- "Filter preset" is a banned synonym for Saved search.
- The register needs a value line and an action. "Get started" names neither.
- The register example uses no exclamation marks or emoticons.

Result:

```text
No saved searches yet. A saved search keeps your filters so you can run it again. Save this search
```

Handoff:

```text
Surface: empty state, saved searches page
Register row: Empty states
Glossary terms: Saved search
New canonical strings: none
```

The value line describes what saving does. Claim more, such as one-click alerts, only if the product supports it.

## Propose a change to a canonical asset

Request: "Shorten the tagline for the social card."

COPY.md records the tagline "Plan sprints from real search data." for the landing H1 and social card headline.
A shortened tagline would be a second tagline, so the reply keeps the asset exact and proposes a new row:

```text
The social card headline uses the Tagline asset, so I kept it exact:
"Plan sprints from real search data."

If the card needs a shorter subhead, I propose this Category descriptor row:
| Category descriptor | Search-data sprint planner | social card subhead, registry listings |

It displaces no existing string. Approve it before I use it.
```
