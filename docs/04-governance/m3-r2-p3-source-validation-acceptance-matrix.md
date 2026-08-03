# M3-R2-P3 Acceptance Matrix

| Gate | Permanent requirement |
|---|---|
| Predecessor | Exact accepted P2 Head, Run, Artifact and Evidence digest |
| Independence | Validator does not import Renderer implementation modules |
| Integrity | Source identity, Result digest, raw UTF-8 digest, byte and LF counts recompute |
| Static safety | Exact imports/structure and 12 fixed checks pass; unsafe primitives fail closed |
| Artifact | Closed immutable `IN_MEMORY_ONLY`, `published=false` Artifact with full provenance |
| Evidence | Artifact, validation report, P2 Evidence and decision are digest-bound |
| Regression | Focused P3, all adapter, full Node, repository and PostgreSQL tests pass |
| Merge | PR remains Draft; P3 does not authorize Ready or merge |

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
