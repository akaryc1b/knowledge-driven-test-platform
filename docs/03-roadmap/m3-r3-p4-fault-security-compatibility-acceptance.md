# M3-R3-P4 — Fault, Security and Compatibility Acceptance

## Status

```text
slice=M3-R3-P4-R0
p4Issue=67
p4BaselineMain=8684836233837c905e0ced20e8eac2cfd0b43601
acceptedP3Main=8684836233837c905e0ced20e8eac2cfd0b43601
p4ProductCapabilityAdded=false
p4ExistingRuntimeBehaviorChanged=false
m3R3G1Started=false
```

This slice accepts, rather than expands, the existing governed local k6 runtime boundary established by M3-R3-R0, P1, P2 and P3. It does not authorize a new execution mode, output root, file-result reader, remote execution API, Worker, Queue, Scheduler, container, Kubernetes resource, Allure integration or UI.

## Reverified predecessor identity

```text
p3Issue=64
p3ImplementationPr=65
p3ImplementationSourceHead=2d573b62aa78e66c7b767e55004ed0e0d41b512d
p3ImplementationMergeSha=e406e82fdb5ffba6ccfa527a1e069675ed39f03b
p3CorrectionPr=66
p3CorrectionSourceHead=dc202168e26f26d08084273cebeb3efd3073c0af
p3CorrectionMergeSha=8684836233837c905e0ced20e8eac2cfd0b43601
p3ExactMainRun=30972073647
p3ExactMainJob=92198391799
p3ExactMainArtifact=8916886644
p3ExactMainArtifactDigest=sha256:03aa6427219be39b0daf771d08a7a604b9a4e4c17ccf9ec314ef3d55f39c74f4
p3CanonicalEvidenceDigest=5420c474aa95840fc216c8ff61de52dfbc4d8d137a10d5233e82d6f6963ab6c7
p3SchemaCatalogDigest=f9eb33758c4ccc9433a613569f3a524759f7f381e307a75b65c49d4a3e925cc0
p3RuntimeExecutionEvidenceDigest=a0bef0eca6a8ec5b02535f0688e14e3a8ca16c2f5fdda746ec14b8f76ab2afd9
```

The accepted historical P3 Artifact is immutable. P4 creates a separate acceptance record and never rewrites P3 evidence.

## Ordered safe slices

1. **R0 — Rebaseline and matrix freeze**
   - reverify current main, P3 closure, permanent evidence availability and competing work;
   - freeze the executable fault, race, security, compatibility and portability matrices;
   - establish the P4 threat-model extension and boundary tests;
   - create Issue #67 and the independent P4 branch;
   - open the implementation PR only after the R0 files and boundary test exist.
2. **P1 — Deterministic fault and lifecycle-race acceptance**
   - use injected fake process, timers, resolver and abort signal only;
   - cover bounded startup, timeout, cooperative cancellation, forced termination and settle-once behavior;
   - make only minimal R0-P3 behavior corrections when a test reproduces a real defect.
3. **P2 — Adversarial security acceptance**
   - prove the single `node:child_process.spawn` primitive and fixed shell-free command boundary;
   - reject identity, digest, environment, sensitive-material, path and evidence substitutions;
   - preserve immutable Source Bundle and file-result deferral.
4. **P3 — Compatibility and determinism acceptance**
   - retain Node.js 22 as the baseline and verify Node.js 24 with fake-only tests;
   - verify public exports, accepted Schema identities, predecessor Validators and byte-stable canonical products;
   - limit the formal platform compatibility claim to Linux unless evidence proves more.
5. **P4 — Permanent evidence and exact-Head readiness**
   - add a closed Draft 2020-12 P4 Acceptance Evidence Schema and independent Validator;
   - run focused, full Adapter, full Node, Node 22 and Node 24 validation;
   - upload an exact path-preserving, credential-scanned Artifact;
   - stop with a Draft/Open/Unmerged PR and no G1 work.

## Frozen safety and capability decisions

```text
p4FaultMatrixFrozen=true
p4SecurityMatrixFrozen=true
p4CompatibilityMatrixFrozen=true
nodeProcessAdapterImplemented=true
realProcessStartedInCi=false
processIdCreatedInCi=false
signalSentInCi=false
k6InvokedInCi=false
externalProcessExecutedInCi=false
governedOutputRootDefined=false
governedOutputRootImplemented=false
fileResultCollectionSupported=false
fileResultCollectionImplemented=false
fileResultCollectionDecision=DEFERRED_GOVERNED_OUTPUT_ROOT_REQUIRED
fileResultCollectionBlocker=governed-output-root-not-defined
sourceBundleRemainsImmutable=true
callerPathAccepted=false
arbitraryFileReadEnabled=false
m3R3G1Started=false
```

## Compatibility claim boundary

The repository declares ESM and `node >=22`. P4 verifies Node.js 22 and Node.js 24 using the same fake-only fixture set. The current runtime signal and filesystem semantics are accepted for Linux only unless later evidence proves another platform.

```text
platformCompatibility=linux
windowsCompatibilityClaimed=false
macosCompatibilityClaimed=false
```

`windowsHide=true` is a spawn option and is not evidence of Windows compatibility.

## Security dashboard visibility

```text
securityDashboardEnumerationAvailable=false
zeroAlertClaimMade=false
```

Dependabot, Code Scanning and Secret Scanning dashboards are not enumerable through the available connector. P4 reports repository-visible findings and review threads, but does not infer a zero-alert state.

## Stop condition

The P4 implementation must stop at:

```text
m3R3P4ImplementationComplete=true
m3R3P4ExactHeadAcceptanceComplete=true
m3R3P4MergeReadinessEvidenceComplete=true
m3R3P4ReadyMarked=false
m3R3P4Merged=false
m3R3G1Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-G1
```

Any unresolved real blocker keeps `nextRequiredSlice=M3-R3-P4` and prevents merge-readiness completion.
