# M3-R2-P4 Source Bundle Acceptance Matrix

| Control | Required evidence |
| --- | --- |
| Accepted predecessor | Fixed P3 Evidence raw SHA-256, Artifact receipt Git blob SHA, canonical object digests and an independently supplied accepted-P3 trust anchor |
| Deterministic bundle | Same accepted P3 inputs produce identical bundle and manifest digests |
| Fixed layout | Five payload files and exactly eight stored files |
| Provenance | Source, Source Result, P2, P3, validation, compiler, generator and input bundle digests bound |
| Safe persistence | Absolute server-owned root, no symlink/traversal, exclusive writes, staging and atomic rename |
| Idempotency | Republishing an identical digest returns the first receipt |
| Drift detection | Changed, missing, additional or symbolic-link content is rejected |
| Evidence privacy | Receipt exposes only a logical content-addressed URI, never a host path |
| Remote boundary | No registry, object store or release endpoint access |
| Non-execution | No import, VM/eval, external process or k6 invocation |

Acceptance requires:

```text
sourceBundleContractReady=true
sourceBundleCreated=true
sourceManifestCreated=true
sourceProvenanceBound=true
sourcePersisted=true
artifactPublished=true
remoteArtifactPublished=false
sourceExecuted=false
executionRuntimeStarted=false
nextRequiredSlice=M3-R2-P5
repositoryBlockers=[]
```

`artifactPublished=true` is limited to the local governed Artifact Store. It is not evidence of remote distribution or M3-R3 readiness.
