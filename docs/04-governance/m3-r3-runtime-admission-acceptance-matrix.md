# M3-R3-R0 Runtime Admission Acceptance Matrix

| Gate | Required evidence | Acceptance rule |
|---|---|---|
| Accepted predecessor | M3-R2 exact main, P5 Run and Artifacts | SHA, Run, Artifact and product digests must match the frozen R0 baseline |
| Runtime Policy | `k6-api-runtime-policy/v1` | Fixed `ADMISSION_ONLY`, shell disabled and bounded resource ceilings |
| Execution binding | Admission Request | Execution Request digest must match Compilation Evidence and Spec context |
| Source binding | Bundle, Receipt and Publication Evidence | Bundle, Manifest, Source, Receipt and Evidence digests must match |
| Determinism | repeated Policy, Admission, Plan and Evidence construction | Canonical JSON and SHA-256 identities must be byte-stable |
| Resource governance | VUs, iterations, duration, graceful stop | Requests outside the fixed ceiling fail closed |
| Environment governance | environment variable names | Only `K6_LOG_FORMAT` and `K6_NO_COLOR`; no values are stored |
| Invocation safety | argv plan | Array only; no shell string or metacharacters; relative Source path only |
| Schema closure | five Draft 2020-12 Schemas | Every object is closed and every property is required |
| Non-execution | decision and safety boundary | Every runtime/process/network/Secret/result claim remains false |
| Repository wiring | root Validator and dedicated Workflow | R0 is included after M3-R2-P5 and before M2 final closure |
| Permanent evidence | exact-Head Workflow Artifact | Tests, Schemas, docs and Evidence JSON are retained for 90 days |

## Required negative tests

- changed Execution Request digest;
- changed project or Spec identity;
- changed Publication Receipt or Source Bundle;
- resource limit expansion;
- non-canonical millisecond duration;
- unapproved environment variable name;
- unapproved output kind;
- argv shell fragment with a recomputed digest;
- changed Evidence decision or safety claim;
- deleted main-push Workflow trigger;
- process, shell, network or dynamic execution primitive added to R0.

## Decision

```text
runtimeAdmissionContractReady=true
invocationPlanReady=true
executionImplementationStarted=false
sourceExecuted=false
k6Invoked=false
externalProcessExecuted=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-P1
```

M3-R3-R0 does not authorize process execution, target access, Secret resolution or result collection.

```text
executionRuntimeStarted=false
xk6Invoked=false
playwrightInvoked=false
shellUsed=false
targetNetworkAccessed=false
databaseAccessed=false
secretAccessed=false
runtimeResultCollected=false
```
