# M3-R4-P3 Bounded Result Collector — Development Handoff

## Current controlled state

```text
repository=akaryc1b/knowledge-driven-test-platform
issue=83
r0Issue=77
r0PullRequest=78
r0AcceptedHead=e522c13065dd77770d414a727d030a5108488eae
p1Issue=79
p1PullRequest=80
p1AcceptedHead=3f0459700e5d7e651011f8addeda8e8164a0ccbc
p2Issue=81
p2PullRequest=82
p2AcceptedHead=b66f223cc4453da4cab4af4df2676327aaa4bd76
branch=agent/m3-r4-p3-bounded-result-collector-b66f223
pullRequestBase=agent/m3-r4-p2-trusted-output-root-port-3f04597
m3R4P2ExactHeadAcceptanceComplete=true
m3R4P2ArtifactIndependentlyVerified=true
m3R4P3Started=true
m3R4P3ImplementationComplete=true
m3R4P3ExactHeadAcceptanceComplete=false
readyMarked=false
merged=false
```

R0 PR #78, P1 PR #80 and P2 PR #82 remain Draft/Open/Unmerged and are not
modified by P3. P3 is stacked directly on the immutable accepted P2 Head.

## Delivered product boundary

```text
collectorPort=k6-bounded-result-collector-port/v1
sealRequest=k6-output-root-seal-request/v1
sealReceipt=k6-output-root-seal-receipt/v1
inspectionRequest=k6-output-artifact-inspection-request/v1
inspectionReceipt=k6-output-artifact-inspection-receipt/v1
payloadRequest=k6-output-artifact-payload-request/v1
payloadReceipt=k6-output-artifact-payload-receipt/v1
boundedResult=k6-bounded-file-result/v1
acceptanceEvidence=m3-r4-output-root-p3-evidence/v1
schemaCatalog=k6-output-root-p3-schema-catalog/v1
```

`collectK6BoundedFileResult` accepts an injected object with `sealRoot`,
`inspectArtifact` and `provideArtifactPayload`, plus an injected monotonic clock.
All requests are closed, deeply frozen and digest-bound.

## Fixed collection behavior

```text
implementationStatus=INJECTED_FAKE_ONLY
logicalStatePath=ALLOCATED->ACTIVE->TERMINAL_OBSERVED->SEALED->COLLECTED
artifactDescriptorCount=1
artifactKind=k6-run-summary-json
artifactPath=outputs/summary.json
maxFiles=1
maxFileBytes=1048576
maxTotalBytes=1048576
maxJsonDepth=32
maxCollectionDurationMs=10000
encoding=UTF-8
duplicateKeyPolicy=REJECT
bomAllowed=false
rawPayloadIncluded=false
rawPayloadPersisted=false
```

The result contains content and canonical JSON digests but never raw bytes or a
host path.

## Required validation

1. run the focused P3 collector and mutation suite on Node.js 22;
2. run the same fake-only suite on Node.js 24 and compare the canonical product;
3. run every k6 API Adapter test;
4. run the complete Node.js test suite;
5. run the root Repository Validator including the permanent P3 Validator;
6. produce one exact-Head path-preserving permanent Artifact;
7. independently audit API metadata, downloaded ZIP digest, path allow-list,
   object types, UTF-8, collisions, sensitive-value scan, Evidence Schema and
   canonical digests;
8. re-read Reviews, threads, Conversation, changed paths, mergeability and all
   predecessor identities before exact-Head acceptance.

Only naturally triggered Pull Request Workflows are authoritative. Failed Runs
remain permanent and corrections require a new append-only commit and a new
natural Run.

## Prohibited actions

- implement a concrete host filesystem adapter;
- create or accept a real output directory;
- expose or accept a public absolute host path;
- recursively discover undeclared results;
- invoke k6, xk6 or Playwright;
- start a real external process in CI;
- access target network, database, Secrets or credential files;
- persist or publish raw result bytes;
- collect raw stdout, stderr, numeric PID, raw error or stack trace;
- modify the Source Bundle, Invocation Plan or Node process adapter;
- add Worker, Queue, Scheduler, container, Kubernetes, remote execution API or
  Allure;
- mark Ready, merge, rerun, amend, force push or rewrite history.

## P3 stop point

```text
m3R4P3ImplementationComplete=true
m3R4P3FakeOnlyCollectorBoundaryComplete=true
m3R4P3ExactHeadAcceptanceComplete=<set only after natural CI and Artifact audit>
m3R4P3ArtifactIndependentlyVerified=<set only after independent audit>
m3R4P3ReadyMarked=false
m3R4P3Merged=false
m3R4P4Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R4-P4
```
