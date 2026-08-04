# M3-R3-P3 Sanitized Runtime Result — Development Handoff

## Status

M3-R3-P2 was accepted on exact `main@db51405e3b8f095a3773f4813b7ecb9e96a12924`. P3 is implemented on the independent Draft branch `agent/m3-r3-p3-sanitized-runtime-result` and must remain unmerged until a later exact-Head ordinary Merge Commit authorization.

## Accepted predecessor

```text
P2 Issue=61
P2 PR=62
P2 source Head=9428909b22ad3ef1bd47c6eb07b2edecbe73698f
P2 Merge SHA=db51405e3b8f095a3773f4813b7ecb9e96a12924
P2 main Run=30907717154
P2 main Job=91986640490
P2 main Artifact=8891734919
P2 Artifact digest=sha256:ad2f84b1058bad17d457057cc489f817af70fe7fd359f4dc0d1cf36ea05c95c5
P2 canonical Evidence digest=66ca6ab45c7412c9c575d44740f7152cab1adc83016908bc5e9aa2b96a961799
```

## Delivered contracts

P3 adds three closed Draft 2020-12 contracts:

1. `k6-process-terminal-observation/v1` — a bounded observation of the child-process `exit` event;
2. `k6-sanitized-runtime-outcome/v1` — deterministic classification of the accepted lifecycle;
3. `k6-runtime-execution-evidence/v1` — immutable aggregation of the R0, P1, P2 and P3 digest chain.

All identities use canonical SHA-256. All public values are defensively copied and deeply frozen. Validators compare the supplied object with a freshly reconstructed predecessor-bound object, so changing a value and recalculating only its own digest is rejected.

## Trusted result sources

The only new terminal values are the bounded exit code or allow-listed signal delivered by the same injected child-process lifecycle that produced P2 Evidence. P3 never performs a second spawn. It does not treat stdout, stderr, PID, an exception message, environment values or a host path as result material.

## File-result decision

The accepted command can contain `--summary-export outputs/summary.json`, while the accepted working directory is the immutable content-addressed Source Bundle root. No separate server-owned writable output root exists.

```text
fileResultCollectionSupported=false
fileResultCollectionImplemented=false
fileResultCollectionDecision=DEFERRED_GOVERNED_OUTPUT_ROOT_REQUIRED
fileResultCollectionBlocker=governed-output-root-not-defined
sourceBundleRemainsImmutable=true
```

This is a scoped deferred design decision, not a repository acceptance blocker. P3 neither reads a caller path nor changes argv or Source Bundle mutability.

## Verification commands

```bash
node --test packages/k6-api-adapter/test/runtime-result*.test.js
node --test packages/k6-api-adapter/test/*.test.js
npm test
npm run validate
npm run validate:m3-r3-p3-sanitized-runtime-result
```

All P3 CI samples use injected fake processes, fake lifecycle events and static repository files. No real k6 or external process is started.

## Frozen capabilities

P3 does not implement Allure, Worker, Queue, Scheduler, container execution, Kubernetes Job execution, remote execution APIs, arbitrary file reading or a new UI. M3-R3-P4 remains not started.

## Next required slice

After a later authorized Merge Commit and exact-main post-merge closure, the next product slice is `M3-R3-P4`. The current Draft PR must not be marked Ready or merged by this handoff.
