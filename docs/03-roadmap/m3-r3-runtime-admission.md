# M3-R3 Runtime Admission Roadmap

## M3-R3-R0 — Governed Runtime Admission Contract

R0 establishes the first governed boundary between an accepted M3-R2 Source Bundle and any future process adapter.

### Inputs

R0 admits only an immutable chain containing:

- Execution Request identity and digest;
- project, environment, frozen Test Plan and Knowledge Snapshot digests;
- exact k6 API Adapter descriptor binding;
- M3-R1 Spec and Compilation Evidence;
- M3-R2 Source Publication Bundle, Receipt and Publication Evidence;
- accepted P3 trust anchor and Source identity.

### Outputs

R0 produces:

- a fixed Runtime Policy;
- a deterministic Runtime Admission Request;
- a shell-free argv Invocation Plan;
- immutable Admission Evidence;
- repository acceptance Evidence and permanent CI Artifact.

### Resource policy

```text
maxVus=50
maxIterations=10000
maxDurationMs=900000
maxGracefulStopMs=30000
shellAllowed=false
executionAuthorized=false
```

The Invocation Plan may name `K6_LOG_FORMAT` and `K6_NO_COLOR`, but it never carries environment values. The only planned output kind is `k6-run-summary-json`; R0 does not create or collect that result.

### Explicit exclusions

```text
executionImplementationStarted=false
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
xk6Invoked=false
playwrightInvoked=false
externalProcessExecuted=false
shellUsed=false
targetNetworkAccessed=false
databaseAccessed=false
secretAccessed=false
runtimeResultCollected=false
```

## Frozen later slices

The following are planning placeholders and remain frozen:

- **M3-R3-P1** — injected local process port and adapter;
- **M3-R3-P2** — bounded lifecycle, timeout and cooperative cancellation;
- **M3-R3-P3** — sanitized Runtime Result and immutable Evidence collection;
- **M3-R3-P4** — fault, security and compatibility acceptance;
- **M3-R3-G1–G4** — formal acceptance and merge closure.

R0 does not implement a process port, spawn a process, access a target, resolve Secrets or collect results.

```text
runtimeAdmissionContractReady=true
invocationPlanReady=true
executionImplementationStarted=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-P1
```
