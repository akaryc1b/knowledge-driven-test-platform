# M3-R4-R0 Governed Output Root Boundary Matrix

## Purpose

This matrix freezes requirements for later M3-R4 slices. Every row is a future acceptance obligation, not a claim that filesystem behavior already exists.

| ID | Risk or boundary | Frozen R0 decision | Required proof before implementation acceptance |
|---|---|---|---|
| OWNERSHIP | Caller chooses a host path | The platform owns allocation; caller-provided roots are rejected | Closed contract, negative tests and no public absolute-path field |
| SEPARATION | Writable results mutate the Source Bundle | Output root is distinct from Source Bundle, repository, home and temp locations not owned by the execution | Exact predecessor binding and explicit root-role contract |
| IDENTITY | Host path becomes a public identity | Logical root identity is canonical and path-independent | Recomputed digest equality across different private host paths |
| CALLER_PATH_INJECTION | Caller supplies `/tmp`, drive letters, URI paths or environment-expanded paths | No caller path is accepted | Traversal and absolute-path mutation tests |
| TRAVERSAL | `..`, empty segments, NUL or mixed separators escape the root | Only normalized contract-declared relative paths are eligible | Closed path validator and adversarial path corpus |
| SYMLINK | A permitted path is redirected outside the root | Symbolic links and equivalent indirections fail closed | Link fixtures and handle-bound verification |
| HARDLINK_OR_ALIAS | A regular-looking path aliases an unintended object | Alias policy must be explicit and fail closed where identity cannot be proven | Inode/object identity tests on the supported platform |
| SPECIAL_FILE | FIFO, socket, device or other non-regular object blocks or leaks data | Collect regular files only | Object-type checks and timeout tests |
| TOCTOU | Object changes between validation and read | Validation and read operate on the same trusted object/handle | Replacement-race tests with deterministic fakes |
| ALLOWLIST | Recursive walking exposes unrelated files | Collect only versioned artifact descriptors; no unrestricted recursive scan | Exact expected-path set tests |
| OVERSIZE | Large files, excessive count or aggregate output exhaust resources | Per-file, aggregate, count and duration limits are mandatory | Boundary and one-over-limit tests |
| PARSER_BOMB | Deep or malformed structured content exhausts parser resources | Encoding, JSON depth and schema limits fail closed | Malformed UTF-8, depth and duplicate-key policy tests |
| PARTIAL_WRITE | Collection races an incomplete writer | Collection starts only after the root is sealed by an explicit lifecycle state | Ordered state-machine tests |
| STALE_REPLAY | Old output is reused for a new execution | Root identity binds exact invocation and execution identities | Cross-execution substitution tests |
| CLEANUP_RACE | Cleanup deletes data during collection or leaves sensitive residue | Retention and cleanup occur after sealing/collection with explicit outcomes | Fake-clock lifecycle and repeated cleanup tests |
| HOST_PATH_DISCLOSURE | Evidence exposes an absolute path | Public Evidence contains digests and bounded metadata only | Closed Schema and leakage tests |
| RAW_OUTPUT_DISCLOSURE | stdout, stderr or raw exception text enters file Evidence | Raw streams remain outside the contract | Additional-property and sensitive-value tests |
| SOURCE_BUNDLE_MUTATION | Result path is under the immutable bundle | Bundle remains read-only and separately identified | Bundle digest stability before and after fake execution |
| CROSS_EXECUTION_COLLISION | Two executions share a root | Root allocation and logical identity are execution-scoped | Concurrent fake allocation tests |
| CI_SCOPE_ESCALATION | Acceptance starts k6 or reads the host filesystem | R0 is static/documentation-only; later effectful slices require separate authorization | Repository boundary test and read-only natural CI |

## R0 decision

```text
matrixFrozen=true
contractImplemented=false
filesystemPortImplemented=false
outputDirectoryCreated=false
fileResultCollectorImplemented=false
runtimeProductBehaviorChanged=false
sourceBundleRemainsImmutable=true
callerPathAccepted=false
arbitraryFileReadEnabled=false
nextRequiredSlice=M3-R4-R0
```

A future slice must not weaken a row silently. Any changed decision requires an explicit ADR update, threat-model update and new exact-Head acceptance.
