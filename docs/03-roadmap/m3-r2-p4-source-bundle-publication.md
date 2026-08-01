# M3-R2-P4 — Governed Source Bundle Publication

## Goal

Turn the accepted P3 in-memory Source Artifact into an immutable, self-describing and persistently retrievable bundle without creating or authorizing an execution Runtime.

## Bundle contract

The bundle payload is fixed to:

1. `metadata/p3-evidence.json`;
2. `metadata/provenance.json`;
3. `metadata/source-artifact.json`;
4. `metadata/source-validation-evidence.json`;
5. `source/main.js`.

`manifest.json`, `bundle.json` and `receipt.json` are added by the Publisher, producing exactly eight stored files. Every payload has a SHA-256 digest and UTF-8 byte length. Bundle identity is derived from the manifest digest, not from a caller path, timestamp, host or CI metadata.

## Publisher contract

The Publisher accepts only a self-validating bundle whose embedded P3 metadata reconstructs the exact trusted chain. It requires a server-owned absolute root, rejects symbolic links and traversal, writes into a private staging directory with exclusive file creation, then uses atomic rename. Existing content must verify byte-for-byte or publication fails closed.

The public receipt contains a logical content-addressed URI only. Local filesystem persistence is the only product publication supported in P4; remote publication remains false.

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

## Excluded scope

P4 does not upload to a registry or object store, expose a download API, invoke k6/xk6/Playwright, resolve Secrets, access a target network, collect results, start M3-R3 or authorize any Runtime consumer.
