# M3-R3-P3 — Sanitized Runtime Result and Immutable Execution Evidence

## Objective

Convert the accepted P2 lifecycle into a versioned, immutable and non-sensitive Runtime Result without widening the local process or immutable Source Bundle boundaries.

## R0 — Result-source audit

The audit concluded:

- lifecycle state, lifecycle observations and exact predecessor digests are accepted P2 sources;
- the child-process `exit` callback can provide one bounded exit code or one allow-listed signal;
- stdout, stderr, PID, raw errors, stack traces, environment values and host paths are excluded;
- `outputs/summary.json` is below an immutable Source Bundle root;
- no independent governed writable output root exists.

Therefore file-result collection is deferred and the Source Bundle remains immutable.

## P1 — Sanitized Runtime Outcome

Delivered:

- closed terminal observation and outcome Schemas;
- canonical SHA-256 identities;
- exit code restricted to integer `0..255` or absent;
- signal restricted to a fixed enum;
- allow-listed outcome classifications;
- predecessor-bound reconstruction validators;
- defensive copy and deep freeze;
- tamper, self-redigest, additional-field and leakage tests.

## P2 — Immutable Runtime Evidence

Delivered aggregate Evidence binds:

- Runtime Policy;
- Runtime Admission Request;
- Invocation Plan;
- Runtime Admission Evidence;
- P1 port descriptor, launch specification, decision and boundary Evidence;
- P2 adapter, command and lifecycle Evidence;
- P3 terminal observation and sanitized outcome.

The aggregate records `runtimeResultCollected=true` only after the P3 outcome exists. It records `rawRuntimeOutputCollected=false` and contains no raw material.

## P3 — File-result decision

```text
supported=false
implemented=false
decision=DEFERRED_GOVERNED_OUTPUT_ROOT_REQUIRED
blockerCode=governed-output-root-not-defined
sourceBundleRemainsImmutable=true
callerPathAccepted=false
arbitraryFileReadEnabled=false
```

A future slice may introduce a distinct output-root contract. P3 does not silently change the command, working directory or Source Bundle publication contract.

## P4 — Acceptance

Acceptance requires:

- focused P3 tests;
- all k6 API Adapter tests;
- complete Node test suite;
- root and P3 validators;
- accepted predecessor validators;
- exact-Head read-only Workflow;
- closed Evidence Schema and Schema Catalog;
- exact Artifact layout and path-collision gate;
- credential-shaped scan;
- independently recomputable product, catalog and acceptance digests.

## Merge gate

P3 remains Draft/Open/Unmerged. Ready state and Merge Commit require a later authorization naming the exact PR and exact 40-character Head SHA.

## Next slice

`M3-R3-P4` remains frozen and is the next required slice only after P3 merge and post-merge exact-main closure.
