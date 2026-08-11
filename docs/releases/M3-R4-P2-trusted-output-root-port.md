# M3-R4-P2 — Injected Trusted Output-Root Port

## Scope

M3-R4-P2 adds a deterministic fake-only injected port boundary on top of the
accepted P1 output-root contract. It introduces allocation and artifact
resolution requests, exact opaque receipts, closed Schemas and permanent
Evidence.

## Delivered behavior

```text
logicalRootAllocationSupported=true
logicalRootAllocated=true
artifactResolutionSupported=true
exactArtifactResolved=true
opaqueAllocationHandleRequired=true
opaqueArtifactHandleRequired=true
realFilesystemPortImplemented=false
outputDirectoryCreated=false
fileOpened=false
fileRead=false
fileWritten=false
fileResultCollectionImplemented=false
```

The only accepted artifact remains
`outputs/summary.json` / `k6-run-summary-json`.

## Compatibility

Node.js 22 is the baseline. Node.js 24 is exercised only through deterministic
fake-only tests and a canonical compatibility-product comparison.

## Release control

This stacked release record is not a merge authorization:

```text
issue=81
baseHead=3f0459700e5d7e651011f8addeda8e8164a0ccbc
pullRequestDraft=true
readyMarked=false
mergeAttempted=false
merged=false
nextRequiredSlice=M3-R4-P3
```
