# M3-R3-P4 Fault, Security and Compatibility Acceptance

## Release classification

```text
releaseType=runtime-acceptance-only
productRuntimeImplemented=true
ciRuntimeExecuted=false
acceptanceVerified=true
productionReady=false
newRuntimeCapabilityAdded=false
```

This release accepts and hardens the existing M3-R3 local governed runtime boundary. It is not a distributed execution release and does not authorize production deployment or PR merge.

## Accepted capabilities

- deterministic fake-only startup, cancellation, timeout, force-termination and settlement behavior;
- shell-free fixed executable and argv boundary;
- registered Adapter identity and exact predecessor binding;
- server-owned environment isolation;
- sanitized runtime outcome and immutable Evidence continuity;
- public API and closed Schema continuity;
- Node.js 22 baseline and Node.js 24 compatibility with one product digest;
- Linux-only formal platform claim;
- path-preserving portable acceptance Artifact.

## Closed defects

```text
existingRuntimeDefectsFound=2
existingRuntimeDefectsClosed=2
encodedTraversalResolverBypass=CLOSED
backslashTraversalResolverBypass=CLOSED
correctionCommit=196c0cb66344af568b7767ff578c402d817ddd57
```

The correction is limited to resolver path rejection before realpath, stat or spawn. No output or execution capability was added.

## Permanent evidence

The natural P4 Workflow produces:

- exact event Head binding;
- real focused, Adapter, full Node and Node 22/24 TAP counts;
- cross-Node compatibility product digest;
- canonical P4 Evidence digest;
- P4 and accepted P3 Schema Catalog digests;
- a closed 23-entry Artifact layout;
- pre-upload credential and unsafe-path audit.

The downloaded Artifact is independently rechecked before merge-readiness is recorded.

## Deferred capability

```text
governedOutputRootImplemented=false
fileResultCollectionSupported=false
fileResultCollectionImplemented=false
sourceBundleRemainsImmutable=true
callerPathAccepted=false
arbitraryFileReadEnabled=false
```

## Merge control

```text
p4ReadyMarked=false
p4Merged=false
m3R3G1Started=false
nextRequiredSlice=M3-R3-G1
```

P4 completion does not authorize Ready or Merge.
