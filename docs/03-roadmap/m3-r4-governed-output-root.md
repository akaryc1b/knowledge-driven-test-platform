# M3-R4 — Governed Output Root and Bounded File Result Collection

## Status

```text
slice=M3-R4-R0
issue=77
baselineMain=6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa
m3R3FinalClosureReverified=true
m3R4Started=true
m3R4R0Started=true
m3R4ProductImplementationStarted=false
```

M3-R4 begins only after M3-R3 completed its ordinary Merge Commit chain and exact-main permanent closure. R0 freezes the trust boundary for a future writable output root. It does not create a directory, change the Invocation Plan, collect a file, or add a runtime API.

## Accepted predecessor

```text
m3R3FinalMain=6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa
m3R3FinalManifestRun=31151845526
m3R3FinalManifestValidationJob=92782938227
m3R3FinalManifestReportJob=92783043149
m3R3FinalManifestArtifact=8983613200
m3R3FinalManifestArtifactDigest=sha256:579b91ef2219245ea6020ad5767cab23f10297d6fd60aa3310ba18c771a08868
m3R3FinalManifestCanonicalEvidenceDigest=65579189cf11a930f621333824219faa9e5ca11516041ab7188ed68b11ab6990
```

The M3-R3 Source Bundle remains immutable. Its accepted result decision remains:

```text
governedOutputRootDefined=false
governedOutputRootImplemented=false
fileResultCollectionSupported=false
fileResultCollectionImplemented=false
fileResultCollectionDecision=DEFERRED_GOVERNED_OUTPUT_ROOT_REQUIRED
fileResultCollectionBlocker=governed-output-root-not-defined
sourceBundleRemainsImmutable=true
callerPathAccepted=false
arbitraryFileReadEnabled=false
```

## R0 boundary freeze

A later output-root design must satisfy all of the following before any filesystem implementation is authorized:

1. the platform, not the caller, owns allocation and lifecycle;
2. the writable root is distinct from the immutable Source Bundle, repository checkout, process home and arbitrary host directories;
3. public identity binds a logical contract and canonical digest, never an absolute host path;
4. every collected object is selected through a versioned relative-path and artifact-type allow-list;
5. traversal, absolute paths, URI-like paths, backslashes, NUL bytes, symlinks, special files and path collisions fail closed;
6. collection is bounded by file count, per-file bytes, aggregate bytes, parsing depth and time;
7. validation and reading must close time-of-check/time-of-use replacement opportunities;
8. output creation, process launch, terminal observation, collection, sealing, retention and cleanup have an explicit ordered lifecycle;
9. stale output, cross-execution reuse and partial writes cannot be promoted to current immutable Evidence;
10. public Evidence exposes digests, enums and bounded metadata only, never host paths, raw stdout, raw stderr, numeric PID or credential material.

R0 records these as requirements. It implements none of them.

## Ordered safe slices

1. **R0 — Rebaseline and boundary freeze**
   - bind exact M3-R3 final-main Evidence;
   - freeze ownership, path, identity, lifecycle, limits, failure and audit requirements;
   - add roadmap, ADR, matrix, threat model, handoff and static boundary test;
   - stop at Draft PR exact-Head acceptance.
2. **P1 — Versioned output-root contracts**
   - pure-data contracts and closed Schemas only;
   - no directory allocation, file read or process change;
   - bind logical root identity, artifact descriptors, limits and lifecycle states.
3. **P2 — Injected trusted root port**
   - define allocator/resolver behavior behind an injected port;
   - use fakes for acceptance until a later slice explicitly authorizes filesystem effects;
   - keep caller paths and absolute paths private or rejected.
4. **P3 — Bounded result collector**
   - collect only contract-declared regular files from a sealed root;
   - enforce path, link, type, size, count, encoding and parser bounds;
   - preserve Source Bundle immutability.
5. **P4 — Fault, security and compatibility acceptance**
   - adversarial path and race testing;
   - Linux baseline and explicit portability claim;
   - permanent Evidence and Artifact.
6. **G1–G4 — Formal acceptance and exact-main closure**
   - full-scope audit, conditional ordinary Merge Commit and permanent exact-main verification.

Only R0 is authorized now. P1 and later slices remain frozen until a separate instruction names the accepted R0 Head.

## R0 non-goals

```text
newRuntimeCapabilityAdded=false
governedOutputRootDefined=false
governedOutputRootImplemented=false
outputDirectoryCreated=false
outputDirectoryAcceptedFromCaller=false
fileResultCollectionSupported=false
fileResultCollectionImplemented=false
arbitraryFileReadEnabled=false
sourceBundleModified=false
invocationPlanModified=false
nodeProcessAdapterModified=false
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

Node.js 22 remains the baseline. Any Node.js 24 use remains fake-only compatibility validation. The accepted runtime compatibility claim remains Linux until later evidence proves more.

```text
platformCompatibility=linux
windowsCompatibilityClaimed=false
macosCompatibilityClaimed=false
securityDashboardsEnumerable=false
zeroAlertClaimMade=false
```

## R0 stop condition

The implementation must stop at:

```text
m3R4R0ImplementationComplete=true
m3R4R0BoundaryFreezeComplete=true
m3R4R0ExactHeadAcceptanceComplete=true
m3R4R0ReadyMarked=false
m3R4R0Merged=false
m3R4P1Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R4-P1
```

R0 completion is not authorization to mark Ready or merge.
