# M3-R3-P1 Development Handoff

## Accepted baseline

```text
baselineMain=99b1de75f325c46f84259bb21bc1de0ad45adb14
acceptedR0Pr=56
acceptedR0SourceHead=cb396959b2fe22fc3bf8afe5968d7ee439947a5b
acceptedR0MergeSha=99b1de75f325c46f84259bb21bc1de0ad45adb14
acceptedR0MainBoundRun=30876457794
acceptedR0MainBoundArtifact=8879700536
acceptedR0CanonicalEvidenceDigest=3b75c3229057898946eb37bf9f8f1735ef219d85f56cd9f9fd834492eaadf422
```

M3-R3-R0 is formally closed. P1 consumes only the accepted Runtime Policy, Runtime Admission Request, Invocation Plan and Admission Evidence digests.

## Delivered boundary

M3-R3-P1 adds five versioned contracts:

1. `k6-local-process-port/v1` — an injected, non-executing port descriptor;
2. `k6-process-launch-specification/v1` — fixed `k6`, argv-array-only, shell-free launch intent;
3. `k6-process-launch-decision/v1` — a receipt-bound, fail-closed delegation decision;
4. `k6-process-boundary-evidence/v1` — deterministic product Evidence;
5. `m3-r3-local-process-boundary-p1-evidence/v1` — permanent repository acceptance Evidence.

The Adapter calls only an injected `acceptLaunchSpecification` method. The accepted fake/in-memory port returns a deterministic receipt and is forbidden from claiming a process start, PID, k6 invocation or external execution.

## P1 safety state

```text
localProcessPortContractReady=true
launchSpecificationReady=true
launchAdapterBoundaryReady=true
nodeProcessAdapterImplemented=false
processStarted=false
processIdCreated=false
k6Invoked=false
xk6Invoked=false
playwrightInvoked=false
externalProcessExecuted=false
shellUsed=false
targetNetworkAccessed=false
databaseAccessed=false
secretAccessed=false
runtimeResultCollected=false
workerAdded=false
queueAdded=false
schedulerAdded=false
containerStarted=false
kubernetesResourceCreated=false
remoteExecutionApiAdded=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-P2
```

## Next-slice control

P2 may implement a real Node process adapter, PID lifecycle, timeout, signal and cancellation only after this Draft PR receives a later exact-Head merge authorization and completes post-merge exact-main acceptance. This handoff does not authorize P2.

```text
p2Authorized=false
readyTransitionAuthorized=false
mergeTransitionAuthorized=false
```
