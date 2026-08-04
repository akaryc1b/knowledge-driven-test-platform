# M3-R3-P2 Bounded Process Lifecycle Roadmap

## Goal

M3-R3-P2 converts the accepted P1 Launch Specification into a bounded local process lifecycle without widening the executable, argv, environment, filesystem or output boundaries.

## Contract flow

```text
accepted M3-R3-P1 boundary Evidence
  + k6-node-process-adapter/v1
  -> k6-process-execution-command/v1
  -> trusted immutable Source Bundle resolver
  -> module-private Node spawn adapter
  -> bounded start / timeout / cancellation state machine
  -> k6-process-lifecycle-evidence/v1
```

The public command carries only immutable digests and logical Source Bundle identity. The absolute host working directory and fixed environment values are supplied only at the adapter edge and are not serialized. The numeric PID remains private; Evidence records only whether a PID was created.

## Lifecycle states

P2 handles pre-start cancellation, start failure, start acknowledgement timeout, normal exit, post-start process error, execution timeout, cooperative cancellation, forced termination and unconfirmed forced settlement. Startup and force settlement each have independent fixed bounds.

## Completion boundary

```text
nodeProcessAdapterImplemented=true
boundedLifecycleImplemented=true
timeoutImplemented=true
cooperativeCancellationImplemented=true
realProcessStartedInCi=false
runtimeResultCollected=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-P3
```

P2 does not collect stdout, stderr, exit-code result payloads, k6 summary output or Allure data. M3-R3-P3 is a separate future slice.
