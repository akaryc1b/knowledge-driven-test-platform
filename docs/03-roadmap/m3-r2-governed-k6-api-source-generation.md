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
2. compilation evidence integrity binds `decision` and every `safetyBoundary` claim while excluding non-identity metadata;
3. `K6ApiAssertion` is a closed discriminated union.

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
```

## Trust boundaries

### M3-R1 Compiler

The compiler accepts governed execution contracts and a FROZEN Test Plan, then produces neutral `K6ApiExecutionSpec` IR. It does not produce JavaScript.

### M3-R2 Source Generator

A later M3-R2 phase may accept only a validated M3-R1 Spec plus a versioned source-generation request. It may render a fixed UTF-8 JavaScript artifact entirely in memory. It must not execute, parse by execution, import, persist to a caller-selected path, or transmit the output.

### M3-R3 Runtime

Runtime loading, k6 invocation, target-network access, Secret resolution, execution lifecycle and result collection remain outside M3-R2. M3-R2 may define a future artifact interface but must not implement or authorize the consumer.

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

A later generator must define one canonical policy:

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

The same identity inputs must produce byte-for-byte identical source. Any semantic input change must change the source digest.

## Stage order

1. R0 — baseline, predecessor review closure, scope freeze and threat model;
2. P1 — versioned source-generation contracts and schemas;
3. P2 — pure in-memory deterministic renderer;
4. P3 — independent static safety validator;
5. P4 — source artifact bundle, manifest, provenance and evidence;
6. P5 — determinism, binding, injection, sensitive-material, non-execution and compatibility acceptance;
7. G1 — formal acceptance and exact-Head evidence;
8. G2/G3 — only after separate exact authorization, Ready, normal Merge Commit and exact-main verification.

`nextRequiredSlice=M3-R2-P1` is a sequencing statement only. It does not authorize P1 in R0 and never authorizes M3-R3.
