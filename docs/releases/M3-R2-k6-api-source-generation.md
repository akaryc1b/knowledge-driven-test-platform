# M3-R2 Governed k6 API Source Generation

## Current release state

Only R0 is delivered by this change. R0 revalidates the exact M3-R1 main baseline, closes three post-merge P2 review findings, freezes the source-generation boundary and records the threat model.

## R0 delivery

- exact `main@ab93321738222c087e6f3c90fd39e092116cf3c8` rebaseline;
- PR #44/#45, workflows and Artifact continuity verification;
- named-function executable-material hardening;
- integrity binding for Compilation Evidence decision and safety claims;
- discriminated `K6ApiAssertion` Schema;
- R0 roadmap, acceptance matrix, ADR and threat model;
- permanent read-only R0 Workflow and evidence.

## Explicitly not delivered

- no Source Generation Request or source artifact schema;
- no generator or renderer;
- no generated JavaScript;
- no static generated-source parser;
- no source bundle, manifest or provenance;
- no k6/xk6/Playwright invocation;
- no external process, VM, network, database or Secret access;
- no Worker, Queue, Scheduler, container or Kubernetes execution resource;
- no npm, image or Registry publication;
- no M3-R3 Runtime.

## R0 decision

```text
sourceGenerationScopeFrozen=true
runtimeBoundaryDefined=true
threatModelAccepted=true
sourceGenerationStarted=false
sourceGenerated=false
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
externalProcessExecuted=false
targetNetworkAccessed=false
secretAccessed=false
nextRequiredSlice=M3-R2-P1
repositoryBlockers=[]
```

The Draft PR and R0 evidence do not authorize Ready, merge, P1 or M3-R3.
