# M3-R3 Final Main Closure Observer

## Purpose

This additive, governance-only Observer is authorized by Issue #71. It follows the formal source merge and the independent post-merge correction. It does not rewrite accepted P4/G1 Evidence and does not add runtime product capability.

## Immutable predecessor chain

```text
sourcePullRequest=68
sourceBase=8684836233837c905e0ced20e8eac2cfd0b43601
sourceHead=3bcdab12e8fcea909ca6aa8479bac6a69b545747
sourceMerge=583e848a289a6fff2e2d2c4052002125b47bb853

correctionPullRequest=73
correctionBase=583e848a289a6fff2e2d2c4052002125b47bb853
correctionHead=d55d3483064e38bb0c7853a6d57729fa97c48070
correctionMerge=c34c9e8234713f109bc98ff3b7ed663066083875

observerBranch=agent/m3-r3-final-main-observer-583e848
```

The Observer verifies both Merge Commit parent arrays through GitHub's read-only commit API. It queries exact natural `push(main)` Runs by `head_sha`, requires the accepted Workflow names and attempt `1`, preserves the source Merge `validation` failure as `staleMainPushAssumption/workflowDefect`, requires all other source Runs to succeed, and requires every correction exact-main Run and Job to succeed. It rejects missing, duplicate, unexpected, incomplete, or rerun observations.


## Preserved source-main failure

```text
sourceMerge=583e848a289a6fff2e2d2c4052002125b47bb853
workflow=validation
expectedConclusion=failure
classification=staleMainPushAssumption/workflowDefect
historicalFailurePreserved=true
correctedByPullRequest=73
correctedByHead=d55d3483064e38bb0c7853a6d57729fa97c48070
correctedByMerge=c34c9e8234713f109bc98ff3b7ed663066083875
manualRerunPerformed=false
```

This is not promoted to success. The final closure chain records the exact failed Run and Job identities, then proves closure through the successful correction exact-main natural Workflow set.

## Permanent bindings

The Evidence binds:

- the source Merge exact-main G1 Run and Artifact;
- the correction Merge exact-main C1 Run and Artifact;
- accepted P4/G1 canonical Evidence and Schema Catalog digests;
- G1 scope-manifest and cross-Node compatibility digests;
- correction PR exact-Head canonical Evidence and Artifact digest;
- the Observer event, exact commit, Run ID, attempt, and path-preserving Artifact layout.

The natural final `push(main)` Workflow appends its Run, validation Job, Artifact and Evidence identities to Issue #71 with a push-only `issues: write` permission. Independent download and ZIP audit remain required before Issue closure, preventing circular self-acceptance.

## Event semantics

On `pull_request`, the Observer requires a Draft PR based on `c34c9e8234713f109bc98ff3b7ed663066083875`, keeps `observerMerged=false`, and authorizes only Ready plus an ordinary Merge Commit after all natural checks and independent Artifact audit pass.

On natural `push(main)`, the Observer requires first parent `c34c9e8234713f109bc98ff3b7ed663066083875` and second parent equal to the accepted Observer Head. Only post-merge Evidence may set `observerMerged=true` and `finalClosureEligible=true`.

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
