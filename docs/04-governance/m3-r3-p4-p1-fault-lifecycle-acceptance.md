# M3-R3-P4-P1 Deterministic Fault and Lifecycle-Race Acceptance

## Scope

P1 accepts the existing M3-R3 bounded local process lifecycle with injected fakes only. It adds no process primitive, output source, writable path, remote executor or runtime capability.

```text
p4Issue=67
p4Pr=68
p4BaseMain=8684836233837c905e0ced20e8eac2cfd0b43601
p1ProductCapabilityAdded=false
realProcessStartedInCi=false
processIdCreatedInCi=false
signalSentInCi=false
externalProcessExecutedInCi=false
rawRuntimeOutputCollected=false
numericProcessIdExposed=false
```

## Injected deterministic boundary

The P1 suite uses:

- `FakeChildProcess` for spawn acknowledgement, child error, exit, close and kill behavior;
- `FakeAbortSignal` for pre-resolution, pre-spawn and post-spawn cancellation;
- `createFakeClock` plus `createManualTimers` for deterministic startup, timeout, cooperative-grace and force-settle ordering;
- a fake resolver, fake realpath and fake stat boundary;
- static predecessor fixtures produced from the accepted R0-P3 contracts.

The fake clock is consumed by the injected timer implementation. Production code receives only the already accepted `setTimer` and `clearTimer` adapter functions; no new public clock parameter or runtime behavior is introduced.

## Accepted fault groups

1. synchronous spawn throw and invalid returned handle;
2. child `error` before and after spawn acknowledgement;
3. missing spawn acknowledgement with confirmed and unconfirmed forced termination;
4. spawn/startup-timeout ordering and stale startup timer behavior;
5. cancellation before resolver, after resolver and after spawn;
6. timeout with cooperative exit, forced escalation and kill failure;
7. timeout/abort precedence in both event orders;
8. duplicate or contradictory terminal events and stale callbacks after settlement;
9. resolver throw, relative path, symlink, non-directory, realpath failure and stat failure;
10. out-of-range exit code, unknown signal and missing observed-exit metadata;
11. deeply immutable public results with no raw output, numeric PID or private error detail;
12. byte-identical fail-closed classification for repeated static inputs.

## Invariants

```text
singleSpawnInvariant=true
singleSettlementInvariant=true
boundedStartup=true
boundedTimeout=true
boundedCooperativeCancellation=true
boundedForcedTermination=true
unconfirmedTerminationFailsClosed=true
allPublicObjectsImmutable=true
allFailureClassificationsDeterministic=true
rawRuntimeOutputCollected=false
stdoutCollected=false
stderrCollected=false
numericProcessIdExposed=false
```

## Independent audit boundary

The suite exercises the dedicated Node adapter through its public execution functions. It does not import or invoke the module-private executor, launch a real process, inspect stdout/stderr, use a real timer, send a real signal or access a target network, database, Secret, container or Kubernetes resource.

The test result count is intentionally not recorded in this implementation document. Permanent P4 Evidence must parse real TAP output from the exact accepted Head.

## Slice gate

P2 may begin only after this P1 implementation commit receives successful natural Pull Request checks and any real finding is closed through a new commit. P1 does not authorize Ready, merge or M3-R3-G1.
