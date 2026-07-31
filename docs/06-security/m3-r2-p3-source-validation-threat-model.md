# M3-R2-P3 Threat Model

## Assets

- exact generated Source UTF-8 bytes;
- Source identity and Result digest;
- P2 Evidence and immutable compiler/rendering bindings;
- validation report, Source Artifact and P3 Evidence digests.

## Threats and controls

- **Renderer/validator common-mode failure:** independent validator does not import Renderer modules.
- **Digest substitution:** identity, Result, raw Source, Artifact, report and Evidence digests are independently recomputed.
- **hidden executable material:** dynamic import, require, eval, Function, async/generator/class, VM/process/runtime, fetch/network and timer primitives fail closed.
- **target/credential injection:** only path templates are accepted; URLs, credential URIs, Secrets and absolute paths fail closed.
- **persistence or publication escalation:** contract fixes `IN_MEMORY_ONLY`, `published=false`; workflow has read-only permissions.
- **boundary drift:** 12 fixed check IDs, strict Draft 2020-12 schemas, tamper tests and repository Validator are permanent gates.

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
