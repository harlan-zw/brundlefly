# Evaluations

Brundlefly keeps two evaluation suites. Each one measures a different question.

| Suite | Question | Runner |
| --- | --- | --- |
| [triggers](triggers/README.md) | Does a request select the intended Skill? | `claude plugin eval` |
| [writing](writing/README.md) | Does an edit preserve meaning and improve the text, compared with other Skills? | OpenCode pilot and a local human review UI |

Run the trigger suite after you change a Skill description.
Use the writing suite for edit quality, competitor comparisons, and human calibration.
[Skill quality](../docs/ideas/skill-quality.md) owns the plan for writing-quality comparisons.
