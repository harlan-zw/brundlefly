# Preservation pilot, 2 October 2026

The revised skill avoids observed padding and preserves clear wording more often in this pilot.
The judge disagrees with published reference edits. These scores cannot establish overall writing quality.

## Observed change

The development input used the phrase `floating unnamed`.
The original skill added `around`. The revised skill kept the phrase intact.

The held-aside input used `is a default`.
The original skill added `just`. The revised skill kept the neutral assertion.

The change adds explicit restraint, protects compressed phrasing, and checks the rewrite against the source.
It also permits an unchanged result when editing adds no value.
The revised instructions were frozen before inspecting held-aside judgments.

## Model judgments

These counts use the revised pass, where all editors receive fresh judgments under the same protocol.
Original editor outputs stay fixed. The revised skill gets one fresh generation for each case.
Identical outputs share one judgment within each pass.

| Editor | All five checks, development | All five checks, held aside | Point preservation check |
| --- | --- | --- | --- |
| no-skill | 5/6 | 2/4 | 9/10 |
| write-human-v0 | 5/6 | 0/4 | 8/10 |
| write-human-v1 | 6/6 | 2/4 | 10/10 |
| humanizer | 4/6 | 1/4 | 10/10 |
| stop-slop | 3/6 | 0/4 | 5/10 |

Preservation is the first published rubric question. A failure blocks a clean pass.
The remaining questions assess voice, restraint, cadence, and naturalness.
These are model opinions, not human preference votes or verified factual accuracy.

## Why this is not a leaderboard

The judge penalizes the exact published reference rewrite for the period-as-dash example.
It calls the conditional rewrite a loss of voice, although the source author recommends it.
The dash example also attracts style penalties for edits consistent with the source author's example.

Rejudging identical text across passes changes some verdicts.
For example, the original period-as-dash output fails preservation initially and passes it in the revised judgment.
This exposes judgment variance. It does not show an editor improved between those judgments.

The selected checks emphasize restraint. They do not directly measure removal of each listed AI pattern.
For example, a retained rhetorical hook can receive a clean pass.
A copy-only editor could score well on several inputs. Treat that as a measurement limit.

All inputs are short synthetic examples from one author.
The four held-aside examples are public, so they are not evidence of unseen model behavior.
Both models share a provider and family. No human readers judged these outputs.
One generation per editor and case cannot estimate generation variance.
Long drafts, genre coverage, supplied voice samples, and reporting quality remain unmeasured.

## Source and execution record

See [method and source links](README.md), [case provenance](cases.json), and [pinned sources](sources.json).
All ten inputs reproduce published wording exactly. No original writing cases were added.
The authors' MIT notices accompany the source copies.
New original cases require owner confirmation.

The final runs use OpenCode 1.18.32, Node 24.18.0, GLM 5.3 Flash, and GLM 5.2.
The runner verifies each exported user prompt against the supplied prompt.
It rejects tool use and requires one user message per session.

Earlier transport and response-format experiments are excluded from these results.
Raw logs remain outside the repository. Normalized outputs and judgments follow:

- [Initial development](results/development-initial.json)
- [Revised development](results/development-revised.json)
- [Initial held-aside set](results/holdout-initial.json)
- [Revised held-aside set](results/holdout-revised.json)

## Decision

Keep the demonstrated restraint fix.
Use this pilot to inspect drift, not to advertise competitor superiority.
A broader evaluation needs reviewed cases and judge calibration against their intended edits.
Any original cases must be shown to the owner before inclusion.
