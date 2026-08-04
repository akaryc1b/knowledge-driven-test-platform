# M3-R3-P1 Injected Local Process Boundary Roadmap

## Goal

M3-R3-P1 establishes the last non-executing contract boundary before any future local process lifecycle. It translates the accepted M3-R3-R0 Invocation Plan into a deterministic Launch Specification and delegates that specification only to an injected LocalProcessPort.

## Contract flow

```text
accepted Runtime Policy
  + accepted Runtime Admission Request
  + accepted Invocation Plan
  + accepted Admission Evidence
  -> k6-process-launch-specification/v1
  -> injected k6-local-process-port/v1
  -> non-executing receipt
  -> k6-process-launch-decision/v1
  -> k6-process-boundary-evidence/v1
```

The Launch Specification contains no command string, environment value, absolute host path, stdin content, Secret, Target URL or credential URI. It fixes `executable=k6`, copies the accepted argv array, sets `shell=false`, uses a logical immutable-bundle working directory, denies host-environment inheritance and declares bounded-but-uncollected stdout/stderr.

## Fail-closed behavior

P1 rejects missing ports, invalid descriptors, port exceptions, unbound receipts, digest drift, unaccepted Source Bundles, shell fragments, arbitrary working directories, environment escalation and any claim that a process, PID or k6 invocation exists.

## Completion boundary

```text
m3R3P1ImplementationComplete=true
localProcessPortContractReady=true
launchSpecificationReady=true
launchAdapterBoundaryReady=true
nodeProcessAdapterImplemented=false
processStarted=false
processIdCreated=false
k6Invoked=false
externalProcessExecuted=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-P2
```

P1 remains Draft/Open/Unmerged and does not start M3-R3-P2.
