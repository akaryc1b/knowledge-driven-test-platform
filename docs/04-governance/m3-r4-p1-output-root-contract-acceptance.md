# M3-R4-P1 Output-Root Contract Acceptance

## Purpose

P1 converts the R0 threat and boundary decisions into versioned, closed, deterministic contracts. This document is an acceptance plan and static product record; it is not evidence that a writable directory or collector exists.

## Contract acceptance matrix

| Area | P1 contract | Required acceptance |
|---|---|---|
| Ownership | `PLATFORM_OWNED` | caller path fields absent; policy mutations fail closed |
| Role | `EXECUTION_SCOPED_WRITABLE_RESULTS` | logical root identity binds exact runtime predecessors |
| Host path | `hostPathIncluded=false` | no absolute path field or value in public products |
| Artifact allow-list | one `outputs/summary.json` descriptor | exact kind/path/media/encoding and digest reconstruction |
| Path grammar | NFC ASCII relative segments | traversal, absolute, URI, drive, UNC, backslash and NUL rejection |
| Object type | regular file required | links and special-file permissions fixed false |
| Discovery | no recursion | exact descriptor set; additional paths fail closed |
| Capacity | one file, 1 MiB aggregate | fixed closed numeric limits and mutation tests |
| Parser | UTF-8 JSON, depth 32, duplicate keys rejected | closed parser descriptor and Schema |
| Lifecycle | seven ordered states | only six adjacent transitions; current state remains `DECLARED` |
| Effects | all false | no directory, file or process primitive in product source |
| Predecessor | Runtime Policy through Runtime Evidence | every digest independently recomputed and cross-bound |
| Evidence | closed P1 Evidence | exact Head, tests, Catalog and contract digest bound |
| Compatibility | Node 22 and fake-only Node 24 | byte-identical compatibility product digest |

## Repository scope

Authorized production changes are limited to constants, error type, public export and the pure-data `output-root-contracts.js` module. Tests, four Schemas, one Schema Catalog, one Validator, one read-only Workflow and bounded documentation support acceptance.

Forbidden production modules remain absent:

```text
packages/k6-api-adapter/src/governed-output-root.js
packages/k6-api-adapter/src/output-root-allocator.js
packages/k6-api-adapter/src/file-result-collector.js
```

Forbidden runtime exports remain absent:

```text
createGovernedOutputRoot
allocateGovernedOutputRoot
collectFileResults
readResultFile
```

## Evidence requirements

The dedicated natural Workflow must bind:

```text
repository=akaryc1b/knowledge-driven-test-platform
r0Head=e522c13065dd77770d414a727d030a5108488eae
issue=79
exactHead=<current P1 Head>
nodeBaseline=22
node24Mode=fake-only-contract-compatibility
artifactName=m3-r4-p1-output-root-contract-evidence
```

The permanent Artifact must contain exactly 12 regular paths: four contract source files, five Schema/Catalog files, one Evidence file, one test-results file and one manifest file. It must reject unsafe paths, links, special objects, credential-shaped values, missing or extra entries and digest mismatches.

## Formal P1 decision

```text
outputRootContractReady=true
outputRootSchemaCatalogReady=true
logicalRootIdentityDefined=true
artifactDescriptorsDefined=true
lifecycleGrammarDefined=true
governedOutputRootImplemented=false
outputDirectoryCreated=false
outputDirectoryAllocated=false
filesystemPortImplemented=false
fileResultCollectionSupported=false
fileResultCollectionImplemented=false
sourceBundleRemainsImmutable=true
callerPathAccepted=false
arbitraryFileReadEnabled=false
m3R4P2Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R4-P2
```

Exact-Head acceptance, Ready and merge remain separate gates. P1 must remain Draft/Open/Unmerged after this slice unless a later instruction explicitly changes the gate.
