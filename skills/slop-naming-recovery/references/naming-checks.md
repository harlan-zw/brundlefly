# Naming checks and examples

Use these checks to reason from behavior. The examples illustrate decisions, not universal replacements.

## Test a candidate against its task

Ask whether the name helps this audience predict what the thing contains and what they can do with it.
Compare it with neighboring concepts. A clearer word still fails if it collapses a distinction users need.
Check that a noun names the object users work with and a function names its actual action.
For example, generating a document does not approve its contents.
Never use a name to imply approval, verification, or legal effect the implementation does not establish.

A short name can be accurate within its context. A longer name can still hide the task.
Prefer familiar domain language over a technical container name when both preserve the same meaning.
Keep necessary domain language and explain it when the intended audience needs help.

## Worked decisions

| Current name | Inspected behavior | Possible recommendation | Required distinction |
| --- | --- | --- | --- |
| artifact | A payroll screen downloads an employee's earnings statement | Payslip; `generatePayslip` | A payroll document, separate from other downloads |
| artifact | A build service stores compiled files for release engineers | Keep build artifact | The audience works directly with build outputs |
| attestation | A venue workflow records a named person's confirmation of completed safety checks | Safety check confirmation; `confirmSafetyChecks` | Records a declaration, not an independent inspection |
| attestation | A security API accepts a signed statement defined by an external protocol | Keep the protocol field; explain its purpose in UI | Signature and protocol semantics remain explicit |
| entity | A booking app tracks a guest's reservation | Reservation; `cancelReservation` | Separate the reservation from the guest and payment |
| pipeline | A seller prepares, reviews, and publishes a product listing | Listing publication process | Keep distinct steps if they affect recovery or permissions |

These names depend on the stated behavior and audience.
If an artifact includes both a payslip and tax documents, do not rename the entire container Payslip.
If an attestation proves a different fact, Safety check confirmation may be wrong.
If publishing only creates a draft, `publishListing` would overstate the action.

## Evidence and uncertainty

For each finding, keep the smallest useful evidence trail:

1. Current name and definition, including any glossary or decision record.
2. Code that establishes its meaning, plus the public surface when one exists.
3. The audience, task, proposed name, and distinction it preserves.
4. A before-and-after example and the affected consumers or external contracts.

Use file lines when available. Do not turn a plausible interpretation into an established fact.
Without customer evidence, describe likely reading difficulty as an inference.
For an overloaded term, show both meanings and where the same reader encounters them.
Different meanings in separate contexts do not establish confusion by themselves.
Distinguish confidence in the code's meaning from confidence that a rename helps its audience.
If only a name is supplied, request its definition or usage before recommending a replacement.
If no glossary exists, audit observed names without inventing a canonical document.

## Review scenarios

Use these scenarios for a manual check of the workflow:

- **Consistent but vague:** artifact appears in the glossary, code, and payroll UI.
  Expect a supported naming proposal despite consistent usage. Preserve the current canonical term until approval.
- **Implicit addition:** `createEntity` introduces a reservation concept without a glossary entry.
  Expect a finding based on the booking task, with the implicit introduction identified.
- **Technical audience:** build artifact appears in a release-engineering tool.
  Expect no forced rename based on the word alone.
- **Shared container:** artifact stores payslips and tax documents.
  Expect separate concepts or a supported umbrella name, never an inaccurate Payslip rename for all outputs.
- **Fixed protocol:** attestation is a provider field surfaced directly in a safety-check screen.
  Expect a UI wording proposal and preservation of the external field unless its contract can change.
- **Missing meaning:** only `processArtifact` is supplied.
  Expect a concrete evidence gap, without a guessed domain name.
- **Frozen contracts:** a user authorizes fixes but freezes endpoints and database names.
  Expect clearer labels and explanations, unchanged contracts, and PRs for independently useful fixes.
  Defer any rename requiring a changed wire field or stored name. Do not add aliases or migrations.
- **Distributed definitions:** CONTEXT.md defines CSS class token, but GLOSSARY.md is absent.
  Expect the documented definition to be recognized. Do not invent an existing glossary or force a rename.
- **Separate technical contexts:** an SDK profiling callback and a CLI output profile share a word.
  Expect a check for audience overlap and a keep-or-explain option before proposing an API rename.
- **Wording-only repair:** a CLI says cross-realm import for a relative runtime import between app and server files.
  Expect precise app/server wording without silently renaming its check ID or suppression syntax.

These scenarios check judgment. File shape and keyword presence cannot prove a naming recommendation is useful.
