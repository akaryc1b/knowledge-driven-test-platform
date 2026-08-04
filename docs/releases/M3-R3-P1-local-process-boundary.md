# M3-R3-P1 Release Note: Injected Local Process Boundary Foundation

M3-R3-P1 adds a deterministic, dependency-injected and fail-closed local process boundary without adding a process implementation.

Delivered:

- fixed `k6-local-process-port/v1` descriptor;
- digest-bound `k6-process-launch-specification/v1`;
- non-executing port receipt and `k6-process-launch-decision/v1`;
- deterministic `k6-process-boundary-evidence/v1`;
- closed Schemas, negative security tests, Repository Validator and permanent Evidence Workflow;
- exact binding to the formally accepted M3-R3-R0 main state.

Not delivered:

- Node process adapter;
- process start, PID, signal, timeout or cancellation;
- k6/xk6/Playwright invocation;
- Target, database or Secret access;
- runtime result collection, Allure, Worker, Queue, Scheduler, container or Kubernetes execution.

```text
localProcessPortContractReady=true
launchSpecificationReady=true
launchAdapterBoundaryReady=true
nodeProcessAdapterImplemented=false
processStarted=false
processIdCreated=false
k6Invoked=false
externalProcessExecuted=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-P2
```

The implementation remains in a Draft PR and is not authorized for merge or P2 continuation.
