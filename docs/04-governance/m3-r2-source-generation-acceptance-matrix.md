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

This matrix accepts only R0. It does not accept P1–P5, does not grant Formal Acceptance for M3-R2 as a whole, and does not authorize Ready, merge or M3-R3.
