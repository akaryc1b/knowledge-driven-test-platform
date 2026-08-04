# ADR-0030: Governed k6 Runtime Admission Before Process Execution

## Status

Accepted for M3-R3-R0 implementation.

## Context

M3-R0 defines generic immutable execution contracts. M3-R1 compiles a frozen Test Plan into neutral non-executable k6 API IR. M3-R2 generates, statically validates and locally publishes an immutable Source Bundle.

Those stages prove what may eventually be executed, but they do not justify immediately spawning `k6`. A process boundary adds new risks: binary substitution, shell injection, resource exhaustion, environment/Secret leakage, mutable filesystem paths, cancellation ambiguity and result tampering.

## Decision

Introduce a separate admission-only stage before any process adapter:

1. a fixed Runtime Policy defines the executable label, subcommand, resource limits, allow-lists and cooperative cancellation contract;
2. an Admission Request binds the exact Execution Request digest to the M3-R1 Spec/Compilation Evidence and M3-R2 publication chain;
3. an Invocation Plan records a deterministic argv array and relative Source path;
4. Admission Evidence binds the request and plan while recording that execution has not started;
5. all identities use canonical JSON and SHA-256;
6. R0 contains no process port or operating-system integration.

The executable label `k6` is data in a closed plan. It is not resolved, installed or invoked by R0.

## Consequences

### Positive

- Source approval is separated from process execution.
- Shell construction is structurally impossible in the admitted contract.
- Runtime resources and environment names are bounded before an adapter exists.
- A future process adapter can accept only a validated immutable plan.
- Admission decisions and safety claims are independently reproducible.

### Costs

- P1 must add an explicit process port instead of directly calling Node process APIs.
- Future adapters must map a relative Source path to a server-owned materialized bundle root.
- Result collection and Secret resolution require separate contracts and reviews.

## Rejected alternatives

- **Spawn k6 directly from the Source publisher:** rejected because persistence and execution have different trust boundaries.
- **Store a shell command string:** rejected because quoting and metacharacter interpretation are platform-dependent.
- **Permit arbitrary environment maps:** rejected because names and values can carry credential material.
- **Use mutable filesystem paths in the admission identity:** rejected because host paths are not portable immutable identities.

## Boundary

```text
M3-R3-R0
runtimeAdmissionContractReady=true
invocationPlanReady=true
executionImplementationStarted=false
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
externalProcessExecuted=false
shellUsed=false
targetNetworkAccessed=false
secretAccessed=false
runtimeResultCollected=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-P1
```
