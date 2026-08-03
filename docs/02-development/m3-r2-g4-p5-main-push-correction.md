# M3-R2-G4 P5 Exact-Main Push Correction

## Purpose

This additive correction closes the post-merge verification blocker discovered after PR #46 was merged with an ordinary Merge Commit.

```text
sourcePr=46
acceptedSourceHead=4841ee7268b17fbf67bc0c5dcf2de8d11e4d8b6f
firstMergeSha=9d584af244f203d9232cd6df6c35ca1346901e12
observerPr=47
observerRun=30818838369
observerArtifactId=8857977107
observerArtifactApiDigest=sha256:ec3317ea4aed45168a3e9d10a49f0e9bde377f8fbc1dd20d9e4c1f51989deeb4
```

The read-only Observer found nine successful exact-main natural-push Workflows and one missing Workflow:

```text
missingRequiredWorkflow=m3-r2-p5-source-generation-acceptance
incompleteRequiredWorkflows=[]
failedRequiredWorkflows=[]
```

## Root cause

`.github/workflows/m3-r2-p5-source-generation-acceptance.yml` defined `pull_request` and `workflow_dispatch`, but did not define `push` for `main`. Therefore the first merge SHA could not produce a natural exact-main P5 acceptance Run or main-bound P5 Evidence and PostgreSQL Artifacts.

## Minimal correction

1. Add `push: branches: [main]` with the same governed path set as the PR trigger.
2. Require the P5 Repository Validator to reject a Workflow that lacks the exact-main push trigger.
3. Add a focused tamper test proving that removing the trigger fails closed.
4. Keep the existing P5 tests, Evidence generation, Artifact upload, read-only permissions and non-execution safety boundary unchanged.

## Explicit exclusions

This correction does not add or invoke k6, xk6 or Playwright; does not execute generated Source; does not access target networks, databases, Secrets or credential files; does not publish remotely; and does not add Worker, Queue, Scheduler, container or Kubernetes execution resources.

```text
sourceExecuted=false
executionRuntimeStarted=false
k6Invoked=false
xk6Invoked=false
playwrightInvoked=false
remoteArtifactPublished=false
workerAdded=false
queueAdded=false
schedulerAdded=false
m3R3Started=false
```

## Merge control

The correction must be developed and permanently validated in an independent Draft PR. It must not be merged without a separate user authorization naming that PR and its exact 40-character Head SHA. Only an ordinary Merge Commit is permitted.

```text
nextRequiredSlice=M3-R2-G4-correction-validation
```
