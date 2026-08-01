# M3-R2-P4 Source Bundle Threat Model

## Protected assets

- accepted P3 Source bytes and Source identity;
- P2/P3, compiler, generator and validation provenance;
- manifest, bundle, receipt and publication Evidence integrity;
- host filesystem outside the server-owned Artifact Store;
- non-execution and non-network safety boundaries.

## Threats and controls

- **Path traversal or absolute payload path:** fixed layout plus governed child-path checks.
- **Symlink escape:** root, target and every stored entry reject symbolic links.
- **Partial publication:** private staging directory, exclusive file creation, cleanup on failure and atomic rename.
- **Existing content substitution:** every file, layout and receipt is reverified byte-for-byte.
- **Self-rehashed forged bundle:** Publisher reconstructs the embedded P3 chain and requires it to match an independent accepted-P3 digest anchor.
- **Host path disclosure:** receipt carries only `kdtp-source-bundle://sha256/<digest>`.
- **Remote exfiltration:** Publisher imports no network client and remote publication is fixed false.
- **Execution escalation:** no VM/eval/import/external process/k6 path exists.

Required state:

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

M3-R3, target-network access, Secret resolution, Runtime lifecycle and result collection remain outside the P4 trust boundary.
