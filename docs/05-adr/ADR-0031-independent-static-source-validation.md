# ADR-0031: Independent Static Source Validation

## Status

Accepted for M3-R2-P3.

## Decision

The P3 validator must not reuse Renderer implementation modules as its acceptance oracle. It independently checks the closed Source Result contract, identity/digest chain, UTF-8 bytes, exact module imports, top-level structure, declarative operation/assertion/threshold shape and forbidden material.

An accepted Source is wrapped in an immutable application-domain Artifact with `persistence=IN_MEMORY_ONLY` and `published=false`. This creates provenance without crossing into P4 storage/publication.

## Consequences

The independent validator deliberately duplicates stable P2 safety constants. Changes require explicit versioning and tamper tests. CI may archive the Artifact as permanent acceptance evidence, but that archive is not a production Artifact repository.

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
