# Release evidence

Inspect only what is needed to establish the requested release and its consumer impact.
Keep the evidence complete enough to support the copy. The reader's attention limit governs the output, not factual diligence.

## Establish the range

Use the supplied previous and target versions, tags, or commits.
If a target is already released, inspect its exact tag or commit rather than treating current HEAD as released.
Distinguish stable versions from prereleases. Confirm an unclear baseline before dependent claims.

When repository tools are available, inspect:

- Commits and the complete net diff between the two versions.
- Relevant PR bodies and contributor metadata.
- Public exports, configuration defaults, generated behavior, and supported runtime ranges.
- Dependency major changes and their official migration guidance.
- Existing release notes and migration guides.

Use the target's approved tools and credentials. Do not assume a particular GitHub CLI or account.
When only supplied material is available, work from it and name the evidence limit.

## Check consumer consequences

For each candidate change, establish the trigger, before-and-after behavior, affected users, and required action.
Verify breaking changes against public behavior, rather than relying only on commit prefixes or labels.
An internal rename alone does not establish a consumer break.
An unlabelled removed export or changed default can still break a consumer.

Check whether migration examples use the supported API and dependency versions.
Distinguish removed behavior, deprecated behavior, and optional improvements.
If the proposed version conflicts with verified compatibility changes, flag the mismatch before drafting misleading upgrade claims.

## Check measurements and credit

For each number, record the baseline, target, unit, configuration, method, and relevant limits.
Check percentage calculations and whether the comparison measures the claimed quantity.
Keep representative results distinct from a guarantee for every project.
Do not call a historical measurement a fresh benchmark.

Preserve contributor names and supplied pronouns. Check attribution from repository or supplied evidence.
Do not infer contribution from a squash-merge author alone.

## Keep a private record

Record sources and revisions beside the claims they support.
Record any rejected breaking-change candidate and why it does not affect consumers.
Keep unresolved facts visible. Seek the missing evidence, qualify the claim, or ask when it changes the release meaning.
Do not silently invent a replacement fact.

Use this record to check the final notes after editorial changes.
Deliver only the evidence the reader or reviewer needs to assess the result.
