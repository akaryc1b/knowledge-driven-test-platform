# M3-R2-P2 Source Renderer Acceptance Matrix

| Control | Acceptance evidence |
|---|---|
| Immutable input chain | Spec, Bundle, Compilation Evidence, capability, Artifact manifest and intent-set bindings are revalidated |
| Determinism | repeated rendering, object insertion order and sortable collection order produce identical bytes |
| Canonical output | UTF-8, LF, fixed indentation, imports, ordering, escaping and final newline |
| Static imports | only `k6` and `k6/http` |
| Injection boundary | arbitrary source, callback, function body, dynamic import, `eval` and `Function` rejected |
| Sensitive data | Secret material, credential URI, absolute path and Runtime parameter rejected |
| Resource bounds | Source bytes, line count, operations, assertions and thresholds fail closed |
| Result integrity | Source digest, Result digest and Source identity independently recomputable |
| Non-execution | no k6/xk6/Playwright, VM, process, target network, Secret or Runtime result |
| Regression | M3-R0, M3-R1, R0 and P1 evidence replay remains green |

```text
deterministicSourceRendererReady=true
sourceGenerationStarted=true
sourceGenerated=true
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
nextRequiredSlice=M3-R2-P3
```

M3-R3 remains frozen. The generated JavaScript is evidence-only source text and is never executed.

Acceptance requires an exact-Head permanent Artifact and independent ZIP,
Evidence, Source digest, byte-length and line-count verification. M3-R3 remains
frozen.
