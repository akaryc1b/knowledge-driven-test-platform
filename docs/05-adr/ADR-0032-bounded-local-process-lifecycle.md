# ADR-0032: Bounded Local Process Lifecycle Behind a Private Node Adapter

## Status

Accepted for M3-R3-P2 implementation evidence.

## Decision

Use one dedicated Node module whose only process primitive is `node:child_process.spawn`. The module exports contracts and a factory, but stores the executable function in a private `WeakMap`. The public governed entry validates the complete P1 predecessor chain and exact P2 command before retrieving the private executor.

The adapter uses `shell=false`, `detached=false`, ignored stdio, no host environment, and a trusted resolver for an already materialized immutable Source Bundle directory. It uses adapter-owned fixed values only for P1-approved environment names.

Use an explicit bounded lifecycle: pre-start abort; startup acknowledgement timeout; execution timeout; cooperative `SIGINT`; bounded grace; `SIGKILL`; final force-settlement bound. Public Evidence records boolean PID creation and lifecycle events, never the numeric PID, output or raw error details.

## Consequences

The repository now contains a real process adapter, but permanent CI remains non-executing through injected fake spawn and timer implementations. Result collection remains absent and belongs to M3-R3-P3.

```text
nodeProcessAdapterImplemented=true
boundedLifecycleImplemented=true
realProcessStartedInCi=false
runtimeResultCollected=false
nextRequiredSlice=M3-R3-P3
```
