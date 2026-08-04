# M3-R3-P2 Development Handoff

## Accepted baseline

```text
baselineMain=d830f923e5b7a7e1129307fc6bf591c88a4c7f4b
acceptedP1Pr=59
acceptedP1SourceHead=19ed7fc40ef9bc305027f36a51f174c1e292c591
acceptedP1MergeSha=d830f923e5b7a7e1129307fc6bf591c88a4c7f4b
acceptedP1MainRun=30895410513
acceptedP1MainJob=91947015653
acceptedP1MainArtifact=8886800896
acceptedP1ArtifactDigest=sha256:84a41fa636651412765796ed1040305fa0c2ca1b6441f2e8f37a542772736f61
acceptedP1CanonicalEvidenceDigest=4aa20c5b733498004b4a083dd8af99aa565c7a8df21a9509f0c759f9fc630c7c
```

## Delivered P2 boundary

P2 adds the first real Node process adapter behind the accepted P1 boundary. The only production process primitive is `node:child_process.spawn`. The adapter is registered through a module-private `WeakMap`; callers must use the governed execution entry, which validates the complete P1 chain before execution.

The adapter fixes `executable=k6`, the accepted argv array, `shell=false`, `detached=false`, `windowsHide=true`, ignored stdin/stdout/stderr, a trusted pre-materialized immutable Source Bundle root, and adapter-owned values for the approved environment names only. It never inherits `process.env`.

Lifecycle handling covers cancellation before start, bounded spawn acknowledgement, normal exit, start failure, execution timeout, cooperative `SIGINT`, bounded grace, `SIGKILL`, and a final force-settlement bound. Numeric host PID values, output, raw errors, stack traces, host paths and environment values never enter public Evidence.

## CI boundary

Permanent CI uses injected fake spawn, timers, filesystem probes and abort signals. It validates lifecycle races without starting any real process.

```text
nodeProcessAdapterImplemented=true
boundedLifecycleImplemented=true
realProcessStartedInCi=false
processIdCreatedInCi=false
signalSentInCi=false
k6InvokedInCi=false
externalProcessExecutedInCi=false
runtimeResultCollected=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-P3
```

M3-R3-P3 remains frozen. No runtime output parsing, result Artifact, Allure, Worker, Queue, Scheduler, container, Kubernetes resource or remote execution API is included.
