# ADR-0035：先冻结 Governed Output Root 合同，再允许文件结果收集

## 状态

Accepted for M3-R4-R0 boundary freeze; product implementation remains unstarted.

## Context

M3-R3 can launch one bounded local process and produce a sanitized immutable Runtime Result without raw stdout, stderr, numeric PID, host paths or arbitrary file reads. The accepted Invocation Plan may name `outputs/summary.json`, but the process working directory is the immutable content-addressed Source Bundle root.

Writing or reading that path without a separate trust boundary would either mutate the Source Bundle or introduce caller-path, traversal, link, special-file, time-of-check/time-of-use, size and disclosure risks.

## Decision

1. Introduce M3-R4 as a separate governed-output-root program rather than silently extending M3-R3.
2. Begin with an R0 rebaseline that changes documentation and static tests only.
3. Require a platform-owned, execution-scoped root; public callers never provide an absolute host path.
4. Keep logical root identity and Evidence path-independent. Absolute paths remain private implementation details.
5. Keep the writable root distinct from the Source Bundle, repository checkout, process home and unrelated host directories.
6. Require versioned artifact descriptors, relative-path grammar, file-type policy, limits, lifecycle states and failure categories before any allocator or collector is authorized.
7. Separate future allocation/resolution and collection behind explicit injected ports so contract tests can remain fake-first.
8. Preserve the immutable Source Bundle and existing M3-R3 Invocation Plan until a later slice explicitly revisits argv and working-directory binding.
9. Do not create a directory, read a file or add a runtime export in R0.
10. Gate every later slice through exact-Head natural CI, independent Evidence and ordinary Merge Commit controls.

## Consequences

### Positive

- File-result work cannot bypass the accepted Source Bundle immutability boundary.
- Host paths do not become portable identities or public Evidence.
- Path, link, type, race, size and lifecycle decisions become reviewable before effects exist.
- Later tests can prove behavior through injected fakes before host filesystem access is considered.
- Historical M3-R3 Evidence remains valid and unchanged.

### Limitations

- R0 does not collect k6 summary JSON.
- R0 does not choose a production directory layout or retention duration.
- R0 does not prove Linux safe-open or hard-link behavior.
- Invocation Plan and process working directory remain unchanged.
- A later P1 contract slice is still required before product implementation.

## Rejected alternatives

### Write results into the Source Bundle

Rejected because it breaks the content-addressed immutable publication contract.

### Accept an output directory from the caller

Rejected because it creates direct traversal, host-file disclosure and cross-project isolation risks.

### Collect every file recursively

Rejected because it expands the result boundary to undeclared and potentially sensitive objects.

### Treat the absolute path as the output-root identity

Rejected because host paths are non-portable, sensitive and unstable across runners.

### Implement allocation and collection together

Rejected because ownership, identity and failure semantics would be hidden inside effectful code before the contracts are accepted.

## Follow-up

M3-R4-P1 may define pure-data contracts and closed Schemas only after R0 exact-Head acceptance. R0 completion does not authorize Ready, merge or filesystem implementation.
