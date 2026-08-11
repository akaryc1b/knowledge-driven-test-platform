# M3-R4-P1 Output-Root Contracts — Development Handoff

## Current controlled state

```text
repository=akaryc1b/knowledge-driven-test-platform
issue=79
r0Issue=77
r0PullRequest=78
r0AcceptedHead=e522c13065dd77770d414a727d030a5108488eae
branch=agent/m3-r4-p1-output-root-contracts-e522c13
pullRequestBase=agent/m3-r4-r0-governed-output-root-rebaseline-6737436
m3R4P1Started=true
m3R4P1ImplementationComplete=true
m3R4P1ExactHeadAcceptanceComplete=false
readyMarked=false
merged=false
```

The branch starts from the immutable R0 exact Head. R0 PR #78 remains Draft/Open/Unmerged and is not modified by P1.

## Delivered contracts

```text
policy=k6-governed-output-root-policy/v1
descriptor=k6-output-artifact-descriptor/v1
rootContract=k6-governed-output-root-contract/v1
acceptanceEvidence=m3-r4-output-root-p1-evidence/v1
schemaCatalog=k6-output-root-p1-schema-catalog/v1
```

P1 binds the exact Runtime Policy, Admission Request, Invocation Plan, Runtime Admission Evidence and immutable Runtime Execution Evidence digests. The logical root ID is path-independent and binds one exact artifact descriptor.

## Fixed artifact and limits

```text
artifactKind=k6-run-summary-json
artifactPath=outputs/summary.json
artifactMediaType=application/json
artifactEncoding=UTF-8
maxFiles=1
maxFileBytes=1048576
maxTotalBytes=1048576
maxJsonDepth=32
maxCollectionDurationMs=10000
```

## Lifecycle grammar

```text
DECLARED->ALLOCATED
ALLOCATED->ACTIVE
ACTIVE->TERMINAL_OBSERVED
TERMINAL_OBSERVED->SEALED
SEALED->COLLECTED
COLLECTED->CLEANED
```

P1 declares the grammar only. The produced contract remains at `DECLARED`, with allocation, collection and cleanup authorization all false.

## Required validation

1. run the focused P1 contract and mutation suite on Node.js 22;
2. run the same fake-only suite on Node.js 24 and compare the canonical product digest;
3. run every k6 API Adapter test;
4. run the complete Node.js test suite;
5. run the full root Repository Validator including the P1 permanent Validator;
6. produce one exact-Head, path-preserving permanent Artifact;
7. independently audit Artifact API metadata, downloaded ZIP digest, entry allow-list, object types, UTF-8, collisions, Evidence Schema and canonical digests;
8. re-read Review, thread, Conversation, changed-path, mergeability and predecessor state before exact-Head acceptance.

Only naturally triggered Pull Request Workflows are authoritative. Failed Runs remain permanent; corrections require a new append-only commit and a new natural Run.

## Prohibited actions

- allocate or create a governed output directory;
- accept a caller-provided or public absolute path;
- open, read, write, list, resolve or collect a runtime result file;
- modify the Source Bundle, Invocation Plan or Node process adapter;
- add another process primitive or start a real process in CI;
- invoke k6, xk6 or Playwright;
- access target network, database, Secrets or credential files;
- collect raw stdout, stderr, numeric PID, raw error or stack trace;
- add Worker, Queue, Scheduler, container, Kubernetes, remote execution API or Allure;
- mark Ready, merge, rerun, amend, force push or rewrite history.

## P1 stop point

```text
m3R4P1ImplementationComplete=true
m3R4P1ContractBoundaryComplete=true
m3R4P1ExactHeadAcceptanceComplete=<set only after natural CI and Artifact audit>
m3R4P1ReadyMarked=false
m3R4P1Merged=false
m3R4P2Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R4-P2
```
