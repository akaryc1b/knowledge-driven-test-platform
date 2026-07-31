# M3-R2 Source Generation Threat Model

## Security objective

M3-R2 may eventually create JavaScript bytes, but it must never turn those bytes into an execution capability. The security objective is to prove that generated source is deterministic, derived only from governed IR, statically safe, free of sensitive material and packaged as an immutable artifact without execution.

## Assets

- accepted M3-R0 execution contracts;
- accepted M3-R1 Spec, Bundle and Compilation Evidence;
- immutable project, environment, plan, snapshot, request and adapter bindings;
- future source-generation request, source bytes, manifest, provenance and evidence;
- canonical rendering and safety rule catalogs.

## Trust boundaries

1. **Untrusted caller to M3-R1** — existing validation rejects mutable, sensitive and executable input.
2. **Validated M3-R1 IR to M3-R2 Generator** — only versioned, digest-bound fields cross this boundary.
3. **Generator to Static Validator** — source is treated as untrusted bytes even when produced internally.
4. **Static Validator to Artifact Packager** — only a source/report pair with exact digest binding may be packaged.
5. **M3-R2 Artifact to future Runtime** — M3-R2 stops at the immutable artifact. Consumption is not implemented or authorized.

## Why source generation is not Runtime

Rendering a byte string is a data transformation. Runtime begins when any component parses for execution, imports, evaluates, invokes k6, resolves runtime credentials, reaches a target, creates execution infrastructure or collects runtime results. M3-R2 forbids every such transition.

## Threats and controls

### T1 — Code injection through IR values

Attackers may place quotes, newlines, comments, template delimiters, Unicode separators, function declarations or expression fragments into fields that later enter source.

Controls:

- no caller-provided source or expression fields;
- strict JSON-only input with plain-object/prototype checks;
- per-field grammar and length limits;
- deterministic JSON/string literal escaping;
- no template interpolation with raw values;
- independent AST/token-based static validation in P3;
- adversarial tests for comments, templates, Unicode, constructor chains and dynamic properties.

### T2 — Template escape

A value may terminate a string, comment or object literal and introduce statements.

Controls:

- structured renderer primitives only;
- one canonical string encoder;
- no concatenation of raw syntax fragments;
- fixed grammar branches selected by enums;
- byte-level golden tests and static forbidden-syntax checks.

### T3 — Prototype pollution and getters

Objects with `__proto__`, constructors, getters or non-plain prototypes may alter traversal or rendering.

Controls:

- plain JSON cloning before use;
- reject unsupported prototypes, accessors and forbidden keys;
- never spread unvalidated caller objects into syntax models;
- use null-prototype internal maps where mapping is required.

### T4 — Non-determinism

Object insertion order, unordered arrays, timestamps, locale, OS line endings, paths or process data may change output.

Controls:

- fixed UTF-8/LF/two-space policy;
- explicit semantic sorting;
- canonical key ordering;
- no current time, randomness, locale-sensitive formatting or machine metadata in identity;
- cross-process and order-perturbation tests;
- independently recomputed source, manifest and catalog digests.

### T5 — Capability escalation

A Source Generation Request may add modules, operations, checks or thresholds not authorized by M3-R1.

Controls:

- exact Spec/Bundle/Evidence digest binding;
- explicit capability and module allow-lists;
- no wildcards;
- generated constructs must have a source IR identifier;
- reject mismatched adapter/generator versions and configuration digest.

### T6 — Hidden network target or credential

Source may embed a URL, host, Authorization, Cookie, token, private key, connection string or local path.

Controls:

- M3-R1 and P1 sensitive-material gates;
- no absolute URL field in generation contract;
- path templates remain relative governed values;
- scan request, source, diagnostics, manifest, provenance, logs and ZIP;
- diagnostics contain rule identifiers and digests, never full source or bodies.

### T7 — Dynamic execution or module loading

Generated source may contain `eval`, `Function`, dynamic import, `require`, WebAssembly, process, VM, filesystem, child process, Worker or unrestricted modules.

Controls:

- fixed import list;
- module allow-list initially limited to exact `k6` and `k6/http`;
- independent static parser validation without AST execution;
- reject aliases and indirect/global access patterns;
- no parser plugins or automatic repair.

### T8 — Generator executes its output

A test or validation step may run source for syntax checking.

Controls:

- no k6 binary or installation;
- no `child_process`, shell, Node VM, dynamic import or eval;
- validation is parser/static-analysis only;
- Workflow scans commands and records all non-execution fields as false;
- no temporary execution directory.

### T9 — Manifest or binding substitution

An attacker may swap source while retaining a valid-looking manifest or bind source to another Spec.

Controls:

- manifest contains source byte length and SHA-256;
- provenance binds accepted M3-R0/M3-R1 evidence and exact M3-R2 Head;
- source, manifest, request and safety report digests are mutually checked;
- all immutable IDs/digests are schema-constrained and independently recomputed.

### T10 — Resource exhaustion

Deep objects, very long strings or excessive operations may exhaust renderer or validator resources.

Controls:

- P1 defines maximum depth, string length, operation count, assertion count and artifact size;
- fail before rendering;
- deterministic bounded diagnostics;
- no recursion over unbounded caller-controlled structures.

### T11 — Artifact publication becomes deployment

Uploading generated source to a Registry or deployment system could implicitly authorize execution.

Controls:

- M3-R2 artifacts exist only as GitHub Actions evidence;
- no npm, container or Registry publication;
- no Deployment changes;
- provenance states `sourcePublished=false` and `sourceExecuted=false`;
- future Runtime requires separate M3-R3 authorization.

## Allowed fields entering future source

Only fixed imports and validated operation method/path, immutable Artifact references, declarative query metadata, discriminated assertions, thresholds and identifiers derived from accepted IR may render. Project/environment/plan/snapshot/request identity may appear only where the source contract explicitly permits non-sensitive provenance constants.

## Fields always rejected

Secret, token, password, Authorization, Cookie, connection string, private key, environment value, absolute path, `file://`, HTTP/HTTPS URL, JavaScript source, callback, expression, shell, command, runtime argument, template placeholder, dynamic module, unknown property and unauthorized capability are always rejected.

## R0 security decision

```text
threatModelAccepted=true
sourceGenerationStarted=false
sourceGenerated=false
sourceExecuted=false
nodeVmUsed=false
evalUsed=false
dynamicImportUsed=false
k6Invoked=false
externalProcessExecuted=false
targetNetworkAccessed=false
databaseAccessed=false
secretAccessed=false
containerStarted=false
kubernetesResourceCreated=false
workerAdded=false
queueAdded=false
schedulerAdded=false
runtimeResultCollected=false
allureImplemented=false
```
