# M3-R4 — Governed Output Root and Bounded File Result Collection

## Status

```text
slice=M3-R4-P2
issue=81
r0Issue=77
r0PullRequest=78
r0AcceptedHead=e522c13065dd77770d414a727d030a5108488eae
p1Issue=79
p1PullRequest=80
p1AcceptedHead=3f0459700e5d7e651011f8addeda8e8164a0ccbc
branch=agent/m3-r4-p2-trusted-output-root-port-3f04597
baseMain=6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa
m3R3FinalClosureReverified=true
m3R4Started=true
m3R4R0ExactHeadAcceptanceComplete=true
m3R4P1ExactHeadAcceptanceComplete=true
m3R4P1ArtifactIndependentlyVerified=true
m3R4P2Started=true
m3R4P2ImplementationComplete=true
m3R4P2ExactHeadAcceptanceComplete=false
m3R4P3Started=false
```

M3-R4-P2 adds a closed injected port boundary for platform-owned logical
output-root allocation and exact artifact resolution. The product invokes only
an injected interface and accepts only deterministic opaque receipts. P2
contains no host filesystem adapter, creates no real directory and opens no
result object.

## Accepted predecessors

The P2 branch is stacked directly on the accepted P1 Head:

```text
p1Head=3f0459700e5d7e651011f8addeda8e8164a0ccbc
p1ArtifactId=9097350510
p1ArtifactRun=31481359612
p1ArtifactApiDigest=sha256:99b6a309b3c335d869d21187538285318b57daacc2df78973eb7d422fa2bd84a
p1CanonicalEvidenceDigest=9d46327e75671673a9a1cb75beb122135a54eb2508433ebc55ef255aae86fc68
p1SchemaCatalogDigest=09a782340e4a8ff0d0335445433ebad9b5a5464c4f654930f964677f618c67bb
p1NaturalWorkflowCount=17
p1NaturalWorkflowSuccess=17
p1ReadyMarked=false
p1Merged=false
```

R0 and the M3-R3 exact-main closure remain immutable:

```text
r0Head=e522c13065dd77770d414a727d030a5108488eae
m3R3FinalMain=6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa
m3R3FinalManifestRun=31151845526
m3R3FinalManifestArtifact=8983613200
m3R3FinalManifestArtifactDigest=sha256:579b91ef2219245ea6020ad5767cab23f10297d6fd60aa3310ba18c771a08868
```

## P2 port surface

P2 publishes six versioned product contracts and one acceptance Evidence
contract:

```text
portSchema=k6-trusted-output-root-port/v1
allocationRequestSchema=k6-output-root-allocation-request/v1
allocationReceiptSchema=k6-output-root-allocation-receipt/v1
resolutionRequestSchema=k6-output-artifact-resolution-request/v1
resolutionReceiptSchema=k6-output-artifact-resolution-receipt/v1
boundaryEvidenceSchema=k6-trusted-output-root-boundary-evidence/v1
acceptanceEvidenceSchema=m3-r4-output-root-p2-evidence/v1
schemaCatalog=k6-output-root-p2-schema-catalog/v1
```

The injected descriptor fixes:

```text
implementationStatus=INJECTED_FAKE_ONLY
ownership=PLATFORM_OWNED
allocateLogicalRoot=true
resolveDeclaredArtifact=true
createRealDirectory=false
accessRealFilesystem=false
returnHostPath=false
openFile=false
readFile=false
writeFile=false
recursivelyDiscover=false
```

The product orchestration accepts only a dependency with two methods:

- `allocateRoot(allocationRequest)`;
- `resolveArtifact(resolutionRequest)`.

Both receive deeply frozen closed requests. Returned receipts are accepted only
when they exactly match the deterministic fake-only constructors and the
accepted P1 contract chain.

## Logical allocation boundary

P2 permits one logical state change:

```text
DECLARED->ALLOCATED
logicalRootAllocated=true
currentState=ALLOCATED
opaqueAllocationHandleRequired=true
realDirectoryCreated=false
realFilesystemAccessed=false
hostPathIncluded=false
callerPathAccepted=false
sourceBundleMutated=false
```

The allocation handle is canonical and path-independent:

```text
k6root-handle-<20 lowercase hex>
```

It is not an absolute path and cannot be supplied by a caller.

## Exact artifact resolution boundary

Only the accepted P1 descriptor can be resolved:

```text
descriptorId=k6-output-summary-json
artifactKind=k6-run-summary-json
relativePath=outputs/summary.json
regularFileRequired=true
symbolicLinkAllowed=false
hardLinkAllowed=false
specialFileAllowed=false
```

Resolution returns only:

```text
artifactHandle=k6artifact-handle-<20 lowercase hex>
resolved=true
opaqueHandleReturned=true
regularFileVerified=false
objectOpened=false
fileRead=false
fileWritten=false
realFilesystemAccessed=false
hostPathIncluded=false
```

P2 does not claim that a host object exists or is a regular file. Those checks
belong to a separately authorized effectful port and the later bounded
collector.

## Identity and immutability

Every P2 product binds:

- the accepted P1 root contract ID and digest;
- the exact artifact descriptor digest;
- the injected port digest;
- the preceding request and receipt digest;
- the opaque allocation and artifact handle identities.

The P1 root contract, Runtime Evidence, Source Bundle and Invocation Plan remain
unchanged. P2 creates new append-only Evidence rather than rewriting any
predecessor.

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
   - collect only exact contract-declared regular files from a sealed root;
   - enforce path, object, size, count, encoding, parser and time bounds;
   - preserve Source Bundle immutability.
5. **P4 — Fault, security and compatibility acceptance**
   - adversarial path, link, race and resource testing;
   - Linux baseline and explicit portability claim;
   - permanent Evidence and Artifact.
6. **G1–G4 — Formal acceptance and exact-main closure**
   - full-scope audit, conditional ordinary Merge Commit and permanent
     exact-main verification.

Only P2 is implemented in this branch. P3 and later slices remain frozen.

## P2 non-goals

```text
realFilesystemPortImplemented=false
outputDirectoryCreated=false
hostPathResolved=false
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

Node.js 22 remains the baseline. Node.js 24 is used only for fake-only
compatibility comparison. No real filesystem, process or target system is
accessed in CI.

```text
platformCompatibility=linux
windowsCompatibilityClaimed=false
macosCompatibilityClaimed=false
securityDashboardsEnumerable=false
zeroAlertClaimMade=false
```

## P2 stop condition

After naturally triggered exact-Head CI and independent Artifact audit, P2 may
stop at:

```text
m3R4P2ImplementationComplete=true
m3R4P2FakeOnlyPortBoundaryComplete=true
m3R4P2ExactHeadAcceptanceComplete=true
m3R4P2ArtifactIndependentlyVerified=true
m3R4P2ReadyMarked=false
m3R4P2Merged=false
m3R4P3Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R4-P3
```

P2 completion does not authorize Ready, merge, a real filesystem adapter, file
opening, result collection or P3 implementation.
