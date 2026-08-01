# M3-R2-P4 Handoff

## Accepted predecessor

P4 is based on the permanently accepted P3 Head `d8f900bd7f3555335c0b603ce6b61d9c44824889`, Dedicated Run `30691711832`, Artifact `8815888882`, P3 Evidence digest `b013a5a14ad88a4b3fa97f1574dfe3006d0047776b95b7770a8c88a1aeb7e490`, Source Artifact digest `56d121390b08aee343c3ad49fd63d5d36c9d067a56ccbebba66fa65115588d13` and validation Evidence digest `a7324d928ca56c48428d67cb8329adc532c65f461f98dbbc61969341030f70bd`.

## Delivered boundary

P4 requires an independent accepted-P3 digest anchor, creates a deterministic five-payload Source publication bundle, fixed manifest and complete P3 provenance, then publishes exactly eight files into a server-owned content-addressed filesystem directory using staging plus atomic rename. The receipt exposes only `kdtp-source-bundle://sha256/<bundleDigest>` and never exposes the host path.

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

`artifactPublished=true` means the governed local Artifact Store accepted the immutable bundle. It does not mean a registry, object store, release service or target environment was contacted. GitHub Actions Artifacts remain acceptance evidence, not the product publication backend.

M3-R3 remains out of scope. No k6/xk6/Playwright invocation, target network, database business access, Secret access, external process, container/Kubernetes execution resource, Worker, Queue, Scheduler, Runtime Result or Allure is introduced.

P5 must independently exercise determinism, binding, injection, sensitive-material, non-execution and compatibility acceptance. PR #46 remains Draft until a later explicit merge gate.
