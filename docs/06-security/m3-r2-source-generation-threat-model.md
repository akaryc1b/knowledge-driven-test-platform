# M3-R2 Source Generation Threat Model

## Security objective

M3-R2 may eventually create JavaScript bytes, but it must never turn those bytes into an execution capability. P1 narrows the contract before any renderer exists: only an accepted M3-R1 Spec, Bundle and Compilation Evidence plus one fixed versioned Generator Descriptor may form a Source Generation Request.

## Assets

- accepted M3-R0 execution contracts;
- accepted and hardened M3-R1 Spec, Bundle and Compilation Evidence;
- immutable project, environment, Test Plan, Knowledge Snapshot, request and adapter bindings;
- P1 rendering policy, generator descriptor, request identity and Schema Catalog;
- future source bytes, manifest, provenance and evidence, which are not yet implemented.

## Trust boundaries

1. **Untrusted caller to M3-R1** — existing validation rejects mutable, sensitive and executable input.
2. **Accepted M3-R1 IR to P1 Source Contract** — P1 independently verifies versions, digests, bindings, decision and safety claims.
3. **P1 Source Contract to future P2 Generator** — only the normalized request and fixed descriptor may cross this boundary.
4. **Future Generator to Static Validator** — source remains untrusted bytes even when produced internally.
5. **M3-R2 Artifact to future Runtime** — Runtime remains M3-R3 and is neither implemented nor authorized.

## Why P1 is not Source Generation

P1 constructs JSON contract records only. It does not render JavaScript, write source bytes, parse source, create a source Artifact, load a module or execute output. The descriptor is explicitly `CONTRACT_ONLY`.

## Threats and P1 controls

### T1 — M3-R1 binding substitution

An attacker may combine a valid-looking Spec, Bundle or Evidence from different compiler outputs.

Controls:

- independently recompute all three digests;
- require Bundle to bind the exact Spec ID/digest;
- require Evidence to bind the exact Spec and Bundle;
- require compiler, input contract, Test Plan, Knowledge Snapshot, Environment and capability context to match.

### T2 — Accepted decision or safety claim tampering

A caller may change `decision` or `safetyBoundary` while retaining other identity data.

Controls:

- reuse the hardened M3-R1 Evidence integrity recomputation;
- require the exact accepted compiler decision;
- require every compiler safety-boundary field to be `false`;
- fail closed before constructing a P1 Request.

### T3 — Module or capability escalation

A caller may add `k6/ws`, remote modules, wildcard modules or another source format.

Controls:

- fixed allow-list exactly `k6` and `k6/http`;
- fixed `k6-javascript-esm/v1` source format;
- whole-descriptor canonical comparison;
- configuration and descriptor digests;
- no caller-provided module list or configuration override.

### T4 — Canonical policy drift

Different encoding, line ending, indentation, quoting or ordering could produce different bytes for the same semantic input.

Controls:

- one versioned rendering policy;
- exact whole-object validation;
- policy digest bound into generator configuration and Source identity;
- request rejects any policy mutation;
- P1 performs no rendering.

### T5 — Identity pollution by volatile metadata

Time, PR, Run, Artifact or host metadata could make source identity non-reproducible.

Controls:

- explicit identity exclusion list;
- `requestedAt` and `requestedBy` live only in request metadata;
- future generation time and CI metadata are excluded;
- tests prove metadata changes preserve request ID and Source identity while changing request digest.

### T6 — Executable or sensitive material injection

A caller may place source snippets, callbacks, templates, URLs, absolute paths, credentials, headers or Secret values into request metadata or bindings.

Controls:

- exact-field validation;
- M3-R1 and P1 sensitive, placeholder and executable-material gates;
- no arbitrary source field exists in any P1 schema;
- unknown fields fail closed;
- contract tests include named functions, URLs, paths and `javascriptSource`.

### T7 — Prototype or accessor abuse

Non-plain objects, getters or forbidden keys may affect normalization or hashing.

Controls:

- execution-contract JSON cloning and safety validation before use;
- canonical serialization of normalized records;
- no caller object is used as a template or syntax model;
- exact allowed fields at each P1 envelope.

### T8 — Resource exhaustion

Oversized IR, deep nesting or excessive groups/operations/assertions may exhaust a future renderer.

Controls:

- P1 descriptor freezes serialized-byte, group, operation, assertion, threshold, manifest, string and depth limits;
- bounds are checked before a request is accepted;
- limits cannot be relaxed by callers.

### T9 — Contract status becomes implementation authority

A caller may treat a descriptor as permission to generate or execute source.

Controls:

- `implementationStatus=CONTRACT_ONLY`;
- no `packages/k6-api-source-generator` package;
- no renderer export or source output field;
- P1 evidence records `sourceGenerationStarted=false`;
- P2 and M3-R3 require separate slices and authorization.

### T10 — CI validation accidentally executes source

A Workflow might install or invoke k6, use Node VM/eval, dynamic import or an external process.

Controls:

- read-only permissions;
- no k6/xk6/Playwright installation or invocation;
- no shell-based syntax execution of generated source;
- static repository validator rejects runtime primitives;
- P1 Artifact contains contracts, schemas, tests and evidence only.

## P1 security decision

```text
sourceGenerationContractReady=true
sourceGenerationScopeFrozen=true
runtimeBoundaryDefined=true
sourceGenerationStarted=false
sourceGenerated=false
sourceExecuted=false
executionRuntimeStarted=false
nodeVmUsed=false
evalUsed=false
dynamicImportUsed=false
k6Invoked=false
xk6Invoked=false
playwrightInvoked=false
externalProcessExecuted=false
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
nextRequiredSlice=M3-R2-P2
repositoryBlockers=[]
```

`nextRequiredSlice=M3-R2-P2` is sequencing only. It does not authorize P2 or M3-R3.
