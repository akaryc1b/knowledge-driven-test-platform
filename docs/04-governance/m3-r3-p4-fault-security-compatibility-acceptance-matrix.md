# M3-R3-P4 Fault, Security and Compatibility Acceptance Matrix

## Baseline and scope

```text
p4Issue=67
p4BaselineMain=8684836233837c905e0ced20e8eac2cfd0b43601
acceptedP3Main=8684836233837c905e0ced20e8eac2cfd0b43601
p4ProductCapabilityAdded=false
p4ExistingRuntimeBehaviorChanged=false
p4FaultMatrixFrozen=true
p4SecurityMatrixFrozen=true
p4CompatibilityMatrixFrozen=true
```

Every executable check in this matrix uses injected fakes or static repository fixtures. Permanent CI must not start a real process, create a PID, send a real signal, invoke k6/xk6/Playwright, access a target network or database, read a Secret, create an execution directory, start a container or create a Kubernetes resource.

## Matrix

| ID | Category | Required acceptance | Evidence path | Frozen R0 result |
|---|---|---|---|---|
| F01 | Synchronous spawn failure | One spawn attempt; deterministic `START_FAILED`; raw error omitted | P4 fault acceptance tests | planned |
| F02 | Child error before spawn acknowledgement | Deterministic start failure; single settlement; no raw error | P4 fault acceptance tests | planned |
| F03 | Child error after spawn acknowledgement | Deterministic process error; no stack/output/PID | P4 fault acceptance tests | planned |
| F04 | Missing spawn acknowledgement | Startup timer, force termination request and bounded fail-closed settlement | P4 fault acceptance tests | planned |
| F05 | Spawn/timeout race | Defined precedence, at most one timeout path, at most one settlement | P4 race acceptance tests | planned |
| F06 | Cancellation before start | Resolver/spawn not widened; zero spawn | P4 cancellation tests | planned |
| F07 | Cooperative cancellation after start | One `SIGINT` request through fake handle and deterministic cancelled result | P4 cancellation tests | planned |
| F08 | Timeout cooperative exit | One `SIGINT` request and confirmed timeout result | P4 timeout tests | planned |
| F09 | Forced termination | `SIGINT` then `SIGKILL`; confirmation required for forced-terminated claim | P4 forced-termination tests | planned |
| F10 | Unconfirmed forced termination | Bounded force-settle expiry and fail-closed `*_FORCE_UNCONFIRMED` state | P4 forced-termination tests | planned |
| F11 | Abort/timeout race | First accepted cause is stable and later cause cannot resettle | P4 race acceptance tests | planned |
| F12 | Duplicate/conflicting terminal events | At most one public terminal event and one settlement | P4 race acceptance tests | planned |
| F13 | Stale timer after settlement | Cleared/fired stale timers cannot mutate accepted result | P4 race acceptance tests | planned |
| F14 | Resolver failures | Throw, relative, non-normalized, symlink and non-directory fail before spawn | P4 resolver tests | planned |
| F15 | Terminal metadata shape | Exit code `0..255`, allow-listed signal and presence rules are closed | P4 contract tests | planned |
| S01 | Process primitive boundary | Only dedicated adapter imports `node:child_process.spawn`; exec/fork/sync/vm/eval/Function/Worker/dynamic import rejected | P4 static security tests | planned |
| S02 | Shell and executable boundary | `k6`, argv array, `shell=false`, `detached=false`, fixed stdio | P4 command security tests | planned |
| S03 | argv injection | Shell fragments, unknown/repeated/ambiguous flags, output/source/executable substitution rejected | P4 command security tests | planned |
| S04 | Adapter identity | Copied/unregistered descriptor, direct executor and cross-binding rejected | P4 identity tests | planned |
| S05 | Environment isolation | No `process.env` inheritance; only adapter-owned names and fixed values | P4 environment tests | planned |
| S06 | Sensitive material | Secret/Token/Cookie/Authorization/Bearer/JWT/credential URI/DB/cloud/SSH/private-key material absent from public products, logs and Artifact | scanner plus P4 leakage tests | planned |
| S07 | Path isolation | traversal, absolute caller path, drive, UNC, URI, encoded traversal, NUL, backslash bypass, symlink and special file rejected | P4 path tests and Artifact audit | planned |
| S08 | Source Bundle immutability | Resolver only binds exact immutable bundle; source is never modified | P4 source-binding tests | planned |
| S09 | File-result deferral | no governed output root, caller path or file reader is added | Validator and Evidence decision | frozen false |
| S10 | Digest/evidence anti-forgery | predecessor, Run/Job/Artifact, schema, catalog, allow-list and safety-decision substitution rejected | P4 digest tests and independent Evidence validation | planned |
| S11 | Information leakage | no stdout, stderr, numeric PID, raw error, stack, host path, env value, handles or mutable controller objects | P4 leakage tests and scanner | planned |
| C01 | Public API continuity | `executeK6ProcessLifecycle` semantics retained; integrated P3 path spawns once; no mandatory new caller parameters | P4 compatibility tests | planned |
| C02 | Export continuity | accepted public exports remain available | P4 compatibility tests | planned |
| C03 | Schema continuity | accepted IDs/versions remain unchanged and closed; no additional properties | predecessor Validators plus P4 tests | planned |
| C04 | Node.js 22 | complete P4 fake-only compatibility suite passes | Node 22 TAP | planned |
| C05 | Node.js 24 | same fake-only fixture digest and suite passes | Node 24 TAP | planned |
| C06 | Platform claim | Linux only unless separately proven; no Windows/macOS claim from `windowsHide` | P4 Evidence/docs | frozen linux |
| D01 | Canonical determinism | same input and normalized unordered input produce byte-identical product/digest | P4 determinism tests | planned |
| D02 | Race determinism | repeated fake event schedules produce identical terminal product | P4 determinism tests | planned |
| D03 | Cross-Node digest | Node 22 and Node 24 fixed fixtures produce identical digest | compatibility TAP and Evidence | planned |
| D04 | Evidence recomputation | P4 Evidence and Schema Catalog digests independently reproduce | permanent Workflow | planned |
| A01 | Artifact portability | exact repository-relative allow-list, regular files only, no unsafe/colliding paths | permanent Workflow and independent download audit | planned |
| A02 | Historical preservation | P3 Artifact identity/content is not modified | P4 Repository Validator | planned |
| G01 | Historical Validator continuity | root Validator retains M2, M3-R0, M3-R1, M3-R2 and M3-R3 R0-P3 validators | P4 Repository Validator | planned |
| G02 | Review and security visibility | actionable PR findings closed; dashboard unavailability reported without zero-alert claim | exact-Head acceptance record | planned |

## Required invariants

```text
singleSpawnInvariant=true
singleSettlementInvariant=true
boundedStartup=true
boundedTimeout=true
boundedCooperativeCancellation=true
boundedForcedTermination=true
unconfirmedTerminationFailsClosed=true
rawRuntimeOutputCollected=false
numericProcessIdExposed=false
sourceBundleRemainsImmutable=true
governedOutputRootDefined=false
fileResultCollectionImplemented=false
callerPathAccepted=false
arbitraryFileReadEnabled=false
```

## Test and evidence rules

- Counts are parsed from real TAP output and are never forecast in permanent Evidence.
- A failing natural PR Run remains retained. A correction uses a new commit and a new natural Run; no failed Run is manually rerun.
- Node 22 remains the formal baseline. Node 24 is compatibility evidence, not permission to remove Node 22 or widen the engine.
- The final P4 Artifact allow-list is frozen only after the actual file set is known.
- GitHub Artifact API digest, uploaded ZIP digest, independently downloaded ZIP SHA-256, individual file digests and canonical Evidence digest are recorded as distinct values.
- Security dashboards are not enumerable through the available connector:

```text
securityDashboardEnumerationAvailable=false
zeroAlertClaimMade=false
```

## R0 gate

P1 may start only after the current main and P3 chain are reverified, no competing implementation exists, this matrix and the threat-model extension are committed, the R0 boundary test passes, and the P4 PR is Open + Draft.
