# M3-R3-P3 Sanitized Runtime Result — Threat Model

## Assets

- accepted predecessor identities from Runtime Policy through P2 lifecycle Evidence;
- terminal observation and outcome classification;
- immutable Runtime Execution Evidence;
- Source Bundle immutability;
- exact-Head acceptance Evidence and Artifact.

## Trust boundaries

The injected Node adapter is private. The public boundary receives only immutable contracts. The child-process event emitter is considered untrusted input until its exit code or signal passes the closed P3 sanitizer. CI uses only fake child processes and static fixtures.

## Threats and controls

### Forged success

**Threat:** replace a non-zero, signal, timeout or cancellation result with success.

**Controls:** closed outcome allow-list; zero exit is the only success path; predecessor-bound reconstruction; canonical digest recomputation; self-redigest tests.

### Forged exit metadata

**Threat:** use a negative or oversized code, two terminal values, or an arbitrary signal string.

**Controls:** integer `0..255`; exactly one code or allow-listed signal when exit is observed; metadata forbidden without an exit event; closed Schema.

### Unconfirmed termination represented as confirmed

**Threat:** force-settle expiry is rewritten as a confirmed exit.

**Controls:** lifecycle-bound `processTerminationConfirmed`; unconfirmed states carry no exit metadata and remain timeout/cancellation failures.

### Duplicate and out-of-order events

**Threat:** a late event replaces the first terminal result.

**Controls:** P2 settle-once lifecycle, one-shot listeners, listener cleanup and integration tests with duplicate terminal events.

### PID, path or environment disclosure

**Threat:** public result exposes numeric PID, host working directory or environment values.

**Controls:** public contracts contain digests and enums only; leakage tests; closed Schema; Artifact sensitive-material scan.

### Raw output and exception disclosure

**Threat:** stdout, stderr, error messages or stack traces enter Evidence.

**Controls:** P2 stdio remains ignored; error callbacks use category-only terminal states; no raw fields exist; additional properties are rejected.

### Arbitrary result-file read

**Threat:** traversal, symlink, device, FIFO, socket, oversized data, malformed UTF-8, excessive JSON or credential files are read through a caller path.

**Controls:** P3 implements no file reader, accepts no output path and records `fileResultCollectionSupported=false`. Source Bundle remains immutable. Consequently parser-specific attack surfaces are absent rather than merely filtered.

### Source Bundle mutation

**Threat:** `outputs/summary.json` mutates a content-addressed Source Bundle.

**Controls:** explicit deferred decision requiring a future independent governed writable output-root contract; no silent argv or working-directory change.

### Predecessor substitution

**Threat:** bind a valid P3 object to a different policy, command or lifecycle.

**Controls:** Runtime Execution Evidence stores every predecessor digest; bound validators reconstruct the exact object from accepted inputs.

### CI boundary escalation

**Threat:** acceptance runs start real k6, send real signals, access network, database, Secrets, home directories, containers or Kubernetes.

**Controls:** fake process and manual timer fixtures only; read-only Workflow; forbidden-token validator; fixed false safety fields; credential-shaped scan.

## Residual risks

- P3 does not collect k6 summary content. A future governed output-root design is required.
- Operating-system exit behavior outside the allowed code/signal contract fails closed.
- GitHub Artifact retention is finite; exact identifiers and digests must be recorded in PR and Issue evidence.

## Security conclusion

P3 reduces runtime state to bounded, deterministic metadata and does not create a raw-output or file-reading channel. No P4 capability is enabled by this threat model.
