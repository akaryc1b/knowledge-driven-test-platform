# M3-R4-P1 — Versioned Governed Output-Root Contracts

## Release scope

This slice publishes the contract-only foundation for a future execution-scoped writable result root. It adds no filesystem allocator, file collector or process behavior.

## Product contracts

- deterministic platform-owned output-root policy;
- exact `k6-run-summary-json` descriptor for `outputs/summary.json`;
- path-independent logical root contract bound to the accepted runtime chain;
- fixed seven-state lifecycle grammar with no effect authorization;
- closed Draft 2020-12 Schemas and deterministic Schema Catalog;
- permanent exact-Head acceptance Evidence.

## Security properties

- no caller or public absolute path;
- no traversal, URI, drive, UNC, backslash, NUL or Unicode path form;
- one allow-listed regular-file descriptor only;
- links, aliases and special files are not authorized;
- file count, bytes, parser depth and collection duration are bounded;
- Source Bundle mutation remains forbidden;
- public objects expose logical IDs, enums, booleans and digests only.

## Non-capabilities

```text
governedOutputRootImplemented=false
outputDirectoryCreated=false
filesystemPortImplemented=false
fileResultCollectionImplemented=false
fileRead=false
fileWritten=false
processBoundaryChanged=false
k6Invoked=false
externalProcessExecuted=false
```

The next possible slice is M3-R4-P2, subject to separate authorization after P1 exact-Head acceptance.
