# M3-R4 — Governed Output Root and Bounded File Result Collection

## Status

```text
slice=M3-R4-P3
issue=83
r0Issue=77
r0PullRequest=78
r0AcceptedHead=e522c13065dd77770d414a727d030a5108488eae
p1Issue=79
p1PullRequest=80
p1AcceptedHead=3f0459700e5d7e651011f8addeda8e8164a0ccbc
p2Issue=81
p2PullRequest=82
p2AcceptedHead=b66f223cc4453da4cab4af4df2676327aaa4bd76
branch=agent/m3-r4-p3-bounded-result-collector-b66f223
baseMain=6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa
m3R3FinalClosureReverified=true
m3R4Started=true
m3R4R0ExactHeadAcceptanceComplete=true
m3R4P1ExactHeadAcceptanceComplete=true
m3R4P1ArtifactIndependentlyVerified=true
m3R4P2ExactHeadAcceptanceComplete=true
m3R4P2ArtifactIndependentlyVerified=true
m3R4P3Started=true
m3R4P3ImplementationComplete=true
m3R4P3ExactHeadAcceptanceComplete=false
m3R4P4Started=false
```

M3-R4-P3 adds a closed injected collector boundary on top of the accepted P2
opaque-handle products. It can model logical sealing, exact artifact inspection,
transient payload delivery and bounded JSON verification while remaining
fake-only. No concrete host filesystem adapter is present and no public product
contains raw result bytes or a host path.

## Accepted predecessors

```text
p2Head=b66f223cc4453da4cab4af4df2676327aaa4bd76
p2NaturalWorkflowCount=18
p2NaturalWorkflowSuccess=18
p2ArtifactId=9099506980
p2ArtifactRun=31486998071
p2ArtifactJob=93764560325
p2ArtifactApiDigest=sha256:2775d56a5a9dc66847e6e9239a1c4271fc0ebf7476d43b414e2b324b1f4d8e44
p2CanonicalEvidenceDigest=b431b64406700b13a63464c4cb67c5bfabd973a452c45ce777f1ab7477cfefed
p2SchemaCatalogDigest=f65d9d76e8937900ad10e862dfda1ec987ee88bcfedcc8aa265d87caa3ca0216
p2ReadyMarked=false
p2Merged=false
```

P1, R0 and the M3-R3 exact-main closure remain immutable:

```text
p1Head=3f0459700e5d7e651011f8addeda8e8164a0ccbc
r0Head=e522c13065dd77770d414a727d030a5108488eae
m3R3FinalMain=6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa
m3R3FinalManifestRun=31151845526
m3R3FinalManifestArtifact=8983613200
m3R3FinalManifestArtifactDigest=sha256:579b91ef2219245ea6020ad5767cab23f10297d6fd60aa3310ba18c771a08868
```

## P3 collector surface

P3 publishes eight versioned product contracts and one acceptance Evidence
contract:

```text
collectorPortSchema=k6-bounded-result-collector-port/v1
sealRequestSchema=k6-output-root-seal-request/v1
sealReceiptSchema=k6-output-root-seal-receipt/v1
inspectionRequestSchema=k6-output-artifact-inspection-request/v1
inspectionReceiptSchema=k6-output-artifact-inspection-receipt/v1
payloadRequestSchema=k6-output-artifact-payload-request/v1
payloadReceiptSchema=k6-output-artifact-payload-receipt/v1
boundedResultSchema=k6-bounded-file-result/v1
acceptanceEvidenceSchema=m3-r4-output-root-p3-evidence/v1
schemaCatalog=k6-output-root-p3-schema-catalog/v1
```

The injected descriptor fixes:

```text
implementationStatus=INJECTED_FAKE_ONLY
ownership=PLATFORM_OWNED
sealLogicalRoot=true
inspectDeclaredArtifact=true
provideTransientPayload=true
accessRealFilesystem=false
returnHostPath=false
recursivelyDiscover=false
persistRawPayload=false
```

The product orchestration accepts only a dependency with three methods:

- `sealRoot(sealRequest)`;
- `inspectArtifact(inspectionRequest)`;
- `provideArtifactPayload(payloadRequest)`.

All requests are closed, deeply frozen and digest-bound. Every receipt must
match the accepted request and the fixed fake-only effect boundary.

## Logical sealing boundary

P3 advances only through the accepted adjacent lifecycle path:

```text
ALLOCATED->ACTIVE
ACTIVE->TERMINAL_OBSERVED
TERMINAL_OBSERVED->SEALED
```

The seal receipt fixes:

```text
sealed=true
currentState=SEALED
realDirectoryCreated=false
realFilesystemAccessed=false
hostPathIncluded=false
sourceBundleMutated=false
```

The terminal outcome and Source Bundle digests are inherited from the accepted
P1 root contract. Sealing neither edits Runtime Evidence nor mutates the Source
Bundle.

## Exact artifact inspection boundary

P3 may inspect only the P1 descriptor already resolved by P2:

```text
descriptorId=k6-output-summary-json
artifactKind=k6-run-summary-json
relativePath=outputs/summary.json
maxBytes=1048576
regularFileRequired=true
symbolicLinkAllowed=false
hardLinkAllowed=false
specialFileAllowed=false
```

The injected fake attestation must report:

```text
objectType=REGULAR_FILE
regularFileAttested=true
symbolicLink=false
hardLink=false
specialFile=false
stableObjectAttested=true
encoding=UTF-8
bomPresent=false
realFilesystemAccessed=false
hostPathIncluded=false
```

This is a deterministic fake receipt, not a claim that a host file was opened
or verified. A concrete filesystem adapter remains outside P3.

## Transient payload and parser boundary

The payload request fixes:

```text
maxFiles=1
maxBytes=1048576
maxTotalBytes=1048576
maxDepth=32
maxCollectionDurationMs=10000
encoding=UTF-8
duplicateKeyPolicy=REJECT
bomAllowed=false
```

The injected port returns exactly `{ receipt, bytes }`. Bytes are copied into a
bounded transient `Uint8Array`, matched against inspection length and receipt
SHA-256, decoded with fatal UTF-8 validation, parsed with duplicate-key and
maximum-depth enforcement, then discarded from all public products.

P3 rejects:

- oversized or length-mismatched payloads;
- malformed UTF-8 or BOM-prefixed payloads;
- duplicate JSON object keys;
- JSON nesting beyond 32;
- trailing content or non-object roots;
- symlink, hard-link or special-file attestations;
- stale P2 predecessor substitutions;
- backward clocks and collection durations over 10 seconds.

## Metadata-only result

The bounded result advances:

```text
SEALED->COLLECTED
currentState=COLLECTED
sealed=true
collected=true
cleanupAuthorized=false
cleaned=false
```

It exposes only:

- exact predecessor and request/receipt digests;
- descriptor, opaque allocation and artifact identities;
- byte length and UTF-8 encoding;
- raw-byte content digest;
- canonical parsed-JSON digest;
- maximum depth observed and top-level key count;
- fixed limits and collection duration;
- immutable decision and safety boundary.

```text
rawPayloadIncluded=false
rawPayloadPersisted=false
hostPathIncluded=false
realHostFileReadPerformed=false
sourceBundleMutated=false
```

## Ordered safe slices

1. **R0 — Rebaseline and boundary freeze**
   - bind exact M3-R3 final-main Evidence;
   - freeze ownership, path, identity, lifecycle, limits, failure and audit
     requirements;
   - complete exact-Head acceptance without product behavior.
2. **P1 — Versioned output-root contracts**
   - publish pure-data policy, descriptor, root and Evidence contracts;
   - close Schemas and canonical digest rules;
   - bind the accepted runtime chain while authorizing no effect.
3. **P2 — Injected trusted root port**
   - define deterministic allocation and artifact-resolution requests;
   - accept only opaque fake-only receipts from an injected dependency;
   - perform a logical `DECLARED -> ALLOCATED` transition;
   - keep caller paths, host paths and real filesystem effects rejected.
4. **P3 — Bounded result collector**
   - seal the logical root through adjacent lifecycle states;
   - inspect only the exact contract-declared artifact;
   - verify bounded transient bytes and emit metadata-only Evidence;
   - keep the concrete host filesystem adapter outside this slice.
5. **P4 — Fault, security and compatibility acceptance**
   - adversarial path, link, race, parser and resource testing;
   - evaluate a separately authorized Linux filesystem implementation boundary;
   - produce permanent acceptance Evidence and explicit portability claims.
6. **G1–G4 — Formal acceptance and exact-main closure**
   - full-scope audit, conditional ordinary Merge Commit and permanent
     exact-main verification.

Only P3 is implemented in this branch. P4 and later slices remain frozen.

## P3 non-goals

```text
realFilesystemPortImplemented=false
outputDirectoryCreated=false
hostPathResolved=false
hostPathIncluded=false
callerPathAccepted=false
realHostFileOpened=false
realHostFileRead=false
realHostFileWritten=false
arbitraryFileReadEnabled=false
rawPayloadPersisted=false
rawPayloadIncludedInEvidence=false
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

Node.js 22 remains the baseline. Node.js 24 is used only for fake-only
compatibility comparison. No real filesystem, process or target system is
accessed in CI.

```text
platformCompatibility=linux-contract-baseline
windowsCompatibilityClaimed=false
macosCompatibilityClaimed=false
securityDashboardsEnumerable=false
zeroAlertClaimMade=false
```

## P3 stop condition

After naturally triggered exact-Head CI and independent Artifact audit, P3 may
stop at:

```text
m3R4P3ImplementationComplete=true
m3R4P3FakeOnlyCollectorBoundaryComplete=true
m3R4P3ExactHeadAcceptanceComplete=true
m3R4P3ArtifactIndependentlyVerified=true
m3R4P3ReadyMarked=false
m3R4P3Merged=false
m3R4P4Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R4-P4
```

P3 completion does not authorize Ready, merge, a concrete host filesystem
adapter, k6 execution or P4 implementation.
