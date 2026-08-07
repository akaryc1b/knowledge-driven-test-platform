# M3-R3 G4 C2 Final Exact-Main Natural Workflow Manifest

## Purpose

Issue #75 authorizes one append-only governance correction after Observer PR #74 merged at `cdecd4e28cc9426b41c7f21d6fcd319f9ab8b3f9`.

The accepted Observer Head is `e67ec1f8e63b7ba2332bbe41ba40b453326b5985`. Its authoritative natural Pull Request Workflow set contains 15 successful attempt-1 Runs. The remaining defect is not a product defect and is not a failed validation Run: the Observer exact-main self-report did not permanently enumerate every sibling natural `push(main)` Workflow bound to its exact main SHA.

## Corrected predecessor identity

```text
observerPullRequest=74
observerHead=e67ec1f8e63b7ba2332bbe41ba40b453326b5985
observerMerge=cdecd4e28cc9426b41c7f21d6fcd319f9ab8b3f9
observerExactMainRun=31145384797
observerExactMainValidationJob=92763605254
observerExactMainReportJob=92763675300
observerExactMainArtifact=8981282157
observerExactMainArtifactApiDigest=sha256:e51c5b6f7918e2e7077f1b71bee19ad70907bcfa1d4f06794d55e0811f9cbea8
observerExactMainCanonicalEvidenceDigest=04412a6b1569cdbfb004203c3d2d12d46bd1c2645846233b95304bb1873a25df
```

The prior P4, G1, correction and Observer Evidence remains unchanged.

## Collector contract

The branch is:

```text
agent/m3-r3-g4-final-main-run-manifest-cdecd4e
```

The permanent collector:

1. validates a closed Draft 2020-12 Evidence contract on the exact Draft PR Head;
2. derives mandatory Workflow names from all completed natural `pull_request` Runs on the merged PR Head;
3. verifies an ordinary two-parent Merge Commit whose first parent is the Observer Merge and whose second parent is the accepted C2 Head;
4. polls the new exact `push(main)` SHA until every mandatory Workflow is present;
5. rejects duplicate Workflow names, incomplete pagination, attempts other than `1`, failed sibling Runs and failed sibling Jobs;
6. records any additional successful push-only Workflow;
7. permits only the collector's current `report-final-main-run-manifest` Job to be queued or in progress while the Artifact is produced;
8. publishes a path-preserving permanent Artifact and appends a provisional self-report to Issues #75 and #71;
9. requires external verification that the report Job completed successfully and an independent ZIP audit before closure.

The Evidence intentionally keeps `finalClosureEligible=false` while the report Job is self-observed in progress. Final closure is an external append-only decision after the Job and Artifact are independently re-read.

## Failure classification

```text
failureClassification=evidenceCompletenessDefect/exactMainRunSetNotPersisted
productDefect=false
testDefect=false
runtimeCapabilityDefect=false
historicalEvidenceRewritten=false
manualRerunPerformed=false
```

## Safety boundary

```text
k6Invoked=false
xk6Invoked=false
playwrightInvoked=false
externalProcessExecuted=false
targetNetworkAccessed=false
databaseAccessed=false
secretAccessed=false
filesystemCredentialAccessed=false
rawStdoutCollected=false
rawStderrCollected=false
numericProcessIdExposed=false
sourceBundleModified=false
governedOutputRootImplemented=false
fileResultCollectionImplemented=false
workerAdded=false
queueAdded=false
schedulerAdded=false
containerStarted=false
kubernetesResourceCreated=false
remoteExecutionApiAdded=false
allureImplemented=false
```

No workflow rerun, manual dispatch, force push, amend, squash merge, rebase merge or direct push to `main` is authorized.
