# ADR-0031: Inject a non-executing LocalProcessPort before implementing Node process execution

## Status

Accepted for M3-R3-P1 implementation; merge remains separately controlled.

## Context

M3-R3-R0 produced a governed, deterministic Invocation Plan but deliberately authorized no execution. Directly importing a host process primitive in the next slice would collapse admission, launch intent and operating-system execution into one untestable trust boundary.

## Decision

Introduce an injected LocalProcessPort whose only P1 operation is accepting a frozen Launch Specification and returning a deterministic non-executing receipt. The Launch Specification fixes `k6`, preserves the accepted argv array, uses `shell=false`, carries only approved environment variable names, represents the working directory with a logical identifier and declares bounded streams without collecting them.

The port descriptor, Launch Specification, Launch Decision and Boundary Evidence are closed Draft 2020-12 contracts with canonical SHA-256 identities. Any missing port, invalid receipt, digest mismatch or execution claim fails closed.

## Consequences

P1 can test delegation and contract integrity without importing a Node process API or invoking k6. A real Node process adapter, PID, timeout, signal and cancellation lifecycle remain deferred.

```text
nodeProcessAdapterImplemented=false
processStarted=false
processIdCreated=false
k6Invoked=false
externalProcessExecuted=false
nextRequiredSlice=M3-R3-P2
```
