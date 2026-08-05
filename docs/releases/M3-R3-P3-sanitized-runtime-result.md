# M3-R3-P3 — Sanitized Runtime Result and Immutable Execution Evidence

## Release scope

This candidate adds deterministic runtime outcome material to the accepted bounded local process lifecycle without collecting raw process output.

## Added

- versioned terminal observation contract;
- versioned sanitized runtime outcome contract;
- immutable full-chain Runtime Execution Evidence;
- fixed exit-code and signal bounds;
- single-spawn P2/P3 integration API;
- file-result unsupported/deferred decision;
- closed Draft 2020-12 Schemas and P3 Schema Catalog;
- focused security, fault, race, compatibility and leakage tests;
- independent P3 repository/Evidence validator;
- exact-Head read-only permanent Workflow and Artifact.

## Compatibility

The existing `executeK6ProcessLifecycle` API remains available and returns the accepted P2 lifecycle Evidence. The new integrated API builds P3 material from the same process invocation. No existing command, argv, stdio, working-directory or Source Bundle publication contract is widened.

## Explicitly not included

- k6 summary-file reading;
- stdout or stderr collection;
- raw exception or stack-trace collection;
- numeric PID exposure;
- Allure;
- Worker, Queue or Scheduler;
- container or Kubernetes execution;
- remote execution API;
- product UI changes;
- M3-R3-P4 implementation.

## File-result status

```text
fileResultCollectionSupported=false
fileResultCollectionImplemented=false
fileResultCollectionDecision=DEFERRED_GOVERNED_OUTPUT_ROOT_REQUIRED
sourceBundleRemainsImmutable=true
```

## Release gate

The PR remains Draft/Open/Unmerged after exact-Head acceptance. This release note does not authorize Ready state or merge. A later authorization must identify the exact PR and exact 40-character Head and explicitly request an ordinary Merge Commit.

## Next required slice

After later merge and exact-main closure: `M3-R3-P4`.
