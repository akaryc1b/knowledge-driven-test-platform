# M3-R4-R0 Governed Output Root Rebaseline — Development Handoff

## Current controlled state

```text
repository=akaryc1b/knowledge-driven-test-platform
issue=77
branch=agent/m3-r4-r0-governed-output-root-rebaseline-6737436
baseMain=6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa
m3R3FinalClosureReverified=true
m3R4Started=true
m3R4R0Started=true
m3R4ProductImplementationStarted=false
readyMarked=false
merged=false
```

The branch was created from exact `main@6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa` after confirming there were no open Issues, Pull Requests or competing M3-R4 branches.

## Accepted predecessor Evidence

```text
finalManifestRun=31151845526
finalManifestValidationJob=92782938227
finalManifestReportJob=92783043149
finalManifestArtifact=8983613200
finalManifestArtifactName=m3-r3-g4-final-main-run-manifest-evidence
finalManifestArtifactHeadSha=6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa
finalManifestArtifactSizeBytes=37971
finalManifestArtifactExpired=false
finalManifestArtifactApiDigest=sha256:579b91ef2219245ea6020ad5767cab23f10297d6fd60aa3310ba18c771a08868
finalManifestDownloadedZipSha256=579b91ef2219245ea6020ad5767cab23f10297d6fd60aa3310ba18c771a08868
finalManifestCanonicalEvidenceDigest=65579189cf11a930f621333824219faa9e5ca11516041ab7188ed68b11ab6990
```

R0 never rewrites this Evidence.

## R0 deliverables

- `docs/03-roadmap/m3-r4-governed-output-root.md`
- `docs/04-governance/m3-r4-r0-governed-output-root-boundary-matrix.md`
- `docs/06-security/m3-r4-r0-governed-output-root-threat-model.md`
- `docs/05-adr/ADR-0035-governed-output-root-contract-first.md`
- `docs/02-development/m3-r4-r0-governed-output-root-handoff.md`
- `docs/m3-r4-r0-index.md`
- `packages/k6-api-adapter/test/m3-r4-r0-governed-output-root-boundary.test.js`
- update to `docs/03-roadmap/roadmap.md`

No production source, Schema, Workflow or package script is added by R0.

## Frozen decisions

```text
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
newRuntimeCapabilityAdded=false
```

The matrix and threat model are normative inputs for later design. A later slice must not weaken them without a new ADR and explicit acceptance.

## Required validation

1. run the focused R0 static boundary test;
2. run all k6 API Adapter tests;
3. run the complete Node.js test suite;
4. run the root Repository Validator;
5. use naturally triggered Pull Request Workflows only;
6. retain every failed Run and use a new append-only commit for any correction;
7. re-read reviews, threads, changed paths and mergeability before exact-Head acceptance.

Node.js 22 remains the baseline. Node.js 24 may be used only for fake-only compatibility checks already present in the repository.

## Prohibited actions

- create or accept an output directory;
- modify the Source Bundle, Invocation Plan or Node process adapter;
- read result files or scan a filesystem tree;
- invoke k6, xk6 or Playwright;
- start a real external process in CI;
- access target network, database, Secrets or credential files;
- collect raw stdout or stderr;
- add Worker, Queue, Scheduler, container, Kubernetes, remote execution API or Allure;
- mark Ready, merge, rerun Workflows, amend, force push or rewrite history.

## R0 stop point

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

R0 completion authorizes only a later, separately instructed P1 contract slice.
