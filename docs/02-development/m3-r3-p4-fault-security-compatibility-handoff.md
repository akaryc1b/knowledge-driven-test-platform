# M3-R3-P4 Development Handoff

## Current controlled state

```text
repository=akaryc1b/knowledge-driven-test-platform
issue=67
parentIssue=50
branch=agent/m3-r3-p4-fault-security-compatibility-acceptance
baseMain=8684836233837c905e0ced20e8eac2cfd0b43601
p4ReadyMarked=false
p4Merged=false
m3R3G1Started=false
```

The branch was created from the reverified current `main`. At R0 creation time there were no open Pull Requests and no competing branch, Issue or Pull Request matching the P4 scope.

## Accepted predecessor chain

```text
p3Issue=64
p3ImplementationPr=65
p3ImplementationSourceHead=2d573b62aa78e66c7b767e55004ed0e0d41b512d
p3ImplementationMergeSha=e406e82fdb5ffba6ccfa527a1e069675ed39f03b
p3CorrectionPr=66
p3CorrectionSourceHead=dc202168e26f26d08084273cebeb3efd3073c0af
p3CorrectionMergeSha=8684836233837c905e0ced20e8eac2cfd0b43601
p3ExactMainRun=30972073647
p3ExactMainJob=92198391799
p3ExactMainArtifact=8916886644
p3ExactMainArtifactDigest=sha256:03aa6427219be39b0daf771d08a7a604b9a4e4c17ccf9ec314ef3d55f39c74f4
p3CanonicalEvidenceDigest=5420c474aa95840fc216c8ff61de52dfbc4d8d137a10d5233e82d6f6963ab6c7
p3SchemaCatalogDigest=f9eb33758c4ccc9433a613569f3a524759f7f381e307a75b65c49d4a3e925cc0
p3RuntimeExecutionEvidenceDigest=a0bef0eca6a8ec5b02535f0688e14e3a8ca16c2f5fdda746ec14b8f76ab2afd9
```

The P3 Artifact was re-downloaded during R0. Its ZIP SHA-256 equals the Artifact API digest, it remains unexpired, and the accepted 18-entry path-preserving layout was rechecked. P4 must never rewrite that historical Artifact.

## R0 frozen decisions

```text
p4ProductCapabilityAdded=false
p4ExistingRuntimeBehaviorChanged=false
p4FaultMatrixFrozen=true
p4SecurityMatrixFrozen=true
p4CompatibilityMatrixFrozen=true
nodeEngine=>=22
moduleType=ESM
node22Baseline=true
node24CompatibilityPlanned=true
platformCompatibility=linux
windowsCompatibilityClaimed=false
macosCompatibilityClaimed=false
governedOutputRootImplemented=false
fileResultCollectionImplemented=false
sourceBundleRemainsImmutable=true
securityDashboardEnumerationAvailable=false
zeroAlertClaimMade=false
```

## Required slice order

1. `M3-R3-P4-R0` — baseline, matrix, threat model and boundary tests;
2. `M3-R3-P4-P1` — fault and lifecycle-race tests using fakes only;
3. `M3-R3-P4-P2` — adversarial security and sensitive-boundary tests;
4. `M3-R3-P4-P3` — Node 22/24 compatibility, determinism and contract continuity;
5. `M3-R3-P4-P4` — closed Acceptance Evidence Schema, Validator, permanent Workflow, Artifact and exact-Head record.

Each slice must have a single-purpose commit or clearly separated commits, targeted validation, natural PR runs after the Draft PR exists, an Issue/PR record, and an explicit decision before starting the next slice.

## Runtime acceptance constraints

- tests inject fake child process, timer, resolver and abort signal;
- permanent CI never starts a real process and never calls k6/xk6/Playwright;
- the only production primitive remains the dedicated adapter's `node:child_process.spawn`;
- no stdout/stderr collection, numeric PID, raw error, stack or host absolute path enters public output;
- no host environment inheritance or arbitrary environment value is accepted;
- no caller-provided output path, arbitrary file read or Source Bundle mutation is added;
- no Worker, Queue, Scheduler, persistence, container, Kubernetes resource, remote API, Allure or UI is added.

## Correction rule

A P4 test may expose a real R0-P3 defect. A correction is allowed only when it preserves the accepted capability boundary, is minimal, has an exact regression test and is documented with finding, root cause and impact. New capability must be recorded as a blocker rather than implemented.

A failed natural Run is retained. Do not manually rerun it. Apply the correction in a new commit and rely on the new natural Pull Request Run.

## P4 stop point

```text
m3R3P4ImplementationComplete=true
m3R3P4ExactHeadAcceptanceComplete=true
m3R3P4MergeReadinessEvidenceComplete=true
m3R3P4ReadyMarked=false
m3R3P4Merged=false
m3R3G1Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-G1
```

P4 completion is not authorization to mark Ready or merge. G1 remains a later independent slice.
