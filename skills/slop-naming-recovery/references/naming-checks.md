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
- **Broad audit, early wins:** a repository has confusing labels in its first inspected feature.
  Expect the remaining main journeys to be inspected before ranking findings.
  Show inspection coverage and unresolved gaps. Limit the first feedback round, not discovery.
- **Familiar but misleading:** a remove action sends a provider notification, without proving removal.
  Expect wording that names the completed notification and preserves the provider's fixed identifiers.
- **Different measurement windows:** a dashboard combines current readings with an older reading and calls the set complete.
  Expect the measurement dates to be traced before proposing a full-result label.
  Show missing current measurements separately. Historical availability does not establish current coverage.
- **Generated public wording:** an approved output name appears in email, but readiness notices and downloads use older names.
  Expect generated messages, shared pages, previews, download names, and handoffs to be checked alongside literal labels.
  Keep fixed routes and serialized values separate from public wording.
- **Feature-only request:** a user asks about payroll downloads.
  Expect inspection of that concept and its consumers, without auditing unrelated product journeys.
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

## Removing a saved display choice

An approved removal can leave a stored selection that changes the remaining interface.
Trace the removed choice through saved preferences, selection limits, and empty fallback controls.

For example, a dashboard removes a card because its total adds values with different units.
An existing saved layout still selects that card.
The card disappears, but its key consumes the card limit and hides Add metric controls.
Removing its label did not complete the approved removal.

Exercise the actual layout consumer with that saved selection, an empty selection, and a valid selection.
Check that users can add a replacement and that unrelated saved choices remain intact.
Follow the project's stored-data policy before changing preferences.
A retired-key alias is not required merely to discard an unsupported display choice.
Do not rename unrelated stored values or silently select a replacement card.

## Following a measurement into its verdict

A label can be accurate on one screen while another consumer overstates the same measurement.
Trace the producer through verdicts, metric rows, copied reports, downloads, and API results in the requested scope.
Record each consumer's source, selected dates, measured inputs, and denominator.
Inspect the actual consumer; do not infer its behavior from a shared helper or matching label.

Consider a dashboard that assesses three field metrics: LCP, INP, and CLS.
If only LCP is measured and passes, an unqualified Passing label claims more than the inputs establish.
A percentage calculated from that subset also needs its measured denominator.
Use the project's existing missing-data wording when it fits.
A truthful verdict may require representing measurement coverage in the result before changing the label.
Keep that repair within the user's authority. Report material scoring decisions rather than inventing them.

Exercise complete good data, partial data, no data, and poor measured data through the exported behavior.
Do not silently redesign the numerical score while repairing its claim.
A score and a verdict can have different requirements; inspect both.

For a date-window check, select August with complete passing field measurements.
Include poor September measurements outside the selected window.
The copied report must describe August and agree with its displayed metric rows.
If the export rebuilds its verdict from unfiltered history, the screen and report can contradict each other.
Prove the selected window at the real consumer boundary, including its metric values and source label.

Keep source identity explicit when field measurements and lab measurements share a screen.
CrUX reports aggregated field data; RUM reports collected user measurements; Lighthouse supplies lab results.
Missing field measurements do not turn lab results into field measurements.
Preserve these distinctions in verdicts, explanations, and exports.
Name the sources actually present in the target product; this example does not require all three.
