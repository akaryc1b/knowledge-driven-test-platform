# M3-R3-P3 Acceptance Matrix

| Control | Required evidence | Acceptance rule |
|---|---|---|
| P2 predecessor | exact Merge SHA, main Run/Job, Artifact and canonical Evidence digest | must equal the formally accepted P2 values |
| Terminal observation | closed Schema, constructor, shape and bound validator | one bounded exit code or one allow-listed signal; absent when exit not observed |
| Outcome classification | closed allow-list | zero exit only may be `SUCCEEDED`; non-zero, signal, start failure, cancellation and timeout are not success |
| Termination certainty | lifecycle-bound fields | unconfirmed force termination remains unconfirmed |
| Runtime identity | canonical SHA-256 | independent recomputation must equal stored digest |
| Tamper resistance | reconstruction validator | field substitution plus self-redigest must fail |
| Aggregate Evidence | all predecessor digests | Runtime Policy through P3 outcome must be bound exactly |
| Raw output | Evidence and scan | stdout, stderr, raw errors and stack traces are absent |
| Process identity | Evidence and scan | numeric PID is absent |
| Host material | Evidence and scan | absolute host path and environment values are absent |
| Credential material | credential-shaped scan | zero matches across Artifact payload |
| File result | explicit deferred decision | no caller path, arbitrary read, glob, traversal, symlink or Source Bundle mutation |
| Compatibility | all adapter and full Node tests | zero failed tests; existing P2 API remains supported |
| Process behavior | integration tests | P3 result is produced from exactly one injected spawn |
| Race behavior | settle-once tests | duplicate or late terminal events cannot replace the accepted result |
| CI execution | Workflow and Evidence | fake process/lifecycle only; no real k6 or external process |
| Workflow permissions | Workflow source | `contents: read` only |
| Checkout | Workflow source and logs | exact PR Head or push SHA; credentials not persisted; clean tree |
| Artifact layout | Workflow gate | exact repository-relative allow-list; no extra or missing files; no case collision |
| Product Schemas | Draft 2020-12 validation | closed `additionalProperties=false` contracts |
| Acceptance Evidence | closed Schema and digest | canonical digest recomputes after removing `evidenceDigest` |
| Merge state | GitHub metadata | Draft/Open/Unmerged; Ready=false |
| Next slice | Evidence | `nextRequiredSlice=M3-R3-P4`, `m3R3P4Started=false` |

## Required fault and security coverage

The test suite covers normal and non-zero exits, signal exit, cancellation, timeout, forced termination, unconfirmed termination, start failure, duplicate terminal events, forged exit code, forged signal, predecessor substitution, self-redigest, additional fields and leakage attempts.

File traversal, symlink, oversized result, malformed UTF-8, JSON-depth and collection-limit cases are represented by the explicit `fileResultCollectionSupported=false` contract and repository tests proving that no file reader or caller-controlled result path exists. They do not authorize a dormant parser.

## Formal outcome

P3 exact-Head acceptance may be recorded only after the permanent Workflow succeeds and its Artifact independently passes digest, layout, Schema, test-count and sensitive-material verification. This matrix does not authorize Ready state or merge.
