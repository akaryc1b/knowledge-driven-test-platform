# ADR-0030 — Deterministic In-Memory k6 Source Renderer

## Status

Accepted for M3-R2-P2.

## Decision

Render k6 JavaScript only from the closed M3-R1 IR and the accepted P1 contract.
The renderer is synchronous, pure with respect to external systems, performs no
filesystem/network/database/process access, and returns a deeply frozen Source
Result.

Source SHA-256 is calculated directly over UTF-8 bytes rather than over a JSON
encoding of the string. All names and collection order derive from immutable
identities. Volatile metadata is excluded from Source bytes and Source identity.

Static validation is fail closed and does not use Node VM or execute the Source.
A third-party parser is not introduced.

## Consequences

- deterministic byte-for-byte reproduction is possible;
- arbitrary JavaScript and custom module capability remain unavailable;
- Artifact publication and provenance are deferred to P3;
- Runtime execution remains deferred beyond M3-R2.

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

M3-R3 remains frozen and requires separate authorization.
