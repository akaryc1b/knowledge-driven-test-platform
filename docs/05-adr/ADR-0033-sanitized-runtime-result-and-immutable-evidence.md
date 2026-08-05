# ADR-0033：从同一有界进程生命周期生成 Sanitized Runtime Result

## 状态

Accepted for M3-R3-P3 implementation; merge remains separately governed.

## Context

P2 provides a bounded local child-process lifecycle and immutable lifecycle Evidence. It intentionally excludes runtime result material. The accepted command may request `--summary-export outputs/summary.json`, but its working directory is the immutable, content-addressed Source Bundle root. No distinct server-owned writable output root is part of the accepted contract.

A result contract is needed without exposing process internals or weakening Source Bundle immutability.

## Decision

1. Capture only the child-process `exit` callback's bounded exit code or fixed allow-listed signal from the same P2 lifecycle invocation.
2. Construct a closed terminal observation and deterministic sanitized outcome after lifecycle Evidence is complete.
3. Aggregate the complete accepted predecessor digest chain into immutable Runtime Execution Evidence.
4. Keep stdout, stderr, raw errors, stack traces, numeric PID, environment values, host paths and credential material outside all public contracts.
5. Preserve the existing lifecycle API and add a single-spawn integrated result API.
6. Record file-result collection as unsupported and deferred until a versioned governed writable output-root contract exists.
7. Keep the Source Bundle immutable and reject arbitrary caller paths or file readers.

## Consequences

### Positive

- Success and failure classification is deterministic and auditably bound to P1/P2.
- A self-redigested forged result still fails predecessor-bound reconstruction.
- Existing P2 consumers remain compatible.
- P3 can produce a useful runtime result without collecting raw output.
- CI remains fully fake-process based.

### Limitations

- k6 summary JSON is not collected in P3.
- No metrics, checks, thresholds, stdout or stderr are exposed.
- A future file-result slice must introduce an independent output-root contract and revisit argv binding explicitly.

## Rejected alternatives

### Write under the immutable Source Bundle root

Rejected because it contradicts the accepted content-addressed immutable publication contract.

### Accept a caller-provided output path

Rejected because it would introduce traversal, symlink, host-path and credential-reading risks.

### Parse stdout or stderr

Rejected because stdio is intentionally ignored by P2 and raw output is outside P3's security boundary.

### Start a second process to collect results

Rejected because it would break lifecycle identity, duplicate side effects and invalidate the P2-bound result claim.

## Follow-up

M3-R3-P4 may be considered only after P3 is authorized, merged with an ordinary Merge Commit and closed on exact main. A future file-result design must be a separate versioned contract change.
