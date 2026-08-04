# M3-R3-R0 Runtime Admission Release Note

## Release scope

M3-R3-R0 introduces governed admission contracts between the accepted M3-R2 Source Bundle and a future k6 process adapter.

It provides:

- fixed bounded Runtime Policy;
- immutable Execution Request and Source publication binding;
- deterministic shell-free Invocation Plan;
- Admission Evidence and Repository Acceptance Evidence;
- closed Draft 2020-12 Schemas and additive Schema Catalog;
- focused security, binding, determinism and compatibility tests;
- permanent PR and `push -> main` Workflow coverage.

## Accepted predecessor

```text
acceptedMain=62e1deb6b6f9c8e82188c0fe8e66d83350d6f9cf
acceptedM3R2Pr=48
acceptedM3R2P5Run=30867429404
acceptedM3R2EvidenceArtifact=8876646118
sourceIdentity=d2d75729802aa6a21d3f2deec9ba85bf31e35358e94b643004326067a0450f73
sourceDigest=ffe417669eb4f242b9ab9d5df968fab80c90aacc52c45b7d11c3fe3e258c88d9
bundleDigest=be37017095bfe927615a4487d0cb1f5775f4abd8bfb0070d40e32e8ecd49ae0f
manifestDigest=fce734d0244118919e1927b17041200228b0010aa667b4d041c9bc4979860c36
```

## Compatibility

Existing M3-R0, M3-R1 and M3-R2 contracts are unchanged. The new module is exported additively from `@kdtp/k6-api-adapter`. Root validation preserves the predecessor order and anti-regression Workflows remain required.

## Non-execution statement

The Invocation Plan is a validated data object. R0 does not install, resolve or invoke the executable label it contains.

```text
M3-R3-R0
runtimeAdmissionContractReady=true
invocationPlanReady=true
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
repositoryBlockers=[]
nextRequiredSlice=M3-R3-P1
```

M3-R3-P1 requires a separate safe-slice instruction and is not part of this release.
