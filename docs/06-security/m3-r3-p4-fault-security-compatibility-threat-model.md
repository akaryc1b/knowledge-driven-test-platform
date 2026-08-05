# M3-R3-P4 Fault, Security and Compatibility Threat-Model Extension

## Purpose

This document extends the accepted M3-R3 R0/P1/P2/P3 threat models for acceptance only. It does not authorize a new process primitive, output location, file reader, runtime adapter or remote execution capability.

```text
p4BaselineMain=8684836233837c905e0ced20e8eac2cfd0b43601
acceptedP3Main=8684836233837c905e0ced20e8eac2cfd0b43601
newRuntimeCapabilityAdded=false
m3R3G1Started=false
```

## Protected assets

1. exact accepted Runtime Policy, Admission Request, Invocation Plan and Runtime Admission Evidence;
2. exact P1 Local Process Port, Launch Specification, Launch Decision and Boundary Evidence;
3. exact P2 Node Adapter descriptor, Process Execution Command and Lifecycle Evidence;
4. exact P3 Terminal Observation, Sanitized Runtime Outcome and Runtime Execution Evidence;
5. immutable Source Bundle identity, publication receipt and content;
6. Adapter identity stored behind the module-private `WeakMap`;
7. server-owned fixed environment values and fixed signal/executable/argv allow-lists;
8. canonical Evidence and Schema Catalog identities;
9. historical P3 Run, Job, Artifact and digest records;
10. permanent Workflow and Artifact path-preservation rules.

## Trust boundaries

- caller input ends before accepted contracts and bindings are reconstructed;
- the only production process primitive is the dedicated Node adapter's `node:child_process.spawn` import;
- resolver output is untrusted until it is an exact normalized absolute real directory matching the immutable Source Bundle binding;
- child-process events, kill return values and event ordering are untrusted;
- stdout, stderr, raw errors, stack traces, numeric PID and host absolute paths are non-public data and are never accepted result sources;
- GitHub Actions runtime internals are not project Node compatibility evidence;
- security dashboards are external visibility surfaces and cannot be inferred from repository-local checks.

## Threats and required controls

### T1 — Alternative process primitive or shell escape

**Threat:** `exec`, `execFile`, `fork`, sync primitives, shell command strings, `shell=true`, `detached=true`, `node:vm`, `eval`, `Function`, dynamic import or Worker Threads bypass the fixed adapter.

**Controls:** static repository scan; exact descriptor equality; fixed executable; fixed shell/detached/stdio values; module-private adapter registration; no second spawn.

### T2 — argv and executable substitution

**Threat:** shell fragments, command substitution, unknown/repeated flags, output path substitution or executable replacement changes process behavior.

**Controls:** closed fixed argv grammar; exact reconstruction from accepted predecessor contracts; self-digest plus expected-product comparison; no command string.

### T3 — copied Adapter or cross-instance Evidence

**Threat:** a copied descriptor, recomputed digest or Evidence from another command/process instance is accepted.

**Controls:** `WeakMap` identity; exact adapter/command/predecessor digests; lifecycle and terminal products reconstructed against the active command and descriptor; copied/unregistered object rejection.

### T4 — lifecycle race or duplicate terminal event

**Threat:** timeout, abort, error and exit events produce multiple spawn calls, multiple settlements or contradictory public results.

**Controls:** one spawn site; settle-once guard; first cancellation reason; once-only listeners; cleared timers; deterministic fake schedules; repeated race tests.

### T5 — unconfirmed forced termination reported as success

**Threat:** `SIGKILL` request without exit confirmation is treated as terminated.

**Controls:** explicit `*_FORCE_UNCONFIRMED` states; bounded force-settle timer; `processTerminationConfirmed=false`; fail-closed outcome classification.

### T6 — resolver or filesystem escape

**Threat:** relative, traversal, symlink, non-directory, special-file, drive, UNC, URI, NUL, backslash or caller-supplied output paths escape the immutable Source Bundle boundary.

**Controls:** resolver receives only frozen bundle digest/logical name; absolute normalized realpath equality; directory check; no caller output path; Artifact path audit and collision gates.

### T7 — environment or Secret exposure

**Threat:** `process.env`, arbitrary variables, authorization material, tokens, cookies, database/cloud/SSH credentials or raw configuration enter spawn options, public products, logs or Artifact.

**Controls:** no host inheritance; fixed adapter-owned values only; values omitted from contracts; stdio ignored; sanitized errors; credential-shaped scanner over public products and Artifact.

### T8 — stdout/stderr/PID/raw-error leakage

**Threat:** private process details become public through lifecycle, terminal, runtime Evidence, errors or logs.

**Controls:** ignored stdio; no output listeners; boolean PID-existence observation only; generic error codes/messages; closed Schemas; recursive leakage fixtures.

### T9 — digest and Evidence chain forgery

**Threat:** fully self-redigested predecessor substitutions, Run/Job/Artifact replacement, Schema drift, allow-list expansion or decision-field forgery is accepted.

**Controls:** expected-product reconstruction against fixed accepted P3 identities; closed Draft 2020-12 Schema; independent canonical and Catalog digest recomputation; fixed enum/const values; additional-properties rejection.

### T10 — compatibility drift

**Threat:** Node 24-only APIs, removed exports, changed terminal categories, silent Schema replacement or OS overclaim breaks accepted callers.

**Controls:** Node 22 baseline and Node 24 fake-only matrix; exact public export assertions; predecessor Validators; fixed fixtures and cross-version digest equality; Linux-only platform claim.

### T11 — historical evidence rewrite

**Threat:** P4 modifies accepted P3 Evidence or represents later merge state by rewriting a historical Artifact.

**Controls:** P4 uses a new Schema, Catalog and Evidence record; Repository Validator pins accepted P3 identities; P3 Artifact remains immutable and independently rechecked.

### T12 — CI executes the product boundary

**Threat:** acceptance CI starts k6 or another real external process, creates a PID, sends a signal, accesses a target or reads a Secret.

**Controls:** injected fake process/timers/resolver/abort only; dedicated workflow source scan; no k6 installation; read-only permissions; safety-boundary Evidence fields fixed false.

## Residual risks and deferred capability

No governed server-owned writable output root exists. Therefore file-result collection remains explicitly deferred:

```text
governedOutputRootDefined=false
governedOutputRootImplemented=false
fileResultCollectionSupported=false
fileResultCollectionImplemented=false
fileResultCollectionDecision=DEFERRED_GOVERNED_OUTPUT_ROOT_REQUIRED
fileResultCollectionBlocker=governed-output-root-not-defined
sourceBundleRemainsImmutable=true
callerPathAccepted=false
arbitraryFileReadEnabled=false
```

This deferral is not closed by writing under the immutable Source Bundle or by creating an ungoverned temporary directory.

## Dashboard visibility

```text
securityDashboardEnumerationAvailable=false
zeroAlertClaimMade=false
```

P4 records visible Dependabot, Code Scanning, Secret Scanning, review-bot and human-review findings when available. It does not claim an inaccessible dashboard has zero alerts.

## Acceptance decision boundary

P4 can establish fault/security/compatibility acceptance for the existing local governed runtime boundary. It cannot establish distributed execution, production cluster readiness, remote execution, governed output storage, file-result collection, Allure, container or Kubernetes execution.