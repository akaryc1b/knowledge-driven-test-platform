# M3-R2-P2 Source Renderer Threat Model

## Assets

- accepted M3-R1 Spec, Bundle and Compilation Evidence;
- P1 Generation Request, Rendering Policy and Generator Descriptor;
- canonical JavaScript Source bytes and Source Result;
- fixed M3-R1 digest baseline.

## Threats and controls

1. **Digest substitution** — every immutable digest is recomputed and cross-bound.
2. **Capability or intent expansion** — exact accepted sets are compared.
3. **Artifact substitution** — body references must match the immutable manifest.
4. **Source injection** — arbitrary source, callback, function body and custom
   import fields are rejected by closed contracts.
5. **Dynamic execution** — dynamic import, `eval`, `Function`, Node APIs,
   WebAssembly and process primitives are statically rejected.
6. **Secret disclosure** — sensitive strings, credentials, absolute paths and
   environment/runtime values are rejected.
7. **Nondeterminism** — stable sorting, deterministic identifiers, fixed escaping,
   LF and final-newline policy are enforced.
8. **Resource exhaustion** — policy limits cap bytes, lines, operations,
   assertions and thresholds.
9. **Validation by execution** — prohibited; no VM or generated-source execution.

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

P3 may bind Source to an Artifact but may not weaken these controls. M3-R3
remains frozen.
