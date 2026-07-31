# M3-R2 Governed k6 API Source Generation

## Current release state

M3-R2-R0 and P1 are delivered in the current Draft PR. R0 froze the boundary and closed predecessor Review blockers. P1 publishes versioned Source Generation contracts and schemas only.

## R0 delivery

- exact M3-R1 main rebaseline and Artifact continuity;
- PR #44 post-merge Review closure;
- source-generation boundary, ADR and Threat Model;
- read-only permanent evidence.

## P1 delivery

- fixed `K6ApiSourceRenderingPolicy`;
- fixed `CONTRACT_ONLY` `K6ApiSourceGeneratorDescriptor`;
- digest-bound `K6ApiSourceGenerationRequest`;
- exact M3-R1 Spec/Bundle/Compilation Evidence verification;
- fixed `k6` and `k6/http` module allow-list;
- canonical identity and metadata-exclusion rules;
- bounded resource limits;
- strict Draft 2020-12 schemas and dedicated Schema Catalog;
- focused tests, example, repository Validator and 90-day CI Artifact.

## Explicitly not delivered

- no renderer or generator package;
- no generated JavaScript, source bytes or source text;
- no static generated-source parser;
- no source Artifact bundle, manifest or provenance;
- no k6/xk6/Playwright invocation;
- no external process, VM, eval, dynamic import, network, database or Secret access;
- no Worker, Queue, Scheduler, container or Kubernetes execution resource;
- no Runtime Result or Allure;
- no npm, image or Registry publication;
- no M3-R3 Runtime.

## P1 decision

```text
sourceGenerationContractReady=true
sourceGenerationScopeFrozen=true
runtimeBoundaryDefined=true
sourceGenerationStarted=false
sourceGenerated=false
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
externalProcessExecuted=false
targetNetworkAccessed=false
secretAccessed=false
nextRequiredSlice=M3-R2-P2
repositoryBlockers=[]
```

The Draft PR and P1 evidence do not authorize Ready, merge, P2 or M3-R3. Any later Ready/merge action must bind the then-current exact 40-character PR Head and use a normal Merge Commit.
