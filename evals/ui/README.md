# Local review UI

Review five existing writing pairs or generate a focused guide comparison through OpenCode.
Requires Node 24+, pnpm, and an authenticated OpenCode installation.

```sh
pnpm --dir evals install --frozen-lockfile
pnpm --dir evals review
```

Open http://127.0.0.1:4318.
If custom providers are needed, set EVAL_PROVIDER_CONFIG to a JSON provider configuration file.
It follows the [pilot's isolated execution rules](../README.md).
Set EVAL_GENERATOR to choose the generator model. Both guide versions use that same model.
Set PORT for another loopback port. Set EVAL_SCRATCH to a directory outside the repository.
The default output directory is ~/scratch/brundlefly-review-ui.
This directory contains prompts, generated drafts, private attribution, and the browser bundle.

## Writing pairs

Pairs reuse five published pilot inputs with historical write-human-v1 and Humanizer outputs.
They include compressed phrasing, hooks, uncertainty, punctuation, and generic personal claims.
They were selected for editorial discussion, rather than a representative sample.
They do not evaluate the current skill revision.
Candidate order is randomized once and saved locally across server restarts.
Choose A, B, original, tie, or neither. Save a reason before revealing the source names.
Changing a vote after reveal keeps its revealed attribution in the export.
Browser votes include the exact prompt and outputs, so they remain interpretable after a restart.

## Guide demo

The owner approved the cache revalidation prompt in a conversation on 3 October 2026.
It asks for a Node server, coherent explanation, a diagram, and browser screenshot instructions.
Both candidates receive the same verified source context.
One receives the complete technical-guide skill and bundled references. The other receives no skill.
Tools are denied. Neither generator can verify its examples or capture screenshots.
The source packet uses [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2)
and [HTTP caching](https://httpwg.org/specs/rfc9111.html).
It covers only the cache topic. Other topics require their own inspected evidence.

Every new request requires explicit prompt approval in the UI.
Editing the prompt clears approval. Generation sends two requests to the configured model provider.
The server accepts one active comparison at a time and reports failures without inventing output.
Generation and judgment are separate. No model judge or quality score is applied here.
Completed responses are cached by model and exact prompt, including instructions and shared evidence.
Repeating a request resumes those responses. Use a fresh EVAL_SCRATCH for an independent repeat.
Use the guide completeness checks separately from your preference vote.
These proposed checks guide discussion; they are not a validated benchmark.

Generated code never executes automatically. Verify it in isolation before treating the guide as accurate.
Markdown is sanitized. External images become labelled placeholders.
Mermaid sequence and flow diagrams render locally. Invalid diagrams keep their source visible.
Screenshots may use the fixed local evidence path /evidence/cache-requests.png.
To supply it, place an actual capture named cache-requests.png in EVAL_SCRATCH.
Label the capture's actual interface and environment. Never substitute it for an unavailable DevTools capture.

## Reviews and privacy

Votes stay in browser local storage. Export reviews downloads a JSON file with exact outputs and decisions.
The export records whether a reviewer revealed source names. It does not automatically publish votes.
Private mappings are available through a reveal endpoint. This is conversational blinding, not adversarial anonymity.
The server binds only to 127.0.0.1 and checks Host and generation Origin headers.
Do not expose it through a public proxy or deploy it as an authenticated service.
Public hosting, multi-user review, and aggregate quality claims need a separate design.

```sh
pnpm --dir evals test
pnpm --dir evals typecheck
```
