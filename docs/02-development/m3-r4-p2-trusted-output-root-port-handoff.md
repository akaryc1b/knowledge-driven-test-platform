# M3-R4-P2 Trusted Output-Root Port — Development Handoff

## Current controlled state

```text
repository=akaryc1b/knowledge-driven-test-platform
issue=81
r0Issue=77
r0PullRequest=78
r0AcceptedHead=e522c13065dd77770d414a727d030a5108488eae
p1Issue=79
p1PullRequest=80
p1AcceptedHead=3f0459700e5d7e651011f8addeda8e8164a0ccbc
branch=agent/m3-r4-p2-trusted-output-root-port-3f04597
pullRequestBase=agent/m3-r4-p1-output-root-contracts-e522c13
m3R4P1ExactHeadAcceptanceComplete=true
m3R4P1ArtifactIndependentlyVerified=true
m3R4P2Started=true
m3R4P2ImplementationComplete=true
m3R4P2ExactHeadAcceptanceComplete=false
readyMarked=false
merged=false
```

R0 PR #78 and P1 PR #80 remain Draft/Open/Unmerged and are not modified by
P2. P2 is stacked directly on the immutable accepted P1 Head.

## Delivered product boundary

```text
port=k6-trusted-output-root-port/v1
allocationRequest=k6-output-root-allocation-request/v1
allocationReceipt=k6-output-root-allocation-receipt/v1
resolutionRequest=k6-output-artifact-resolution-request/v1
resolutionReceipt=k6-output-artifact-resolution-receipt/v1
boundaryEvidence=k6-trusted-output-root-boundary-evidence/v1
acceptanceEvidence=m3-r4-output-root-p2-evidence/v1
schemaCatalog=k6-output-root-p2-schema-catalog/v1
```

`prepareK6TrustedOutputRoot` accepts an injected object with
`allocateRoot(request)` and `resolveArtifact(request)`. Both requests are closed,
deeply frozen and digest-bound. Receipts must exactly match deterministic
fake-only constructors.

## Fixed allocation behavior

```text
implementationStatus=INJECTED_FAKE_ONLY
ownership=PLATFORM_OWNED
requestedTransition=DECLARED->ALLOCATED
logicalRootAllocated=true
currentState=ALLOCATED
allocationHandle=k6root-handle-<20 lowercase hex>
realDirectoryCreated=false
realFilesystemAccessed=false
hostPathIncluded=false
callerPathAccepted=false
sourceBundleMutated=false
```

The allocation handle is an opaque logical identity, not a filesystem path.

## Fixed resolution behavior

```text
descriptorId=k6-output-summary-json
artifactKind=k6-run-summary-json
relativePath=outputs/summary.json
artifactHandle=k6artifact-handle-<20 lowercase hex>
resolved=true
opaqueHandleReturned=true
regularFileVerified=false
objectOpened=false
fileRead=false
fileWritten=false
realFilesystemAccessed=false
hostPathIncluded=false
```

P2 resolves only the contract-declared artifact identity. It does not verify or
open a host object.

## Required validation

1. run the focused P2 port and mutation suite on Node.js 22;
2. run the same fake-only suite on Node.js 24 and compare the canonical product;
3. run every k6 API Adapter test;
4. run the complete Node.js test suite;
5. run the root Repository Validator including the permanent P2 Validator;
6. produce one exact-Head path-preserving permanent Artifact;
7. independently audit API metadata, downloaded ZIP digest, path allow-list,
   object types, UTF-8, collisions, sensitive-value scan, Evidence Schema and
   canonical digests;
8. re-read Reviews, threads, Conversation, changed paths, mergeability and
   predecessor state before exact-Head acceptance.

Only naturally triggered Pull Request Workflows are authoritative. Failed Runs
remain permanent and corrections require a new append-only commit and a new
natural Run.

## Prohibited actions

- implement a real filesystem adapter;
- create or accept a real output directory;
- accept a caller-provided or public absolute path;
- open, read, write, list, realpath or recursively discover a result object;
- claim regular-file, link, alias or TOCTOU verification;
- collect file results or modify Runtime Evidence;
- modify the Source Bundle, Invocation Plan or Node process adapter;
- add a process primitive or start a real process in CI;
- invoke k6, xk6 or Playwright;
- access target network, database, Secrets or credential files;
- collect raw stdout, stderr, numeric PID, raw error or stack trace;
- add Worker, Queue, Scheduler, container, Kubernetes, remote execution API or
  Allure;
- mark Ready, merge, rerun, amend, force push or rewrite history.

## P2 stop point

```text
m3R4P2ImplementationComplete=true
m3R4P2FakeOnlyPortBoundaryComplete=true
m3R4P2ExactHeadAcceptanceComplete=<set only after natural CI and Artifact audit>
m3R4P2ArtifactIndependentlyVerified=<set only after independent audit>
m3R4P2ReadyMarked=false
m3R4P2Merged=false
m3R4P3Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R4-P3
```
