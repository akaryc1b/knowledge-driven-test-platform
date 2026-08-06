# M3-R3-G1 Formal Acceptance — Development Handoff

## Entry state

```text
parentIssue=50
p4Issue=67
g1Issue=69
pullRequest=68
baseMain=8684836233837c905e0ced20e8eac2cfd0b43601
acceptedP4Head=e98357109bfc71f013c6f1af83a06a4358a1f922
acceptedP4Run=30997032758
acceptedP4Job=92276484278
acceptedP4Artifact=8926613070
acceptedP4ArtifactApiDigest=sha256:2b4964b535ffe8dbc4ff49d2d648f558f8a6c8288a5c8a0124e588a0619ab620
acceptedP4DownloadedZipSha256=2b4964b535ffe8dbc4ff49d2d648f558f8a6c8288a5c8a0124e588a0619ab620
acceptedP4CanonicalEvidenceDigest=545598fd64f9907db51e1683b5de72623e4575ad05fe530f806fbfba1b7cbfb6
acceptedP4SchemaCatalogDigest=9fa80d60a744d4c99485596d8a0d89deb7da0a3e67408b21c87236a6cc414de6
acceptedCompatibilityProductDigest=9bf593893d370448ece828710969eb3b838951ae6e4df5a82c462b1b23d739dd
```

The accepted P4 Artifact was independently downloaded before G1 started. Its 23
entries, API/downloaded ZIP digest equality, closed Evidence Schema, canonical
Evidence digest, Schema Catalog digest, UTF-8 boundary, path safety, collision
safety and credential-shaped scan were all rechecked.

G1 does not rewrite that predecessor Evidence. The P4 Workflow may rerun on a
later G1 Head as a historical predecessor validator; its `nextRequiredSlice`
continues to describe the P4 contract, while the separate G1 Evidence advances
only the governance sequence.

## G1 scope

G1 performs only:

- final `main`, exact-Head, ahead/behind and mergeability rebaseline;
- complete PR path-manifest audit;
- permanent Validator-chain continuity audit;
- accepted P4 Run/Job/Artifact/digest binding;
- Node.js 22 baseline and fake-only Node.js 24 compatibility confirmation;
- append-only handoff, formal acceptance, release and index records;
- a separate G1 Evidence Schema, Validator, read-only Workflow and Artifact.

No runtime product capability is added. The only production-source correction in
the entire PR remains the previously accepted resolver path hardening commit
`196c0cb66344af568b7767ff578c402d817ddd57`.

## Safety boundary

```text
newRuntimeCapabilityAdded=false
realProcessStartedInCi=false
processIdCreatedInCi=false
signalSentInCi=false
k6InvokedInCi=false
xk6InvokedInCi=false
playwrightInvokedInCi=false
externalProcessExecutedInCi=false
governedOutputRootImplemented=false
fileResultCollectionImplemented=false
sourceBundleRemainsImmutable=true
callerPathAccepted=false
arbitraryFileReadEnabled=false
workerAdded=false
queueAdded=false
schedulerAdded=false
containerStarted=false
kubernetesResourceCreated=false
remoteExecutionApiAdded=false
allureImplemented=false
```

## G1 stop control

G1 is accepted only after a naturally triggered exact-Head G1 Workflow, Artifact
upload, independent download audit, review/thread recheck and permanent comments.

```text
g1Complete=true
g1ExactHeadAcceptanceComplete=true
g1ArtifactVerificationComplete=true
rootValidatorIncludesG1=true
readyMarked=false
merged=false
g2Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-G2
```

G2, Ready and Merge remain separately authorized actions.
