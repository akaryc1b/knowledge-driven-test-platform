# M3-R4 — Governed Output Root and Bounded File Result Collection

## Status

```text
slice=M3-R4-P1
issue=79
r0Issue=77
r0PullRequest=78
r0AcceptedHead=e522c13065dd77770d414a727d030a5108488eae
branch=agent/m3-r4-p1-output-root-contracts-e522c13
baseMain=6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa
m3R3FinalClosureReverified=true
m3R4Started=true
m3R4R0ExactHeadAcceptanceComplete=true
m3R4P1Started=true
m3R4P1ImplementationComplete=true
m3R4P1ExactHeadAcceptanceComplete=false
m3R4P2Started=false
```

M3-R4-P1 is the first product-contract slice after the R0 boundary freeze. It defines pure-data identities, exact artifact descriptors, bounded limits and a closed lifecycle grammar. It does not allocate a directory, resolve a host path, read a file, change the Invocation Plan or alter the accepted process adapter.

## Accepted predecessor

The P1 branch is stacked directly on the exact accepted R0 Head:

```text
r0Head=e522c13065dd77770d414a727d030a5108488eae
r0BaseMain=6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa
r0ChangedPathCount=8
r0NaturalWorkflowCount=11
r0NaturalWorkflowSuccess=11
r0NaturalWorkflowFailure=0
r0ReadyMarked=false
r0Merged=false
```

The M3-R3 final exact-main Evidence remains immutable:

```text
m3R3FinalMain=6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa
m3R3FinalManifestRun=31151845526
m3R3FinalManifestArtifact=8983613200
m3R3FinalManifestArtifactDigest=sha256:579b91ef2219245ea6020ad5767cab23f10297d6fd60aa3310ba18c771a08868
m3R3FinalManifestCanonicalEvidenceDigest=65579189cf11a930f621333824219faa9e5ca11516041ab7188ed68b11ab6990
```

P1 preserves the predecessor runtime decision rather than rewriting it:

```text
fileResultCollectionSupported=false
fileResultCollectionImplemented=false
fileResultCollectionDecision=DEFERRED_GOVERNED_OUTPUT_ROOT_REQUIRED
fileResultCollectionBlocker=governed-output-root-not-defined
sourceBundleRemainsImmutable=true
callerPathAccepted=false
arbitraryFileReadEnabled=false
```

## P1 contract surface

P1 publishes four versioned contracts:

```text
policySchema=k6-governed-output-root-policy/v1
descriptorSchema=k6-output-artifact-descriptor/v1
rootContractSchema=k6-governed-output-root-contract/v1
evidenceSchema=m3-r4-output-root-p1-evidence/v1
schemaCatalog=k6-output-root-p1-schema-catalog/v1
```

The product module exports constructors, validators and canonical digest recomputation only:

- `createK6GovernedOutputRootPolicy`;
- `validateK6GovernedOutputRootPolicy`;
- `computeK6GovernedOutputRootPolicyDigest`;
- `createK6OutputArtifactDescriptor`;
- `validateK6OutputArtifactDescriptor`;
- `computeK6OutputArtifactDescriptorDigest`;
- `validateK6OutputArtifactRelativePath`;
- `createK6GovernedOutputRootContract`;
- `validateK6GovernedOutputRootContract`;
- `computeK6GovernedOutputRootContractDigest`.

No allocator, resolver, collector, filesystem port or lifecycle executor is exported.

## Frozen policy

```text
implementationStatus=CONTRACT_ONLY
ownership=PLATFORM_OWNED
role=EXECUTION_SCOPED_WRITABLE_RESULTS
logicalName=execution-output-root
hostPathIncluded=false
callerPathAccepted=false
absolutePathAccepted=false
recursiveDiscoveryAllowed=false
regularFilesOnly=true
symbolicLinksAllowed=false
hardLinksAllowed=false
specialFilesAllowed=false
sourceBundleMutationAllowed=false
```

The public identity is derived from canonical predecessor digests, the output-root policy digest and exact artifact descriptor digests. It never contains a private host path.

## Exact artifact allow-list

```text
artifactDescriptorCount=1
descriptorId=k6-output-summary-json
artifactKind=k6-run-summary-json
relativePath=outputs/summary.json
mediaType=application/json
encoding=UTF-8
required=true
regularFileRequired=true
symbolicLinkAllowed=false
hardLinkAllowed=false
specialFileAllowed=false
parserKind=JSON
duplicateKeyPolicy=REJECT
bomAllowed=false
```

The relative-path grammar is ASCII, NFC-normalized and slash-separated. It rejects empty or dot segments, traversal, absolute paths, URI prefixes, drive letters, UNC paths, backslashes, NUL and normalization collisions. P1 defines this grammar but opens no object.

## Bounded limits

```text
maxFiles=1
maxFileBytes=1048576
maxTotalBytes=1048576
maxJsonDepth=32
maxCollectionDurationMs=10000
```

These are contract limits for later implementation. No capacity is consumed by P1.

## Lifecycle grammar

The ordered state grammar is:

```text
DECLARED
ALLOCATED
ACTIVE
TERMINAL_OBSERVED
SEALED
COLLECTED
CLEANED
```

Only adjacent transitions are declared. The P1 product remains at `DECLARED` and fixes:

```text
allocationAuthorized=false
collectionAuthorized=false
cleanupAuthorized=false
directoryAllocated=false
fileOpened=false
fileRead=false
fileWritten=false
processBoundaryChanged=false
```

P2 or later must not infer authorization from the existence of this grammar.

## Ordered safe slices

1. **R0 — Rebaseline and boundary freeze**
   - bind exact M3-R3 final-main Evidence;
   - freeze ownership, path, identity, lifecycle, limits, failure and audit requirements;
   - complete exact-Head acceptance without product behavior.
2. **P1 — Versioned output-root contracts**
   - publish pure-data policy, descriptor, root and Evidence contracts;
   - close Schemas and canonical digest rules;
   - bind the accepted runtime chain while authorizing no effect.
3. **P2 — Injected trusted root port**
   - define allocator/resolver behavior behind an injected port;
   - remain fake-first until a separate instruction authorizes filesystem effects;
   - keep caller and public absolute paths rejected.
4. **P3 — Bounded result collector**
   - collect only exact contract-declared regular files from a sealed root;
   - enforce path, object, size, count, encoding, parser and time bounds;
   - preserve Source Bundle immutability.
5. **P4 — Fault, security and compatibility acceptance**
   - adversarial path, link, race and resource testing;
   - Linux baseline and explicit portability claim;
   - permanent Evidence and Artifact.
6. **G1–G4 — Formal acceptance and exact-main closure**
   - full-scope audit, conditional ordinary Merge Commit and permanent exact-main verification.

Only P1 is implemented in this branch. P2 and later slices remain frozen.

## P1 non-goals

```text
governedOutputRootImplemented=false
outputDirectoryCreated=false
outputDirectoryAllocated=false
filesystemPortImplemented=false
fileOpened=false
fileRead=false
fileWritten=false
fileResultCollectionSupported=false
fileResultCollectionImplemented=false
arbitraryFileReadEnabled=false
sourceBundleModified=false
invocationPlanModified=false
nodeProcessAdapterModified=false
newProcessPrimitiveAdded=false
k6Invoked=false
xk6Invoked=false
playwrightInvoked=false
realExternalProcessStartedInCi=false
targetNetworkAccessed=false
databaseAccessed=false
secretAccessed=false
filesystemCredentialAccessed=false
rawStdoutCollected=false
rawStderrCollected=false
numericPidExposed=false
workerAdded=false
queueAdded=false
schedulerAdded=false
containerExecutionAdded=false
kubernetesExecutionAdded=false
remoteExecutionApiAdded=false
allureImplemented=false
m4Started=false
```

## Compatibility and security visibility

Node.js 22 remains the baseline. Node.js 24 is used only for fake-only, contract-product compatibility. The accepted runtime platform claim remains Linux.

```text
platformCompatibility=linux
windowsCompatibilityClaimed=false
macosCompatibilityClaimed=false
securityDashboardsEnumerable=false
zeroAlertClaimMade=false
```

## P1 stop condition

After naturally triggered exact-Head CI and independent Artifact audit, P1 may stop at:

```text
m3R4P1ImplementationComplete=true
m3R4P1ContractBoundaryComplete=true
m3R4P1ExactHeadAcceptanceComplete=true
m3R4P1ReadyMarked=false
m3R4P1Merged=false
m3R4P2Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R4-P2
```

P1 completion does not authorize Ready, merge, P2 implementation or any filesystem effect.
