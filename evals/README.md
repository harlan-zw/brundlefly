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
