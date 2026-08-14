# M3-R4 — Governed Output Root and Bounded File Result Collection

## Status

```text
repository=akaryc1b/knowledge-driven-test-platform
slice=M3-R4-P4
issue=85
r0Issue=77
r0PullRequest=78
r0AcceptedHead=e522c13065dd77770d414a727d030a5108488eae
p1Issue=79
p1PullRequest=80
p1AcceptedHead=3f0459700e5d7e651011f8addeda8e8164a0ccbc
p2Issue=81
p2PullRequest=82
p2AcceptedHead=b66f223cc4453da4cab4af4df2676327aaa4bd76
p3Issue=83
p3PullRequest=84
p3AcceptedHead=9a11bd749620af23735955fb3c90b034c8e63944
branch=agent/m3-r4-p4-fault-security-compatibility-9a11bd7
baseMain=6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa
m3R4P3ExactHeadAcceptanceComplete=true
m3R4P3ArtifactIndependentlyVerified=true
m3R4P4Started=true
m3R4P4ImplementationComplete=true
m3R4P4ExactHeadAcceptanceComplete=false
m3R4G1Started=false
```

## Immutable P3 entry snapshot

The following block is retained for historical P3 validators and must not be
interpreted as the current branch status:

```text
slice=M3-R4-P3
m3R4P2ExactHeadAcceptanceComplete=true
m3R4P3Started=true
m3R4P3ImplementationComplete=true
m3R4P3ExactHeadAcceptanceComplete=false
m3R4P4Started=false
nextRequiredSlice=M3-R4-P4
```

P4 is an acceptance-only slice over the P3 injected collector. It verifies the
existing contract under deterministic adversarial inputs and freezes the proof
obligations for a later, separately authorized Linux filesystem adapter. It
does not add such an adapter.

## Accepted P3 predecessor

```text
p3Head=9a11bd749620af23735955fb3c90b034c8e63944
p3NaturalWorkflowCount=22
p3NaturalWorkflowSuccess=22
p3ArtifactId=9206572282
p3ArtifactRunId=31766633684
p3ArtifactJobId=94663794366
p3ArtifactApiDigest=sha256:d65239287215365e008da683297eaed4a8a16db2680619076cb8eb4dfa850d33
p3CanonicalEvidenceDigest=a21ba8d33213ee9c08de67f685e63f7a9794d48058d8a343b167b1611fe1576e
p3SchemaCatalogDigest=0658defe8fe06f74b17d6caedd33ecf0e711313effa6d172e8797a9876e41d03
p3CompatibilityProductDigest=03b2ac5c2c3ad035744426e9ac6a54f800381b6e9e72d9bfc90553f5938a6ac0
p3EvidenceRewritten=false
```

The failed predecessor Runs `31683057327` and `31765895829` remain permanent;
P4 neither reruns nor hides them.

## P4 adversarial acceptance

The focused suite covers:

- caller-path, absolute-path, URI, mixed-separator and traversal substitutions;
- symlink, hard-link, special-object, directory and unstable-object reports;
- stale artifact handles and stale receipt metadata;
- exact and one-over limits for bytes, JSON depth and collection duration;
- escaped duplicate JSON keys and same-length payload replacement;
- sanitized seal, inspection, payload and clock failures;
- metadata-only disclosure and static rejection of effectful primitives.

```text
implementationStatus=ACCEPTANCE_ONLY
adversarialAcceptanceComplete=true
p3CollectorProductChanged=false
p3SchemasChanged=false
maxFiles=1
maxFileBytes=1048576
maxTotalBytes=1048576
maxJsonDepth=32
maxCollectionDurationMs=10000
rawPayloadPersisted=false
rawPayloadIncludedInEvidence=false
```

## Linux implementation assessment

A future Linux implementation must be separately authorized and must prove:

- platform-owned private root allocation;
- no caller-provided host path;
- root-relative resolution with no-follow semantics;
- regular-file-only collection;
- validation and bounded read through the same trusted handle;
- stable object identity before and after read;
- collection only after an explicit sealed state;
- no public host path and no raw payload persistence.

```text
realFilesystemImplementationEvaluated=true
realFilesystemImplementationAuthorized=false
realFilesystemCollectorImplemented=false
realDirectoryCreated=false
realHostFileOpened=false
realHostFileRead=false
realHostFileWritten=false
platformCompatibility=linux-contract-baseline
windowsCompatibilityClaimed=false
macosCompatibilityClaimed=false
```

## Ordered safe slices

1. **R0 — Rebaseline and boundary freeze**
2. **P1 — Versioned output-root contracts**
3. **P2 — Injected trusted root port**
4. **P3 — Bounded result collector**
5. **P4 — Fault, security and compatibility acceptance**
6. **G1–G4 — Formal acceptance and exact-main closure**

Only P4 is implemented on this branch. G1–G4 remain frozen until P4 exact-Head
natural CI and independent Artifact verification complete.

## P4 stop condition

```text
m3R4P4ImplementationComplete=true
m3R4P4ExactHeadAcceptanceComplete=true
m3R4P4ArtifactIndependentlyVerified=true
realFilesystemImplementationAuthorized=false
realFilesystemCollectorImplemented=false
p3CollectorProductChanged=false
m3R4G1Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R4-G1
```
