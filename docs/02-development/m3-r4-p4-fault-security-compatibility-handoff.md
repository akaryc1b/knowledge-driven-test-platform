# M3-R4-P4 Fault, Security and Compatibility Acceptance — Development Handoff

## Controlled state

```text
repository=akaryc1b/knowledge-driven-test-platform
slice=M3-R4-P4
issue=85
p3Issue=83
p3PullRequest=84
p3AcceptedHead=9a11bd749620af23735955fb3c90b034c8e63944
branch=agent/m3-r4-p4-fault-security-compatibility-9a11bd7
pullRequestBase=agent/m3-r4-p3-bounded-result-collector-b66f223
m3R4P3ExactHeadAcceptanceComplete=true
m3R4P3ArtifactIndependentlyVerified=true
m3R4P4Started=true
m3R4P4ImplementationComplete=true
m3R4P4ExactHeadAcceptanceComplete=false
implementationStatus=ACCEPTANCE_ONLY
readyMarked=false
merged=false
m3R4G1Started=false
```

P4 is stacked directly on the immutable accepted P3 Head. R0, P1, P2 and P3
products, Schemas and permanent Evidence are not rewritten.

## Delivered acceptance boundary

P4 adds no runtime product module. It adds:

- a deterministic adversarial suite for exact paths, object attestations,
  stale handles, byte/depth/duration limits, parser ambiguity, disclosure and
  failure sanitization;
- a permanent Validator that replays the accepted P3 products and digests;
- a closed Draft 2020-12 P4 Evidence Schema;
- a read-only Node.js 22 baseline / Node.js 24 fake-only compatibility Workflow;
- a path-preserving permanent Evidence Artifact;
- an ADR and threat model for a separately authorized Linux implementation.

```text
p3CollectorProductChanged=false
p3SchemasChanged=false
realFilesystemImplementationEvaluated=true
realFilesystemImplementationAuthorized=false
realFilesystemCollectorImplemented=false
platformCompatibility=linux-contract-baseline
windowsCompatibilityClaimed=false
macosCompatibilityClaimed=false
```

## Required exact-Head acceptance

1. verify the diff from the accepted P3 Head is the exact P4 allow-list;
2. run the focused P4 suite on Node.js 22 and Node.js 24;
3. prove the compatibility product digest remains
   `03b2ac5c2c3ad035744426e9ac6a54f800381b6e9e72d9bfc90553f5938a6ac0`;
4. run all k6 API Adapter tests and the complete Node.js suite;
5. run the complete Repository Validator chain;
6. generate one exact-Head P4 Evidence Artifact;
7. independently verify API metadata, downloaded ZIP digest, path allow-list,
   object types, UTF-8, collision checks, sensitive-value scan, Schema and
   canonical digests;
8. re-read Reviews, threads, Conversation, mergeability and all natural Runs.

Failed natural Runs remain permanent. Corrections require an append-only commit
and a newly triggered natural Run; manual reruns are prohibited.

## Stop condition

```text
m3R4P4ImplementationComplete=true
m3R4P4ExactHeadAcceptanceComplete=<set only after natural CI and Artifact audit>
m3R4P4ArtifactIndependentlyVerified=<set only after independent audit>
realFilesystemImplementationAuthorized=false
realFilesystemCollectorImplemented=false
p3CollectorProductChanged=false
readyMarked=false
merged=false
m3R4G1Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R4-G1
```
