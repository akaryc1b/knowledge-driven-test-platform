# M3-R3-G4-C1 Historical Evidence and Closed-Schema Correction

## Binding

```text
issue=72
sourcePullRequest=68
sourceHead=3bcdab12e8fcea909ca6aa8479bac6a69b545747
sourceMergeSha=583e848a289a6fff2e2d2c4052002125b47bb853
correctionBranch=agent/m3-r3-g4-p4-evidence-correction-583e848
reviewThreadA=PRRT_kwDOTkiSCc6W20yK
reviewThreadB=PRRT_kwDOTkiSCc6W20yO
```

## Corrections

The immutable P4 Evidence contract is emitted only for accepted P4 Head
`e98357109bfc71f013c6f1af83a06a4358a1f922`. Later matching Heads still run the
complete P4 validation and compatibility gates but do not upload a newly bound
historical P4 Artifact.

The immutable G1 Evidence contract is emitted only for accepted G1 Head
`3bcdab12e8fcea909ca6aa8479bac6a69b545747` and its exact source Merge replay
`583e848a289a6fff2e2d2c4052002125b47bb853`. Later matching Heads run the G1
validation chain in validation-only mode without applying the historical
45-path/base assertion to an unrelated correction diff.

P4 and G1 reconstructed or downloaded Evidence is now validated against every
keyword used by the supplied closed Draft 2020-12 Schema before its canonical
digest is accepted. Unsupported Schema keywords and non-local references fail
closed. Mutation tests cover nested `const`, nested `additionalProperties`,
local `$ref`, `uniqueItems`, and `date-time` constraints.

## Preservation and boundary

```text
p4EvidenceRewritten=false
g1EvidenceRewritten=false
historicalRunsDeleted=false
manualRerunPerformed=false
historyRewritten=false
forcePushUsed=false
newRuntimeCapabilityAdded=false
k6Invoked=false
xk6Invoked=false
playwrightInvoked=false
externalProcessExecuted=false
sourceBundleModified=false
governedOutputRootImplemented=false
fileResultCollectionImplemented=false
workerAdded=false
queueAdded=false
schedulerAdded=false
containerExecutionAdded=false
kubernetesExecutionAdded=false
remoteExecutionApiAdded=false
allureImplemented=false
```

The correction-specific Workflow produces a separate exact-Head Artifact. It
records only the correction contract and does not reinterpret historical P4 or
G1 decision fields as current GitHub state.

```text
correctionComplete=true
finalG4Complete=false
nextRequiredAction=independent-review-and-g4-reverification
```
