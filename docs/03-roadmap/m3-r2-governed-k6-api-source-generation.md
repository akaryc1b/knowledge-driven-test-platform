# M3-R2 — Governed Deterministic k6 API Source Generation

## Accepted baseline

M3-R2 remains based on the exact accepted M3-R1 main:

```text
main@ab93321738222c087e6f3c90fd39e092116cf3c8
M3-R1 merge PR=#44
M3-R1 exact-main run=30600867230
M3-R1 exact-main artifact=8781826637
M3-R1 exact-main artifact digest=sha256:689773070e76bcd3cc29e815c9ed27249bd856b0f09a93a0e6a6d6ecee7a1bae
```

The accepted P5 predecessor is:

```text
acceptedP5Head=33c90625b9c689387272eef58c14a0742ed7b17f
acceptedP5Run=30801984826
acceptedP5Artifact=8851181456
acceptedP5ArtifactDigest=sha256:9cb02722b682952da573f1f6754692589107ee985da14ccbcf441c96fe28b1c2
acceptedP5PostgresArtifact=8851168200
acceptedP5PostgresArtifactDigest=sha256:624d8b2a8af36ae73ad7c958b6d47b03bf9baf40f2fdb639beb866073b6b3bf1
```

## Delivered slices

### R0 — boundary and predecessor closure

R0 froze the Source Generation boundary, accepted the Threat Model and closed the three post-merge M3-R1 Review findings before Source contracts were introduced.

### P1 — versioned contracts

P1 added the fixed Rendering Policy, `CONTRACT_ONLY` Generator Descriptor, digest-bound Source Generation Request, strict Draft 2020-12 Schemas and additive Schema Catalog.

### P2 — deterministic in-memory renderer

P2 added a pure in-memory renderer. The same immutable inputs produce the same UTF-8, BOM-free, LF-only Source bytes, identity and digest. Rendering never imports or executes the Source.

### P3 — independent static validation and Source Artifact

P3 added an implementation-independent static Validator, validation evidence and an immutable `IN_MEMORY_ONLY` Source Artifact bound to the accepted P2 identity.

### P4 — governed local publication

P4 added a content-addressed Source Bundle, fixed Manifest, complete Provenance, local filesystem Store, Receipt and Publication Evidence. `artifactPublished=true` means only accepted local content-addressed publication; `remoteArtifactPublished=false` remains fixed.

### P5 — independent adversarial acceptance

P5 independently accepted determinism, complete cross-binding, fully rehashed forgery rejection, executable/path injection rejection, sensitive-material exclusion, non-execution, compatibility, persistence fault handling and concurrent publication. The fixed product identities remain:

```text
sourceIdentity=d2d75729802aa6a21d3f2deec9ba85bf31e35358e94b643004326067a0450f73
sourceDigest=ffe417669eb4f242b9ab9d5df968fab80c90aacc52c45b7d11c3fe3e258c88d9
sourceByteLength=5895
sourceLineCount=144
bundleDigest=be37017095bfe927615a4487d0cb1f5775f4abd8bfb0070d40e32e8ecd49ae0f
manifestDigest=fce734d0244118919e1927b17041200228b0010aa667b4d041c9bc4979860c36
p5EvidenceDigest=2f78fdb321174e93959880d4a8cfcea4e8c215558f3103163d31260ad1dff4eb
```

## G1 final scope and evidence audit

G1 adds no product capability. It verifies and closes:

1. exact main, merge base, ahead/behind, PR state, Reviews and competing-work status;
2. the complete 133-file P1–P5 diff inventory and absence of Runtime, Worker, Queue, Scheduler or remote publication implementation;
3. permanent CI and Artifact binding to the exact accepted P5 Head;
4. the authoritative P5 Artifact digest. GitHub API, upload logs and the downloaded ZIP all identify `sha256:9cb02722b682952da573f1f6754692589107ee985da14ccbcf441c96fe28b1c2`; the previously written `b04261ad...ff9b` value is invalid and must not be reused;
5. default Repository Validator continuity. Root `npm run validate` must execute P5 after P4 and before M2 final closure;
6. top-level handoff, roadmap and release documents must describe the accepted R0/P1–P5 state instead of the obsolete P1-only state;
7. Artifact portability. The P5 ZIP contains both case-distinct documentation entries. Verification must operate on ZIP entries and their digests; an extraction on a case-insensitive filesystem is not an authoritative representation.

## Permanent safety boundary

```text
sourceGenerationAcceptanceComplete=true
sourceGenerationContractReady=true
deterministicSourceRendererReady=true
independentStaticValidatorReady=true
sourceArtifactContractReady=true
sourceBundleContractReady=true
sourceGenerated=true
sourceStaticallyValidated=true
sourceArtifactCreated=true
sourcePersisted=true
artifactPublished=true
remoteArtifactPublished=false
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
xk6Invoked=false
playwrightInvoked=false
externalProcessExecuted=false
nodeVmUsed=false
evalUsed=false
dynamicImportUsed=false
targetNetworkAccessed=false
databaseAccessed=false
secretAccessed=false
filesystemCredentialAccessed=false
temporaryExecutionDirectoryCreated=false
containerStarted=false
kubernetesResourceCreated=false
workerAdded=false
queueAdded=false
schedulerAdded=false
runtimeResultCollected=false
allureImplemented=false
repositoryBlockers=[]
```

## Stage order

1. R0 — baseline, predecessor Review closure, scope freeze and Threat Model;
2. P1 — versioned Source Generation contracts and Schemas;
3. P2 — pure in-memory deterministic renderer;
4. P3 — independent static safety Validator and Source Artifact;
5. P4 — content-addressed local Bundle publication;
6. P5 — independent adversarial acceptance;
7. G1 — final baseline, complete scope, permanent validation and Evidence audit;
8. G2 — only after a separate instruction bound to the then-current exact PR Head;
9. later merge and exact-main verification stages remain separately controlled.

After successful exact-Head G1 evidence:

```text
nextRequiredSlice=M3-R2-G2
readyMarked=false
merged=false
m3R3Started=false
```

G1 does not authorize Ready, merge, remote publication or M3-R3 Runtime. Only a later explicitly authorized normal Merge Commit is permitted; squash, rebase, auto-merge, force-push and history rewriting remain prohibited.
