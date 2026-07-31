# M3-R2 — Governed Deterministic k6 API Source Generation

## R0 accepted baseline

M3-R2 starts from the exact accepted main:

```text
main@ab93321738222c087e6f3c90fd39e092116cf3c8
M3-R1 merge PR=#44
M3-R1 exact-main run=30600867230
M3-R1 exact-main artifact=8781826637
M3-R1 exact-main artifact digest=sha256:689773070e76bcd3cc29e815c9ed27249bd856b0f09a93a0e6a6d6ecee7a1bae
```

PR #45 remains a closed, Draft, unmerged read-only observer. No open PR, M3-R2 branch, M3-R2 issue or competing implementation existed when R0 was created.

A Codex review arrived on PR #44 after the merge. R0 treats its three P2 findings as predecessor-contract blockers and closes them before any source-generation contract or generator is introduced:

1. ordinary named JavaScript function declarations are rejected as executable material;
2. compilation evidence integrity detects changes to `decision` or any `safetyBoundary` claim while preserving the formally accepted M3-R1 digest for the canonical safe claims;
3. `K6ApiAssertion` is a closed discriminated union compatible with every valid compiler-emitted assertion.

## R0 scope

R0 freezes the M3-R2 boundary and threat model only. It does not add the source-generation request schemas, the source generator, a static generated-source parser, source artifacts, a runtime, or an executor.

```text
sourceGenerationScopeFrozen=true
runtimeBoundaryDefined=true
threatModelAccepted=true
sourceGenerationStarted=false
sourceGenerated=false
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
```

## Trust boundaries

### M3-R1 Compiler

The compiler accepts governed execution contracts and a FROZEN Test Plan, then produces neutral `K6ApiExecutionSpec` IR. It does not produce JavaScript.

### M3-R2 Source Contract

P1 accepts only the exact validated M3-R1 Spec, Bundle and Compilation Evidence. It defines a fixed rendering policy, a fixed contract-only generator descriptor and a digest-bound source-generation request. P1 does not contain a renderer and never creates source bytes.

### M3-R2 Source Generator

A later M3-R2 P2 phase may accept only a validated M3-R1 Spec plus the P1 source-generation request. It may render a fixed UTF-8 JavaScript artifact entirely in memory. It must not execute, parse by execution, import, persist to a caller-selected path, or transmit the output.

### M3-R3 Runtime

Runtime loading, k6 invocation, target-network access, Secret resolution, execution lifecycle and result collection remain outside M3-R2. M3-R2 may define a future artifact interface but must not implement or authorize the consumer.

## P1 versioned contracts

P1 pins three domain contracts and one validation evidence schema:

```text
k6-api-source-rendering-policy/v1
k6-api-source-generator-descriptor/v1
k6-api-source-generation-request/v1
m3-r2-source-generation-p1-evidence/v1
```

The Rendering Policy fixes:

- UTF-8 without BOM;
- LF line endings;
- two-space indentation;
- single-quote rendering;
- one trailing newline;
- lexicographic object-key and module ordering;
- semantic group, operation, assertion and threshold ordering;
- explicit unordered-set fields;
- deterministic variable-name derivation;
- metadata fields excluded from Source identity.

The Generator Descriptor is permanently `CONTRACT_ONLY` in P1. Its module allow-list is exactly `k6` and `k6/http`. Its resource limits are fixed and digest-bound. Caller-supplied modules, policies, limits or implementation status are rejected.

The Source Generation Request binds:

```text
generatorId
generatorVersion
generatorConfigurationDigest
generatorDescriptorDigest
compilerVersion
inputContractDigest
specId
specDigest
bundleId
bundleDigest
compilationEvidenceId
compilationEvidenceDigest
projectId
environmentDigest
testPlanDigest
knowledgeSnapshotDigest
capabilityDigest
artifactManifestDigest
sourceIntentIds
sourceFormatVersion
canonicalRenderingPolicyDigest
allowedModulesDigest
```

`requestedAt` and `requestedBy` remain request metadata. They may change the request envelope digest but never the Source identity digest.

## Allowed future source inputs

Only fields already present in validated, digest-bound IR may influence generated source:

- operation identity, fixed HTTP method and path template;
- deterministic request-group and dependency order;
- immutable request-body Artifact references;
- declarative query-parameter metadata;
- discriminated assertions;
- declarative thresholds;
- explicitly authorized capability and module allow-lists;
- immutable project, environment, plan, snapshot, request, adapter, compiler and generator bindings.

All source values must pass type, length, count, Unicode, placeholder, sensitive-material and executable-material gates before rendering.

## Permanently rejected inputs

M3-R2 must reject JavaScript snippets, callbacks, expressions, templates, mutable URLs, HTTP/HTTPS targets, absolute paths, `file://`, shell or runtime arguments, module wildcards, dynamic import, `require`, `eval`, `Function`, VM APIs, process APIs, environment access, credentials, Authorization, Cookie, Secret material and unknown fields.

## Canonical rendering policy

The canonical policy is now versioned and digest-bound by P1:

- UTF-8 without BOM;
- LF line endings;
- fixed two-space indentation;
- fixed trailing-newline policy;
- fixed quote and escaping policy;
- lexicographic object-key and module ordering;
- semantic ordering for groups, operations, assertions and thresholds;
- explicit sorting only for fields defined as unordered sets;
- fixed variable-name derivation from immutable IDs;
- no timestamps, host paths, PR numbers, Run IDs or machine attributes in source identity.

The same identity inputs must produce byte-for-byte identical source once P2 exists. Any semantic input change must change the future source digest.

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

## Stage order

1. R0 — baseline, predecessor review closure, scope freeze and threat model;
2. P1 — versioned source-generation contracts and schemas;
3. P2 — pure in-memory deterministic renderer;
4. P3 — independent static safety validator;
5. P4 — source artifact bundle, manifest, provenance and evidence;
6. P5 — determinism, binding, injection, sensitive-material, non-execution and compatibility acceptance;
7. G1 — formal acceptance and exact-Head evidence;
8. G2/G3 — only after separate exact authorization, Ready, normal Merge Commit and exact-main verification.

`nextRequiredSlice=M3-R2-P2` is a sequencing statement only. It does not authorize P2 and never authorizes M3-R3.
