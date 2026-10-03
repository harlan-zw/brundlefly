# Evidence and verification

## Match evidence to the claim

| Claim | Inspect | Limit |
| --- | --- | --- |
| Public API or CLI support | Release documentation, public exports, schema, or versioned help | Checkout behavior may precede a release |
| Implementation behavior | Matching source, callers, and relevant tests | Mocked tests do not prove a live integration |
| Platform guarantee or limit | Current official documentation for that interface | UI availability does not establish API availability |
| Performance or reliability | Actual measurement and method | Keep workload, units, denominator, and qualifications |
| Author experience | Supplied notes or an attributable account | Do not convert another person's account into first person |
| Reader failure | Supplied reproduction, logs, or support evidence | A proposed workaround still needs verification |

Read full supporting pages. Search snippets and existing prose are discovery aids.
Cite the specific supporting page beside an external claim.
Prefer authoritative links beside the claims they support, without a separate "Sources" section by default.
Use a source list only when the destination requires it or it helps the reader's task.
Keep detailed provenance and verification records in private working evidence.
For code-backed claims, record a file and revision in the working ledger.
Separate documented behavior, directly observed behavior, and assumptions.
Recheck changeable claims before delivery.

## Run the example as a reader

1. Match the documented runtime, package version, working directory, and prerequisites.
2. Use a clean scratch project or the target's documented fixture where available.
3. Run setup and examples in order, without relying on previous session state.
4. Observe exit status and actual output. Compare the result with the guide's promised outcome.
5. Check cleanup and the documented recovery for any observed failure.

Use read-only inspection until state-changing work is authorized.
Creating a guide does not authorize production writes, spending, or sending messages.
Mark illustrative output as illustrative. Never present invented terminal output as a captured result.

If a command fails, distinguish a wrong instruction from missing access, tooling, or environment.
Repair incorrect prose and repeat the affected path.
If the environment prevents execution, inspect the best available source and name what remains untested.
Do not replace execution evidence with a successful lint or build.

## Verify, repair, then repeat

Before execution, map each material claim and selected primitive to a check and supporting evidence.
Keep the original draft and the checked revision separately in private working files.

| Primitive or claim | Check |
| --- | --- |
| Runnable example | Run documented setup, commands, and inputs; compare actual outputs with promised results |
| Protocol behavior | Check applicable status, headers, body, and conditions against the governing specification |
| Diagram | Render with the target engine; compare arrows, labels, and branches with verified behavior |
| Screenshot | Inspect the real capture, interface, version, caption, and claimed observation |
| Supplied fixture | State its origin and limits; do not imply it captures the newly written example |
| Conceptual explanation | Trace its mechanism and qualifications to the supporting source |

Derive conditions from the requested scope and authoritative sources.
Do not invent a large edge-case suite or expand the task without authorization.
A successful common path does not establish every protocol claim.
A diagram's source text does not establish that it renders.
Capture instructions do not establish that a screenshot exists.

For each failure, record the expected behavior, actual observation, evidence, and affected passage or asset.
Repair the smallest underlying mismatch. Update dependent prose, code, captions, and diagrams together.
Repeat the failed check and any checks affected by the repair.
If an editorial change alters a verified example or claim, repeat its affected checks too.
Do not claim success from an earlier revision's results.

When a tool or permission prevents verification, name that limit in the handoff.
Do not fabricate a result, substitute a different interface, or remove a failure from the evidence.
A blocked core reader path remains a draft until it can be supported.

## Review the final revision

Compare the final prose with protected facts, qualifiers, identifiers, versions, and code.
Check links and fragments, plus incoming links affected by moved content.
Preserve stable URLs. If a move is requested, follow the target's redirect conventions.
Check the rendered result for code formatting, heading order, figures, and usable links when a renderer exists.
For images, inspect the actual asset, caption, alt text, and private information before inclusion.

Keep working notes outside content discovery, navigation, search, sitemap, and public downloads.
When scope includes deployment, verify the deployed revision and live reader path through the authorized delivery mechanism.
A local render does not prove production publication.

## Handoff evidence

Report only meaningful checks and their limits:

- Which version or revision supports the guide.
- Which reader path ran, with its observed outcome.
- Which examples received source inspection only, and why execution was unavailable.
- Which unresolved claims or reader steps require a decision.

Keep detailed transcripts in private scratch evidence or the project's existing review records.
