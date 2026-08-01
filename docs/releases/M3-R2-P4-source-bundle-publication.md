# M3-R2-P4 Source Bundle Publication

P4 adds a deterministic content-addressed Source bundle, fixed manifest, complete provenance, local governed filesystem Publisher, immutable publication receipt and digest-bound publication Evidence.

The Publisher persists exactly the accepted P3 Source chain, uses staging plus atomic rename, verifies idempotent existing content and rejects path, symlink, layout, payload, receipt and provenance drift. Public records contain no host path or credential material.

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

This release note does not claim remote publication, Runtime readiness, k6 execution, target access, result collection, Allure, Ready/merge authorization or M3-R3 start. GitHub Actions Artifacts are permanent acceptance evidence only.
