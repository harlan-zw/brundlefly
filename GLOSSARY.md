# Glossary

This file owns Brundlefly's product names and brand terms.
[COPY.md](COPY.md) owns sentences and voice. [VISION.md](VISION.md) owns the claims those sentences may make.
The terms below preserve the owner's chosen tension: human connection inside something inhuman and grotesque.

## Map

| Term | Location | Relationship | Public name |
| --- | --- | --- | --- |
| Brundlefly | Repository | Contains skills and brand assets | Brundlefly |
| im-not-a-fly | skills/im-not-a-fly | First skill candidate | im-not-a-fly |
| technical-guide | skills/technical-guide | Creates and refreshes verified technical guides | technical-guide |
| pull-request-summary | skills/pull-request-summary | Checks pull request description text | pull-request-summary |
| im-a-fly | skills/im-a-fly | Compresses text for agents while preserving substantial meaning | im-a-fly |
| readme | skills/readme | Writes repository READMEs with researched positioning and working setup | readme |
| glossary | skills/glossary | Creates and audits canonical names and meanings | glossary |
| copywriting | skills/copywriting | Creates and audits voice and canonical wording | copywriting |
| clarity | skills/clarity | Block Skill used by human-facing prose, guide, README, copy, naming, and PR workflows | clarity |
| claim-fidelity | skills/claim-fidelity | Block Skill used by prose, guide, README, compression, and PR workflows | claim-fidelity |
| verify-examples | skills/verify-examples | Block Skill used by technical-guide and readme | verify-examples |
| Workflow Skill | skills/ | Owns a complete text task and loads applicable bundled blocks | Workflow Skill |
| Block Skill | skills/ | Owns one focused pass and also works independently | Block Skill |
| fly | Public story | Names the agent in the mascot's metaphor | fly |
| Skill | skills/ | Self-contained Agent Skills directory | Skill |
| human connection | Public story | Gives the writing its purpose | human connection |
| empathy | Editorial choices | Helps the author consider the reader | empathy |
| inhuman | Public story | Names the absence of lived human experience in an agent | inhuman |
| slop | Public story | Names writing that loses purpose in generated filler | slop |
| mutation | Brand imagery | Connects changed writing with the changing mascot | mutation |
| grotesque | Visual presentation | Makes the loss of humanity visible | grotesque |

## Terms

Brundlefly names the collection and its mascot.
Use BRUNDLEFLY only for the uppercase wordmark.

im-not-a-fly owns editing prose that people read.
It replaces write-human, which replaced the imported humanize-writing name.

technical-guide owns research, writing, and verification for a reader's technical task.
Use this name for both creation and refresh. Do not name a second skill content-refresh for the same workflow.

pull-request-summary owns pull request description text and its convention checks.
Delivery Skills call it and retain branch, publication, CI, and review policy.
It replaces pr in this collection. Pull request remains GitHub's name for the artifact.

im-a-fly owns meaning-preserving text compression for agents, including Markdown files.
It replaces agentify-text. Use the owner's requested name for this skill.

im-not-a-fly and im-a-fly form a pair: text people read, and text agents act on.
Rename both together or neither.

readme owns README creation and refresh, including setup and documentation routing.
It works alone and can use im-not-a-fly as an optional prose review.
Use readme for this skill, rather than readme-writer or readme-guide.

glossary owns creating and auditing GLOSSARY.md. It does not create other root documents automatically.
Use glossary rather than terminology-manager or naming-guide for this Skill.

copywriting owns creating and auditing COPY.md and writing against its wording decisions.
Use copywriting rather than brand-voice or copy-guide for this Skill.
It works without glossary or im-not-a-fly installed. Supplied document rules remain authoritative.

### Workflow Skill and Block Skill

A Workflow Skill owns a complete artifact or transformation, such as a guide or prose edit.
A Block Skill owns one focused pass that a workflow can compose with other passes.
Both use the same Agent Skills format and live directly under skills.
Use Block Skill rather than helper Skill, subskill, or primitive for these installable passes.
Use Workflow Skill rather than parent Skill for the complete task.
Bundled blocks are local reference copies. They do not require sibling Skills to be installed.

### clarity

clarity owns a focused review of wording, reading order, and accessible structure.
It preserves claims and deliberate voice. It does not verify factual truth or run the full im-not-a-fly workflow.
Use clarity rather than clarity-review or readability for this Block Skill.

### claim-fidelity

claim-fidelity compares transformed text with its source and the authorized scope of change.
It checks conditions, attribution, uncertainty, and required actions. It does not establish factual truth.
Use claim-fidelity rather than meaning-check or fact-check for this Block Skill.

### verify-examples

verify-examples checks runnable documentation examples from their stated starting conditions.
It separates executed results from source inspection and reports unavailable checks.
Use verify-examples rather than example-check or test-guide for this Block Skill.

### human connection

The attempt by one person to be understood by another through writing.
Use it when explaining why meaning and voice matter.
Do not substitute engagement, conversion, or an authenticity score for this aim.
The skills can support that attempt. They cannot guarantee a reader's response.

### empathy

Considering what the reader knows, needs, or could misunderstand.
Express it through clear explanations and care for the reader's attention.
Do not use sentimentality, flattery, or simulated intimacy as substitutes.
Do not claim an agent feels empathy.

### slop

Generated writing whose filler, stock phrasing, or unsupported additions obscure what someone meant.
Use it for a specific failure in the writing, never as a label for its author or reader.
Do not use it as a synonym for all agent output or unfamiliar writing styles.
Retain factual names for evaluations and technical material.

### inhuman

An agent does not bring the author's lived experience or relationship with the reader to the writing.
Use the word for that boundary in public copy.
Do not use it to dehumanize a person or claim that every generated sentence is bad.
Avoid soulless as a technical explanation. Name the actual loss of meaning or voice.

### fly

The agent, in the mascot's metaphor. Brundlefly is part human and part fly.
Writing through an agent is part author and part agent.
Use it in the public story and the paired Skill names.
Do not use it as a label for a writer or a reader.

### mutation

A change in form, expressed through the mascot and the transformation of writing.
Use it in the public story and brand imagery.
Do not rename a Skill, rewrite, installation, or review as a mutation.
Technical instructions keep their established terms.

### grotesque

The body's visible distortion: warped proportions, uneven limbs, flesh changing into chitin.
Use it for the visual presentation and deliberate horror in public copy.
Do not substitute gore, violence, or disgust toward people for this character.
Keep the purpose warm even when the presentation is harsh.

## Banned

Do not use Fleshware, Brundleware, or Spiralware as names for this collection.
Those names belong to archived concepts.

Do not call agents human, conscious, or empathetic as a claim about their inner experience.
Do not use human connection to imply a measured outcome without evidence.

## Open questions

Record unresolved naming choices here before changing canonical terms.
