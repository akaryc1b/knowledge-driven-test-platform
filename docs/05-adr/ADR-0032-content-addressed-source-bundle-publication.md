# ADR-0032: Content-Addressed Source Bundle Publication

## Status

Accepted for M3-R2-P4.

## Decision

Persist the accepted P3 Source chain as a canonical directory bundle addressed by its SHA-256 bundle digest. Use a fixed payload layout, a digest-bound manifest, complete provenance, a server-owned filesystem Publisher, exclusive staging writes and atomic rename. Emit a receipt containing only a logical URI.

The Publisher revalidates the bundle from its embedded P3 Evidence, Source Artifact and validation Evidence against an independently supplied accepted-P3 digest anchor before any write. A bundle that merely recomputes its own manifest and bundle digests after replacing trusted metadata is rejected.

Local publication is represented explicitly:

```text
sourceBundleContractReady=true
sourceBundleCreated=true
sourceManifestCreated=true
sourceProvenanceBound=true
sourcePersisted=true
artifactPublished=true
remoteArtifactPublished=false
sourceExecuted=false
executionRuntimeStarted=false
nextRequiredSlice=M3-R2-P5
repositoryBlockers=[]
```

## Consequences

The bundle is portable, immutable, idempotent and independently verifiable. Storage root paths remain operational configuration and never enter Source identity or public Evidence. Remote stores and Runtime consumers require later contracts; M3-R3 is not started or authorized by this decision.
