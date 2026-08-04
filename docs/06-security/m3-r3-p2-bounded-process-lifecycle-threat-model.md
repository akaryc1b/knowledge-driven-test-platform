# M3-R3-P2 Bounded Process Lifecycle Threat Model

## Assets

- accepted P1 Launch Specification and predecessor digests;
- immutable Source Bundle identity and trusted materialized root;
- process lifecycle state and cancellation authority;
- host PID, environment and filesystem privacy;
- permanent CI evidence that must remain non-executing.

## Threats and controls

### Shell and executable substitution

The command fixes `k6`, validates the exact argv grammar and uses `shell=false`. `exec`, `execFile`, `fork`, synchronous process APIs and command strings are forbidden by repository validation.

### Direct adapter bypass

The executable function is stored in a private `WeakMap`. A copied descriptor or look-alike object is rejected. The governed entry revalidates the full P1 binding before execution.

### Unbounded startup or termination

Spawn acknowledgement, execution duration, cooperative grace and force settlement each have explicit bounds. Missing acknowledgement triggers a forced termination request and an explicit confirmed or unconfirmed terminal state.

### Environment and filesystem injection

The command contains environment names and a digest only. The adapter creates a fresh fixed environment object and never reads `process.env`. The Source Bundle resolver must return a normalized absolute real directory and cannot create a temporary execution directory.

### PID, output and error leakage

The numeric PID remains private. Stdio is ignored. Evidence and errors omit exit output, raw error messages, causes, stack traces, host paths and environment values.

### CI accidentally executing k6

All lifecycle tests inject fake spawn, clocks, filesystem probes and abort signals. The permanent Workflow contains no k6/xk6/Playwright invocation and emits static acceptance Evidence.

```text
nodeProcessAdapterImplemented=true
boundedLifecycleImplemented=true
realProcessStartedInCi=false
processIdCreatedInCi=false
signalSentInCi=false
k6InvokedInCi=false
externalProcessExecutedInCi=false
runtimeResultCollected=false
nextRequiredSlice=M3-R3-P3
```
