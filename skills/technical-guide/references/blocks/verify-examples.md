---
name: verify-examples
description: Check documentation examples against their stated setup and promised outcomes. Use for commands, code, or configuration that readers should be able to run, without rewriting the whole guide.
license: MIT
compatibility: "Designed for agents that can read and edit project text files."
---

# Verify examples

Check a reader's runnable examples against the documented starting state and promised result.
This block owns example verification and requested repairs. It does not write or review the whole guide.
Follow the target's instructions, supported version, package manager, and documented checks.

## Establish the example contract

Read the example, surrounding instructions, prerequisites, and expected result.
If no example or document location is supplied, ask for it. Do not search for a replacement task.
Identify the runtime, package version, working directory, configuration, inputs, and required access.
Separate runnable code from pseudocode, schematic output, and illustrative fixtures.
If a core input is missing, report it before dependent execution.
Read matching source, exports, versioned CLI help, tests, and official documentation where needed.
Reconcile checkout behavior with the release the reader can install.
Use a small private ledger for evidence, checked revision, expected result, and unresolved questions.
Keep this ledger outside public content and generated downloads.

## Run the reader's path

Use a clean scratch project or the target's documented fixture where available.
Match the stated starting state. Do not rely on prior session setup.
Run the actual documented setup, commands, and inputs in order.
Use read-only inspection until state-changing execution is authorized.
Writing documentation does not authorize production writes, spending, installation, or sending messages.
For authorized changes, use an isolated environment where possible. Keep credentials out of code and captured output.

Observe exit status, output, and relevant side effects. Compare them with the promised result.
Check consequential conditions and response metadata, rather than only a successful command.
For a protocol example, inspect applicable status, headers, body, and conditions against its official specification.
Check documented cleanup and recovery for observed failures.
Derive checks from the requested scope and supporting evidence. Do not invent a broad edge-case suite.
Source inspection, lint, and builds cannot substitute for execution of the example.
A successful common path does not establish every supported platform or condition.

## Repair and repeat

For each failure, record expected behavior, actual observation, evidence, and the affected passage.
Distinguish a wrong instruction from unavailable access, tooling, or environment.
If repair is authorized, fix the smallest underlying mismatch in the example and dependent explanation.
If only a review was requested, return the repair proposal without editing files.
Keep the original example and observed failure in private evidence.
Repeat the failed check and any checks affected by the repair.
After editorial edits change a verified command or claim, repeat its affected checks.
Do not reuse an earlier revision's result to claim the final example works.

If execution is unavailable, inspect the best available evidence and name the untested path.
Do not fabricate output, silently substitute a different interface, or hide a failed check.
Report only actions actually performed. A tool with no result supplies no inspection evidence.
Mark illustrative output as illustrative. Keep an unsupported core reader path identified as a draft.

## Return the evidence

State the version or revision, path that ran, observed outcome, and remaining limits.
Distinguish executed examples from examples checked only against source.
Keep detailed transcripts outside the public document. Report meaningful repairs when requested.
Verification does not grant permission to publish or deploy the result.
