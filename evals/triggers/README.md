# Skill trigger evals

These cases check whether an agent selects the right Brundlefly Skill for a request.
They measure selection, not writing quality.
[Skill quality](../../docs/ideas/skill-quality.md) owns writing-quality comparisons, and the [writing pilot](../writing/README.md) runs them.

## Cases

Each Skill has three development requests and one held-out request that should select it.
Five negative requests should select no Brundlefly Skill.
Tune descriptions against the `dev` tag. Report the `holdout` tag separately, so a change that only fits the development prompts shows.
The im-part-human and im-not-a-human cases also check that the other Skill of the pair stays unused.

Each case directory holds a `prompt.md` and `tool_used` graders.
No grader calls a judge model.

## Run

Runs call the model on your account and cost money.
From the repository root, run one pass over every case:

```sh
claude plugin eval . --ablation none --model haiku --runs 1 --max-cost-usd 5 --no-publish
```

- `--model haiku` runs the suite on Haiku, the model the descriptions were tuned against.
- `--ablation none` skips the no-plugin baseline, which cannot score Skill selection.
- `--runs 1` gives a first pass. Omit it for the default three runs per case.
- `--max-cost-usd 5` stops new runs at 5 USD of list-price spend.
- `--tag holdout`, `--tag im-not-a-human`, or `--case 'im-*'` narrows the run.

Reports go to `evals/triggers/results/`, which Git ignores.

## Limits

Each run starts in an empty directory, so each prompt carries its own input text.
Eval sessions load this plugin and built-in Skills only, so personally installed copies do not affect results.
A pass shows that the agent loaded the Skill. It does not show that the Skill did the task well.
