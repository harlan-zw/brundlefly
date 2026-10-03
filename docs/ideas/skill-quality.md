# Improve skill quality through evidence

Aim for better technical writing and review submissions in task-matched comparisons.
Repository popularity helps select competitors. It does not measure skill quality.
Keep each skill standalone and directly usable.

## Scope

| Skill | Owns | Boundary |
| --- | --- | --- |
| write-human | General prose editing | Preserve facts and supplied voice; avoid unnecessary rewriting |
| technical-guide | Technical tutorials, task guides, reference, explanations, and supported decision guides | Personal narratives keep their author-led structure |
| pr | Repository conventions, checks, and PR creation or updates | Submission does not authorize merging or reviewer replies |

Classify content by its reader goal, then its subject and voice.
Technical subjects appear in personal stories too. A blog path does not imply a single workflow.
An informative explanation needs conceptual accuracy; a procedure also needs a reproducible reader path.
Comparisons need aligned criteria. Research needs inspectable inputs and methods.

## Competitor evidence

The following candidates were discovered through skilld and inspected from pinned public source revisions on 3 October 2026.
The linked files are research evidence, rather than bundled dependencies or claims of comparative superiority.
Instructions are authored for Brundlefly; source copies stay outside installable skills.

| Source | Useful pattern | Adaptation or boundary |
| --- | --- | --- |
| [mcollina documentation](https://github.com/mcollina/skills/blob/856efd268ae85482d882f3d0bed869fd020b5c06/skills/documentation/SKILL.md) | Choose structure by reader need | Infer clear context; avoid asking before every small edit |
| [Vercel eve technical-writing](https://github.com/vercel/eve/blob/7d346f8119355dc7dd8c36bd3f294d90934c9402/.agents/skills/technical-writing/SKILL.md) | Verify code, help, releases, and adjacent docs | Discover the target's interfaces instead of embedding eve names |
| [Sentry blog-writing-guide](https://github.com/getsentry/skills/blob/d18b7aa8ba878354e5c348310230e652f7690f9c/skills/blog-writing-guide/SKILL.md) | Technical review separate from editorial review | Use local voice; omit mandatory SEO scaffolding when irrelevant |
| [Matt Pocock writing-shape](https://github.com/mattpocock/skills/blob/d81f3a183412e71a5b1e84ca21bc1a35eea03a60/skills/in-progress/writing-shape/SKILL.md) | Ground concepts before using them; preserve supplied raw material | Personal writing needs author input; guide tasks need fewer approval turns |
| [tldraw pr](https://github.com/tldraw/tldraw/blob/db1c86ea7857483c47aa333cf4e92abf455a67cf/skills/pr/SKILL.md) | Update matching PRs and inspect overlapping work | Bundle required guidance and discover target conventions |
| [Next.js create-pr](https://github.com/vercel/next.js/blob/596443802d3f8616b46dca2007a8c5393110f6fb/.agents/skills/create-pr/SKILL.md) | Preserve unrelated changes and follow repository submission policy | Resolve base and head; do not assume canary or a branch prefix |
| [OpenAI yeet](https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/yeet/SKILL.md) | Find templates and preserve existing PR state | Stage owned files; fix access errors without unrelated history changes |
| [n8n create-pr](https://github.com/n8n-io/n8n/blob/f0ca6b24f4d2caf9e731b6c6c1d55341fdc07089/.agents/skills/create-pr/SKILL.md) | Respect title validation and human attestations | Discover each target's rules rather than copy n8n's format |

Source revisions and file hashes are recorded in [competitor provenance](../arch/competitor-sources.json).
Inspect a source's applicable license before copying instructions or cases. Research access does not grant reuse rights.

Skilld loaded Sentry's skill with verified provenance and wrote no installed skill files during this inspection.
Six other loads returned RESOLUTION_TIMEOUT; eve returned INVALID_SOURCE.
Public source snapshots were obtained through agent-gh, without changing to skilld direct delivery.
These are dated research observations, rather than a claim about current service health.

## Measurement sequence

1. Calibrate prose judgments using already sourced examples and blind human choices.
2. Present realistic cases with sources, licenses, protected facts, and intended tasks for approval.
3. Freeze development and comparison sets before changing instructions against their results.
4. Compare each skill with task-matched competitors, a plain request, and suitable controls.
5. Publish scoped results, disagreements, execution limits, and reproduction details.

Newly authored or adapted evaluation cases require owner approval before inclusion or execution.
Collection triage and source inspection are not writing-quality evaluations.
Published examples are permissible research inputs under the owner's source policy; preserve their provenance and licenses.
Public examples may already occur in model training data. Disclose this limitation.
The existing writing pilot is proposed for reuse through [PR #4](https://github.com/harlan-zw/brundlefly/pull/4).
Do not duplicate or silently merge that separate change into this one.

## What each comparison must establish

| Skill | Behavior gate | Human judgment |
| --- | --- | --- |
| write-human | Meaning, qualifiers, names, and supplied facts survive | Useful improvement, naturalness, and retained voice |
| technical-guide | Supported claims; complete prerequisites; correct examples and reader outcomes | Can the intended reader act or understand without missing steps? |
| pr | Correct template, conventions, owned diff, branch relationship, publication, and current head | Can maintainers review the change efficiently and trust the description? |

Score fidelity separately from improvement. An unchanged weak draft must not win merely by preserving every word.
Allow ties, unchanged strong prose, and rejection of both candidates.
Use anonymous outputs, randomized order, multiple independent inputs, and more than one generator family.
Repeated votes on one input do not create independent input samples.
Calibrate model judges against human decisions and retain disagreement records.
Do not count a passing file-load check as evidence of better writing or correct agent behavior.

These distinctions follow [style-transfer evaluation research](https://aclanthology.org/N19-1049/).
Judge calibration addresses biases described by [MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685).
Use [Diátaxis](https://diataxis.fr/) and [Google developer style](https://developers.google.com/style/tone) as primary guidance for suitable cases.

## Proposed quality target

Seek at least 60% tie-adjusted human preference against each applicable comparator.
Define preference as `(wins + half of ties) / comparisons`.
Require the lower 95% confidence bound above 50%, with uncertainty grouped by independent input.
Require no observed material factual drift in the reviewed set and no context hidden by aggregate results.
Choose sample size from the desired precision, rather than promise significance from a small fixed count.
This is a proposed release gate. It is not an achieved result.

## Priorities

| Next step | Impact /100 | Effort S/M/L | Confidence /100 | Why |
| --- | --- | --- | --- | --- |
| Calibrate human judgments on existing sourced outputs | 98 | M | 95 | Pilot exposed judge disagreement and copying bias |
| Review and approve task-specific case packets | 95 | M | 90 | Real content shows multiple reader goals; cases need consent |
| Exercise standalone skills on authorized real work | 90 | M | 85 | Loading proves packaging, not workflow quality |
| Run frozen competitor comparisons across models | 95 | L | 80 | Independent readers and another model family need arranging |
| Publish scoped evidence and installation guidance | 80 | M | 75 | Credibility depends on the preceding gates |

Scores are planning estimates, rather than measured quality. Dependencies determine the order.
Keep optional routing and factory personas behind a later scope decision.
