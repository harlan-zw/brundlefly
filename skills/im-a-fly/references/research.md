# Research and design

Research reviewed on 2026-10-04. These sources motivate the design; they do not validate this skill.

## Decision

Use conservative semantic rewriting with a bidirectional meaning audit for editable Markdown.
Keep exact spans and structural relationships intact. Measure tokens with the intended reader's tokenizer.
Accept smaller savings when further cuts change a fact, rule, or decision.

This recommendation is an engineering inference from the research and the skill's requirements.
No cited study establishes a universally best compressor for arbitrary Markdown instructions.

## Evidence

### Token deletion

[LLMLingua, EMNLP 2023](https://aclanthology.org/2023.emnlp-main.825/) combines budget allocation, iterative token removal, and model alignment.
It demonstrates useful compression on selected benchmarks. Its reported ratios are not promises for instruction files.

[LLMLingua-2, ACL Findings 2024](https://aclanthology.org/2024.findings-acl.57/) learns token retention using bidirectional context.
The authors identify limitations of information entropy as a proxy for information importance.
The method improves benchmark performance and efficiency relative to earlier approaches.
Token retention still requires task-specific evaluation when exact constraints matter.

Implication: word rarity or perplexity alone is insufficient justification for deleting a rule or qualifier.
Do not require a trained compressor for this portable Markdown skill.

### Semantic rewriting

[Telegraph English, May 2026 preprint](https://arxiv.org/abs/2605.04426) rewrites text into atomic facts and symbolic relationships.
The authors report strong fact retention on question-answering benchmarks across several models.
This supports investigating semantic rewriting rather than relying only on token deletion.
Its reported results do not establish exact preservation of Markdown behavior or agent permissions.

Implication: adopt compact fact and rule lines, while retaining plain connective words.
A symbol grammar adds decoding overhead and another dependency on the reader's interpretation.
The conservative default omits that grammar. This choice is an inference, not a proven superiority claim.

### Preservation and behavior

[Understanding and Improving Information Preservation, EMNLP Findings 2025](https://aclanthology.org/2025.findings-emnlp.949/) evaluates compression beyond its ratio.
Its framework separates downstream performance, grounding, and information preservation.
Implication: a smaller document or a correct answer to one question cannot prove complete preservation.

[Separating Constraint Compliance from Semantic Accuracy, December 2025 preprint](https://arxiv.org/abs/2512.17920) evaluates those dimensions separately.
It reports different effects of compression on constraint compliance and semantic accuracy in its experimental setup.
Treat its conclusions as provisional. Do not generalize its numerical results to this skill.
Implication: verify allowed actions, exceptions, and obligations separately from factual answers.

### Context organization

[Lost in the Middle, TACL 2024](https://aclanthology.org/2024.tacl-1.9/) reports positional sensitivity in long-context retrieval tasks.
Its results concern the evaluated models and tasks, not every current agent.
Implication: keep related conditions and actions together. Preserve usable headings and procedure order.
It does not justify moving linked headings or deleting facts in the middle of a document.

### Token measurement and packaging

[tiktoken](https://github.com/openai/tiktoken) uses model-specific byte-pair encodings.
Character count is not a substitute for token count. A rewrite's savings depend on the encoding.
Use the target tokenizer when available; label another encoding as a proxy.

The [Agent Skills specification](https://agentskills.io/specification) supports progressive disclosure through bundled references.
Keep the core instructions short and load detailed checks or research only when needed.

## Alternatives

| Method | Fit for editable Markdown | Main limitation |
| --- | --- | --- |
| Conservative semantic rewriting | Default for portable files and instructions | Requires careful meaning review; modest savings on dense input |
| Learned token deletion | Optional for a measured inference pipeline | Model dependencies; deletion can damage relationships and exact spans |
| Symbolic rewriting | Experimental when the reader supports the grammar | Grammar overhead; Markdown and instruction behavior need separate evaluation |
| Query-based extraction | Suitable when the user permits a focused summary | Drops content outside the query; cannot satisfy full preservation |
| Soft prompts or cache compression | Suitable within compatible model infrastructure | Does not produce a portable Markdown replacement |

## Evaluation limits

The worked examples are review fixtures, not independent model trials.
Do not reuse a paper's compression ratio as this skill's performance claim.
Before making comparative claims, test unseen documents with the intended reader models.
Include dense files, long procedures, exceptions, multilingual text, and protected Markdown constructs.
Score factual answers, instruction decisions, unsupported additions, structural integrity, and measured token reduction separately.
Any material omission or changed obligation fails acceptance, regardless of savings.
