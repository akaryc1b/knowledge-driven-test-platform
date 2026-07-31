# M3-R2-P3 — Independent Source Validation and In-Memory Artifact Contract

## Goal

Validate generated k6 JavaScript Source without calling the Renderer implementation as an oracle, then bind the accepted bytes and provenance into a closed immutable in-memory Artifact.

## Scope

- independently recompute Source Result, Source identity, raw UTF-8 digest, bytes and LF count;
- enforce exact imports, top-level structure, operation/assertion/threshold counts and path-only targets;
- reject execution primitives, volatile metadata, Secrets, credential URIs and absolute paths;
- create strict Draft 2020-12 Artifact and validation Evidence contracts;
- preserve P2 digest bindings and the non-execution boundary.

## Exclusions

P3 does not persist or publish Source, execute Source, create a Runtime, invoke k6, or start M3-R3. Persistent bundles and publication belong to P4.

```text
independentStaticValidatorReady=true
sourceArtifactContractReady=true
sourceGenerated=true
sourceStaticallyValidated=true
sourceArtifactCreated=true
sourcePersisted=false
artifactPublished=false
sourceExecuted=false
executionRuntimeStarted=false
nextRequiredSlice=M3-R2-P4
repositoryBlockers=[]
```

`M3-R3` remains out of scope. No k6/xk6/Playwright invocation, external process, VM/eval/dynamic import, target network, database business access, Secret access, temporary execution directory, container/Kubernetes execution resource, Worker, Queue, Scheduler, Runtime Result or Allure is introduced.
