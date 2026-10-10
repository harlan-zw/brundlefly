# Writing comparison pilot

This pilot uses published correction examples and a published editing rubric.
It contains no original writing cases.
Confirm new cases with the repository owner before adding them.

## Sources

- [Anbeeld's correction patterns](https://github.com/Anbeeld/WRITING.md/blob/0c127ca4a4e51debec5adf4816f2bf464d83438b/skills/writing/references/examples.md) supply all ten inputs.
- [Peter Yang's rubric](https://github.com/petergyang/no-ai-slop/blob/000650b156983f5159695b441477f4e63b25dc85/skills/no-ai-slop/eval.md) supplies five editing checks.
- [Humanizer](https://github.com/blader/humanizer/blob/225a6f39ac85f76ee48dbad772ea4abe4ed6c9d8/SKILL.md) and [Stop Slop](https://github.com/hardikpandya/stop-slop/blob/8da1f030185bdfe8471220585162991eaeb970e9/SKILL.md) supply comparison instructions.

These are primary sources for their authors' examples and rules.
They are not a validated scientific benchmark or a human reader panel.
Each source has a pinned commit, hash, URL, and MIT notice in this directory.
Stop Slop includes all three linked reference files.
The generator does not receive Anbeeld's examples or Peter Yang's rubric.
The judge receives the original input and anonymous edits, without reference rewrites.

## Method

Six examples form the development set. Four form the holdout set.
The split was fixed before generation.
The holdout remains public and may occur in model training data.
It measures these patterns only, not long documents, genre coverage, or general superiority.
The over-editing example is a published non-change control, not a matched human corpus.

Every editor receives the same request and source text in a fresh OpenCode session.
The request asks for natural prose, preserved meaning, and final text as JSON.
The baseline receives that request without skill instructions.
This overrides each skill's reporting format. It does not assess reporting quality.

The generator defaults to GLM 5.3 Flash. The judge defaults to GLM 5.2.
Both models share a provider and model family, which may bias judgments.
One generation and one judgment per case cannot estimate output variance.
Judgments use five exact questions from the rubric.
Preservation is a required pass, even when other checks pass.
Each distinct edit receives an independent anonymous judgment.
Identical edits share one judgment, so they always tie.
Candidate order varies deterministically. The judge never receives editor names or competing outputs.
There are no forced winners or exact matches against reference rewrites.

OpenCode runs with tools denied, external plugins disabled, and an empty config directory.
Only provider settings load from the explicitly supplied JSON configuration.
Claude instructions and external skills are disabled.
The working directory sits outside the repository, so project instructions do not load.
Sharing is disabled. Raw logs stay in the chosen scratch directory.
Normalized edits, judgments, hashes, model names, and runtime versions stay in results.
Prompts enter through stdin. Each exported session must contain the exact supplied prompt and one user message.
Successful requests are cached by model and prompt hash.
Repeating a command resumes those requests. Use a fresh scratch directory for an independent repeat.

## Run

Requires Node 24+ and an authenticated OpenCode installation.
The runner has no npm dependencies. It does not belong to the installable skill.

```sh
node --test evals/core.test.ts

EVAL_SCRATCH="$HOME/scratch/brundlefly-evals" \
EVAL_PROVIDER_CONFIG="$HOME/.config/opencode/opencode.json" \
node evals/run.ts development initial
```

If OpenCode uses standard credentials, omit EVAL_PROVIDER_CONFIG.
If needed, set OPENCODE_BIN, EVAL_GENERATOR, or EVAL_JUDGE.
EVAL_PROVIDER_CONFIG accepts a JSON file containing a provider object, not JSONC.
Never commit credential files or raw configuration.

After reviewing development outputs, freeze the revised skill.
Then run development revised, holdout initial, and holdout revised.
The revised run compares its fresh edit with the stored initial edits.
Rejudging all candidates allows direct comparison within that judgment.
A revised judgment can disagree with the first judgment; report that uncertainty.

## Compare current instructions

Use `current` for fresh edits from the current Skill, both pinned competitors, and the same plain request.
An unchanged-text control receives no generator call. It exposes checks that reward copying without useful editing.
This control does not establish useful improvement. Keep improvement judgments separate from preservation checks.

```sh
EVAL_SCRATCH="$HOME/scratch/brundlefly-current-evals" \
EVAL_PROVIDER_CONFIG="$HOME/.config/opencode/opencode.json" \
node evals/run.ts development current
```

Current results stay in `EVAL_SCRATCH/development-current.json`, outside the repository.
Use a fresh scratch directory for each independent repeat.
Current mode never imports old candidate outputs or overwrites historical results.
The `revised` mode now uses the frozen `write-human-v1` snapshot rather than today's Skill.

Current mode preloads Markdown files reached through inline relative links, including nested Block Skills.
It records each file hash and the complete instruction hash.
Missing files and paths outside the Skill stop the run. Filesystem links cannot escape the Skill directory.
External URLs, anchors, and non-Markdown resources do not load.
Reference-style links and bare paths are outside this loader's supported format.
Every currently linked Markdown reference is supplied, including optional research notes.
The model must select relevant guidance from that supplied bundle.
This differs from a tool-enabled agent's progressive loading. It does not test reference selection through tools.

The competitors remain at the revisions in `sources.json`. Registry popularity does not rank their output quality.
These ten public examples remain development evidence. They cannot establish broad superiority or an untouched holdout.
Report unchanged outputs and the control's scores alongside preservation results.
If the control passes, inspect whether that input needs editing before treating the pass as an improvement.

## Calibrate preservation and useful improvement

The historical five checks mix preservation and writing quality. Keep those results separate from this protocol.
An unchanged weak draft can pass them all. That does not establish useful improvement.

Use approved inputs and frozen outputs. New authored or adapted cases still require owner approval.
Keep the inputs, model traces, answers, and human choices in scratch.
Each input has `id`, `source`, `task`, `provenance`, and `candidates` containing `variant` and `text`.
Provenance records the source and approval evidence. The command cannot verify approval or licensing.

```sh
node evals/calibrate.ts prepare "$INPUTS" "$SCRATCH/requests.json"
node evals/calibrate.ts score "$INPUTS" "$SCRATCH/scores.json" "$RESPONSES" "$HUMANS"
```

The prepare command supplies anonymous prompts without running a model.
Run each prompt in a fresh, isolated session. Record the judge model and its version beside the responses.
Responses contain `requestId` and `response`, the raw JSON assessment string.
Every distinct changed output needs one response. Identical outputs share one judgment.
The seed controls source order. Set `EVAL_CALIBRATION_SEED` for a second order and retain both reports.
Order repeats are stability checks, not extra independent inputs.

Assess two dimensions separately:

- Fidelity: `preserved`, `changed`, or `uncertain`.
- Benefit: `improved`, `equivalent`, `worse`, or `uncertain`.

Each assessment needs specific `evidence`. A useful edit requires preserved fidelity and improved benefit.
Exact copying receives preserved fidelity and equivalent benefit, with no model call.
This measures transformation, not whether the original was good or factually true.
Unchanged strong prose remains valid. Editing more or removing supposed AI markers earns no automatic advantage.
There is no combined quality score or forced winner.

Human assessments contain `requestId`, `assessor`, `fidelity`, `benefit`, and `evidence`.
Show people the anonymous prompt before model scores or editor names. Record their choices without modification.
Use one human assessment per request in a report. Save other assessors in separate reports.
Omit the human file when none exists. Zero assessed choices means human calibration is incomplete.
An agent's opinion must never be recorded as a human assessment.
Agreement counts distinct changed outputs. Multiple outputs from one source still share one independent input.
Keep model disagreement and uncertainty visible. Avoid broad quality claims from this calibration set.
