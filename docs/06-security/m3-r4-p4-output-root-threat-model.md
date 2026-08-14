# M3-R4-P4 Output-Root Threat Model

## Scope

This threat model evaluates the accepted injected P3 collector and records the
proof required before any separately authorized Linux filesystem adapter. It is
not evidence that a host filesystem was accessed.

| ID | Threat | P4 acceptance | Later Linux proof obligation |
|---|---|---|---|
| CALLER_PATH_INJECTION | Caller chooses a root or result path | Forged caller paths fail closed | No public host-path input |
| TRAVERSAL | `..`, absolute, URI or mixed separators escape the root | Exact descriptor path remains closed | Component-by-component root-relative resolution |
| SYMLINK | A declared path redirects outside the root | Link attestations are rejected | No-follow handle acquisition |
| HARDLINK_OR_ALIAS | A regular-looking path aliases another object | Hard-link trust remains false | Stable object identity policy and tests |
| SPECIAL_FILE | FIFO, socket, device or directory blocks or leaks | Non-regular objects are rejected | Handle type verification and deadlines |
| TOCTOU | Object changes between inspection and read | Stale metadata and unstable attestations fail | Same-handle validation/read and before/after identity |
| ALLOWLIST | Recursive discovery exposes unrelated files | One exact descriptor is accepted | No unrestricted directory walk |
| OVERSIZE | Bytes, count or time exhaust resources | Exact boundary passes; one-over fails | Bounded streaming/read enforcement |
| PARSER_BOMB | Malformed UTF-8, duplicate keys or depth exhaust parser | Encoding, escaped-key and depth tests fail closed | Same bounded parser after read |
| PARTIAL_WRITE | Collector reads an incomplete result | Collection requires sealed lifecycle | Seal handoff proof |
| STALE_REPLAY | Old handles or receipts are reused | Stale handle and digest substitutions fail | Execution-scoped root and handle identities |
| HOST_PATH_DISCLOSURE | Evidence exposes an absolute path | Public products remain path-free | Private path never enters public Evidence |
| RAW_OUTPUT_DISCLOSURE | Raw JSON or error text enters Evidence | Metadata-only and sanitization tests pass | No raw payload persistence |
| SOURCE_BUNDLE_MUTATION | Writable results alter generated source | P3 product and bundle bindings remain unchanged | Physically distinct private output root |
| CI_SCOPE_ESCALATION | Acceptance starts k6 or accesses host resources | Static source and exact diff guards pass | Separate effectful authorization required |

## Accepted P4 posture

```text
slice=M3-R4-P4
issue=85
m3R4P3ExactHeadAcceptanceComplete=true
m3R4P3ArtifactIndependentlyVerified=true
m3R4P4Started=true
m3R4P4ImplementationComplete=true
m3R4P4ExactHeadAcceptanceComplete=false
implementationStatus=ACCEPTANCE_ONLY
realFilesystemImplementationEvaluated=true
realFilesystemImplementationAuthorized=false
realFilesystemCollectorImplemented=false
p3CollectorProductChanged=false
platformCompatibility=linux-contract-baseline
windowsCompatibityClaimed=false
macosCompatibilityClaimed=false
m3R4G1Started=false
nextRequiredSlice=M3-R4-G1
```
