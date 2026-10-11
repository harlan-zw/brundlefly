# Naming checks and examples

Use these checks to reason from behavior. The examples illustrate decisions, not universal replacements.

## Test a candidate against its task

Ask whether the name helps this audience predict what the thing contains and what they can do with it.
Compare it with neighboring concepts. A clearer word still fails if it collapses a distinction users need.
Check that a noun names the business object and a function names its actual action.
For example, generating a document does not approve its contents.
Never use a name to imply approval, verification, or legal effect the implementation does not establish.

A short name can be accurate within its context. A longer name can still hide the task.
Prefer familiar business language over a technical container name when both preserve the same meaning.
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
  Expect a concrete evidence gap, without a guessed business name.

These scenarios check judgment. File shape and keyword presence cannot prove a naming recommendation is useful.
