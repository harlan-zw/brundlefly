# Skill trigger evals

These cases check whether an agent selects the right Brundlefly Skill for a request.
They measure selection, not writing quality.
[Skill quality](../docs/ideas/skill-quality.md) owns writing-quality comparisons.

## Cases

Each Skill has three requests that should select it.
Three negative cases should select no Brundlefly Skill.
The im-not-a-fly and im-a-fly cases also check that the other Skill of the pair stays unused.

Each case directory holds a `prompt.md` and `tool_used` graders.
No grader calls a judge model.

## Run

Runs call the model on your account and cost money.
From the repository root, run one pass over every case:

```sh
claude plugin eval . --ablation none --runs 1 --max-cost-usd 5 --no-publish
```

- `--ablation none` skips the no-plugin baseline, which cannot score Skill selection.
- `--runs 1` gives a first pass. Omit it for the default three runs per case.
- `--max-cost-usd 5` stops new runs at 5 USD of list-price spend.
- `--tag im-a-fly` or `--case 'im-*'` narrows the run.

Reports go to `skill-evals/results/`, which Git ignores.

## Limits

Each run starts in an empty directory, so each prompt carries its own input text.
The graders accept any `plugin:` prefix, so a personally installed copy of a Skill also passes.
Remove personal copies before a run.
A pass shows that the agent loaded the Skill. It does not show that the Skill did the task well.
