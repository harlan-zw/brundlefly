# Graphite research note

Source: [AI Tells: Opus 5.5 Update](https://graphite.io/five-percent/research/ai-tells-opus-5-5-update), Graphite, October 1, 2026.
Authors: Gregory Druck, Jose Luis Paredes, and Ethan Smith.
The user supplied the article. The primary page was checked on October 4, 2026.

## Evidence and limits

Graphite compares articles across 9,974 aligned topics with human articles written before ChatGPT.
Its 1,000-topic mannered-prose ratings use Opus 5, without a human panel.
Unigram Jensen-Shannon distance measures vocabulary similarity, not quality or authorship.
Opus 5.5 retains 2,548 tells despite nearly eliminating em dashes.
Tells occur at least twice the normalized human rate after frequency filters.
Frames allow gaps of up to three words.
These observational article-corpus results depend on model, version, and genre. They are not universal editing rules.

## Patterns to review

| Pattern | Examples | Editing question |
| --- | --- | --- |
| Evaluative wording | dependable, thoughtful, steady, meaningful | Does the rating convey supported information? |
| Stock transitions | what comes next, adds another layer, in practice | Does the connection help the reader follow the argument? |
| Contrast and importance | rather than simply, this matters | Does the phrase preserve a useful distinction or explain a consequence? |
| Helpfulness | can help you, makes it easier, helps you avoid | Is the benefit specific and supported? |
| Superlatives | the most popular, the most powerful | Is the comparison supported within its stated scope? |
| Qualification | may provide, does not establish, not necessarily | Would removing it change uncertainty or the evidence limit? |

The first three rows compare Opus 5.5 with humans.
Helpfulness compares Opus 5.5 with Opus 5; superlatives compare it with Astra.
Qualification compares Astra with Opus 5.5. Model-to-model ratios are not human-relative ratios.

## Apply with care

Read the whole passage before editing a phrase.
Preserve ordinary words, contractions, technical terms, and deliberate voice.
If the wording serves the reader, keep it.
If it repeats a point, cut the repetition.
If it hides the point, state only what the source supports.
Then compare scope, uncertainty, attribution, and meaning with the original.
Never add a benefit or claim to make the sentence sound concrete.
Never use this research to promise human authorship or detector evasion.
