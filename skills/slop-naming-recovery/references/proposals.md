# Naming proposals for user feedback

Give the user a decision they can review without opening the codebase.
Lead with a ranked summary, then show each proposal in a small, numbered block.
Show at most three proposals in the first feedback round. Keep the remaining findings in the report.
This limits presentation, not discovery or already authorized fixes.
Complete the requested inspection before choosing which findings to show first.
Maintain stable IDs such as N1 and N2, even when their priority changes.
Follow a supplied feedback format when the user prefers one.

## Proposal format

### N1: Artifact → Payslip

**Recommendation:** Payslip. Confidence 94/100 in this example's stated meaning.
**User task:** An employee downloads their earnings statement.
**Problem:** Artifact says a file exists. Payslip says what the employee receives.
**Evidence:** Link the actual glossary entry, payroll producer, and download label with file lines.
**Current authority:** Explicit glossary term. This proposal revises that decision.

**Exact glossary change:**

```diff
-### Artifact
-**Is:** the generated employee earnings statement.
-**Use for:** the payroll download and its generating function.
+### Payslip
+**Is:** the generated employee earnings statement.
+**Use for:** the payroll download and its generating function.
+**Never:** artifact, payroll artifact.
+**Casing:** Payslip in headings; payslip in prose and identifiers.
```

Adapt the diff to the target glossary's actual format. Preserve unrelated entries.
Show the exact Map row change when the target glossary has a Map.
If no Map exists, omit it unless the user requests one.
If another document owns terminology, show the exact proposed edit there and identify its existing authority.
If no naming document exists, show a standalone proposed term entry. Create no file until authorized.
Keep a wording-only proposal separate from an optional identifier or contract rename.
State what accepting the proposal changes and which names remain intentional.

**Before → after:** Download artifact → Download payslip; `generateArtifact` → `generatePayslip`.
**Affected surfaces:** Glossary, payroll download, generator, and its consumers.
**Contract cost:** Name any affected stored values, public exports, routes, or provider identifiers.
**Approval scope:** State the exact surfaces this decision authorizes. Give a broader API rename its own decision.
**Keep instead:** Retains existing wording, with the reading problem described above.

This is an illustrative proposal. Its confidence and names are not scores for an uninspected repository.

## Invite a short response

End with a response pattern, for example:

```text
Reply: N1 accept; N2 keep; N3 use “Safety confirmation”.
“Defer N2” leaves that proposal open.
```

Do not require a checkbox form, a new app, or a reply to every finding.
Accept ordinary feedback and map it to the named proposal.
If feedback could refer to different concepts, clarify that choice before dependent edits.
If proposals share a contract or collide with another name, show the dependency before requesting a decision.
Approval of wording covers only the stated surfaces and migration scope.
If edited wording changes the concept's meaning, show the revised proposal before propagating it.
Keep unresolved choices as proposals. Do not mark them canonical or add them to a ban list.
