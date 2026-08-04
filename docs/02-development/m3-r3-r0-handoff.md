# M3-R3-R0 Development Handoff

## Baseline

```text
baselineMain=62e1deb6b6f9c8e82188c0fe8e66d83350d6f9cf
acceptedM3R2Pr=48
acceptedM3R2SourceHead=fc81b9184a3f1024eb1ff0d64b5145ede7569aa0
acceptedM3R2MergeSha=62e1deb6b6f9c8e82188c0fe8e66d83350d6f9cf
acceptedM3R2P5Run=30867429404
acceptedM3R2EvidenceArtifact=8876646118
acceptedM3R2EvidenceDigest=sha256:d42f0820b5101c1aa9c8c7e7b887500a9c4b159a2e41258d8e3ec9cfb46fb069
```

M3-R2 is formally closed. Its immutable Source Bundle remains the only accepted input to this slice.

## Delivered contracts

M3-R3-R0 adds four versioned product contracts:

1. `k6-api-runtime-policy/v1` — fixed admission-only policy and resource ceilings;
2. `k6-api-runtime-admission-request/v1` — exact Execution Request, Spec, Compilation Evidence and published Source binding;
3. `k6-api-invocation-plan/v1` — deterministic argv array and immutable Source location plan;
4. `k6-api-runtime-admission-evidence/v1` — digest-bound R0 decision and safety claims.

It also adds `m3-r3-runtime-admission-r0-evidence/v1` for permanent repository acceptance.

## Runtime boundary

The word “runtime” in R0 refers to the **contract boundary**, not process execution. The plan records:

- executable label `k6`;
- subcommand `run`;
- bounded VUs, iterations, duration and graceful stop;
- an argv array rather than a shell command;
- a relative immutable Source path;
- allow-listed environment variable names only;
- no environment values or Secret material;
- `executionAuthorized=false`.

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

## Validation expectations

The R0 Repository Validator must verify:

- the accepted M3-R2 exact-main SHA, Run and Artifact bindings;
- deterministic reconstruction of Policy, Admission Request, Invocation Plan and Evidence;
- closed Draft 2020-12 Schemas and an additive Schema Catalog;
- resource and allow-list ceilings;
- absence of process, shell, network and dynamic execution primitives;
- permanent PR and `push -> main` Workflow coverage;
- documentation and release evidence consistency.

## Next slice control

P1 may introduce a local process adapter only behind a separately reviewed process port and only after R0 is formally merged and accepted. This handoff does not authorize P1.

```text
runtimeAdmissionContractReady=true
invocationPlanReady=true
executionImplementationStarted=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-P1
p1Authorized=false
readyTransitionAuthorized=false
mergeTransitionAuthorized=false
```
