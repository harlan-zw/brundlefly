# Contextual writing comparison on 11 October 2026

The revised instructions tied the previous instructions on five approved passages.
The model rated both sets as preserving meaning and improving readability against their sources.
The owner preferred the previous version on one engineering narrative after reviewing its A/B differences in chat.
This run does not establish a general winner or superiority over competing Skills.

## Frozen revisions

| Variant | Brundlefly revision | Meaning preserved | Improved against source |
| --- | --- | --- | --- |
| `before-51` | `adab8edb01715705946beab3661d8299cf683026` | 5/5 | 5/5 |
| `after-51` | `8622ef593da629e2af50909292317f2229874efb` | 5/5 | 5/5 |
| `copy-only` | Unedited source | 5/5 | 0/5 |

These are model ratings against each source. They do not express a preference between revisions.
The unedited control receives preserved meaning and equivalent benefit by definition, without a model call.
Later commit `4d33e4d` changed copy and website material, but none of the tested Skill files.

## Method

The owner approved five historical passages before the 4 October evaluation and requested publication of this session evidence.
The contexts are policy, technical explanation, troubleshooting, engineering narrative, and personal update.
The complete passages, original tasks, and both outputs are in [inputs.json](inputs.json).
Each input has one generation per revision, using `zai-coding-plan/glm-5.3-flash`.
The judge is `zai-coding-plan/glm-5.2`. Both share a provider and model family.

The generator received the main `im-not-a-fly` Skill and six linked Markdown references.
The bundle came directly from each frozen Git revision.
The source, task, generation format, and `fidelity-benefit-v1` scoring protocol stayed fixed.
Tools were denied. Sessions used isolated configuration and no external Skills.
Reference preloading measures supplied instruction use, rather than discovery or progressive loading.

Five previous model judgments were reused only when their request identities matched exactly.
Five new judgments assessed the revised outputs.
[responses.json](responses.json) retains their complete normalized assessment strings.
One new response needed JSON fence removal. [normalization.json](normalization.json) records its raw and normalized hashes.
Raw transport traces remain private scratch evidence and are outside this archive.

## Human preference

The engineering narrative used anonymous labels during review.
The owner read its heading comparison and a chat table showing every A/B difference.
The exact response was: “yes b is better”.

B maps to `before-51`; A maps to `after-51`.
[human-pair-preferences.json](human-pair-preferences.json) records that preference and both candidate hashes.
No separate fidelity rating, source-relative benefit rating, or reason accompanied this preference.
It is not converted into a `HumanAssessment` or counted as model agreement.
The earlier short-sentence choice remains neutral and does not apply to these passages.

## Literal checks and limits

Both sets retained every checked URL, numeric token, required disclosure, and fenced code block.
Literal preservation does not establish semantic fidelity or technical correctness.
Both technical explanation edits changed table markup around an invisible variation selector.
Numeric values remained intact. Rendering was not checked.
The judge's claim that this has no rendering effect exceeds the verified evidence.

One generation per revision cannot separate instruction effects from generation variance.
Five passages from one author cannot support a broad quality claim.
These historical technical passages were assessed for edit fidelity, rather than current technical advice.
No current competitor comparison was performed in this run.

## Recompute scores

Requires Node 24 or newer. Run from the repository root.
Create the scratch directory before writing calibration output.

```sh
mkdir -p "$HOME/scratch/brundlefly-contextual-replay"
node evals/calibrate.ts score \
  evals/results/contextual-2026-10-11/inputs.json \
  "$HOME/scratch/brundlefly-contextual-replay/scores.json" \
  evals/results/contextual-2026-10-11/responses.json
```

This recomputes scores from frozen responses. It does not rerun generation or model judgments.
Use [protocol.json](protocol.json) for models, revisions, runtime versions, and source and instruction hashes.
[scores.json](scores.json) retains the original model totals and limitations.
[blind-mapping.json](blind-mapping.json) resolves the anonymous labels.
[previous-request-audit.json](previous-request-audit.json) records the matched earlier generation prompt hashes.
[literal-screen.json](literal-screen.json) contains the literal preservation signals.

## Next evidence

Review additional full passages and record reasons before changing instructions against this preference.
Keep fidelity and improvement separate. Allow ties and uncertainty when context is missing.
