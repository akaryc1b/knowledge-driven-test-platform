# M3-R2 Source Generation Acceptance Matrix

## R0 controls

| ID | Control | R0 acceptance condition |
|---|---|---|
| SG-R0-01 | Exact baseline | `main` is exactly `ab93321738222c087e6f3c90fd39e092116cf3c8` and PR #44/#45 state is revalidated |
| SG-R0-02 | Competing work | No open PR, branch or issue contains an existing M3-R2 implementation |
| SG-R0-03 | Permanent evidence | Exact-main General, M3-R1, M3-R0, M2 Final Closure, Portable Readiness and R2-A jobs are successful |
| SG-R0-04 | Artifact continuity | Artifact `8781826637` is unexpired, bound to exact main and its downloaded ZIP digest matches GitHub |
| SG-R0-05 | Digest continuity | Accepted M3-R1 input, Spec, Bundle, Evidence and Schema Catalog digests are independently recorded |
| SG-R0-06 | Review closure | The three post-merge P2 findings are reproduced, corrected and regression-tested |
| SG-R0-07 | Compiler boundary | M3-R1 continues to emit neutral IR only |
| SG-R0-08 | Generator boundary | R0 defines future pure in-memory rendering but implements no generator |
| SG-R0-09 | Runtime boundary | k6, xk6, Playwright, VM, external process, network, database and Secret access remain absent |
| SG-R0-10 | Canonical policy | Encoding, LF, indentation, escaping, ordering and identity exclusions are frozen |
| SG-R0-11 | Injection boundary | User source, callbacks, templates, executable expressions and dynamic modules are permanently rejected |
| SG-R0-12 | Future interface | A future immutable source artifact may be consumed only by separately authorized M3-R3 |
| SG-R0-13 | Permanent workflow | Read-only R0 Workflow runs focused/full/PG18/repository/anti-regression checks and uploads evidence |
| SG-R0-14 | Merge control | R0 PR remains Draft and cannot be marked Ready or merged without later exact authorization |

## R0 decision

```text
sourceGenerationScopeFrozen=true
runtimeBoundaryDefined=true
threatModelAccepted=true
sourceGenerationStarted=false
sourceGenerated=false
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
externalProcessExecuted=false
targetNetworkAccessed=false
secretAccessed=false
nextRequiredSlice=M3-R2-P1
repositoryBlockers=[]
```

## P1 controls

| ID | Control | P1 acceptance condition |
|---|---|---|
| SG-P1-01 | Rendering Policy Schema | `k6-api-source-rendering-policy/v1` is strict, versioned and digest-bound |
| SG-P1-02 | Encoding contract | UTF-8, no BOM, LF, two spaces, single quotes and trailing newline are fixed |
| SG-P1-03 | Ordering contract | Object keys/modules are lexicographic and semantic collections have fixed order rules |
| SG-P1-04 | Identity exclusions | Request time, requester, CI, PR, host, OS and working directory are excluded from Source identity |
| SG-P1-05 | Generator Descriptor | Descriptor is `CONTRACT_ONLY`, deterministic and rejects caller overrides |
| SG-P1-06 | Module allow-list | Allowed modules are exactly `k6` and `k6/http`; no wildcard or dynamic module is accepted |
| SG-P1-07 | Resource limits | Spec bytes, groups, operations, assertions, thresholds, Artifacts, strings and depth are bounded |
| SG-P1-08 | Request Schema | `k6-api-source-generation-request/v1` is strict and contains no source or runtime fields |
| SG-P1-09 | Compilation binding | Request binds exact M3-R1 Spec, Bundle and Compilation Evidence IDs and digests |
| SG-P1-10 | Context binding | Project, environment, plan, snapshot, capability, Artifact manifest and source intent bindings are preserved |
| SG-P1-11 | Source identity seed | Generator, configuration, Spec, Bundle, Evidence, format, policy and module digests are identity inputs |
| SG-P1-12 | Metadata separation | Metadata may change request digest but cannot change request ID or Source identity digest |
| SG-P1-13 | Integrity gates | Spec, Bundle, Evidence, descriptor, policy, limit and request tampering fail closed |
| SG-P1-14 | Injection gates | Source, callback, network URL, filesystem path, shell, Secret and unknown fields are rejected |
| SG-P1-15 | No renderer | No `packages/k6-api-source-generator`, renderer, source text, source bytes or source Artifact exists |
| SG-P1-16 | Non-execution | k6/xk6/Playwright, process, VM, eval, dynamic import, network, database and Secret access remain absent |
| SG-P1-17 | Permanent workflow | Exact-Head focused/full/PG18/repository/R0/M3-R1 checks and P1 Artifact are required |
| SG-P1-18 | Merge control | P1 remains Draft; P1 completion does not authorize P2, Ready, merge or M3-R3 |

## P1 decision

```text
sourceGenerationContractReady=true
sourceGenerationScopeFrozen=true
runtimeBoundaryDefined=true
sourceGenerationStarted=false
sourceGenerated=false
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
externalProcessExecuted=false
targetNetworkAccessed=false
secretAccessed=false
nextRequiredSlice=M3-R2-P2
repositoryBlockers=[]
```

This matrix accepts R0 and P1 only. It does not accept P2–P5, does not grant Formal Acceptance for M3-R2 as a whole, and does not authorize Ready, merge or M3-R3.
