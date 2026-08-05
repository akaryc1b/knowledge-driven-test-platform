# M3-R3-P4 Exact-Head Acceptance Record

## Record binding

```text
recordBinding=workflow-generated-exact-head
p4BaseMain=8684836233837c905e0ced20e8eac2cfd0b43601
p4Issue=67
p4Pr=68
prState=open
prDraft=true
prMerged=false
```

A repository file cannot safely hard-code the SHA of the commit that contains itself. Therefore the natural P4 Workflow binds the authoritative 40-character Head SHA, branch, real test counts, product digest and canonical Evidence digest into:

```text
evidence/m3-r3-p4-fault-security-compatibility-evidence.json
```

That Evidence is validated against the closed P4 Schema and included in the path-preserving Artifact. GitHub Issue and PR comments record the final Run, Job, Artifact and independent download audit.

## Exact acceptance requirements

The accepted natural Run must prove:

```text
checkedOutExactEventHead=true
cleanTree=true
node22BaselineAccepted=true
node24CompatibilityAccepted=true
crossNodeProductDigestEqual=true
focusedTestsPassed=true
allK6ApiAdapterTestsPassed=true
fullNodeTestsPassed=true
rootRepositoryValidatorPassed=true
p4ValidatorPassed=true
predecessorValidatorsPassed=true
evidenceSchemaErrors=0
canonicalEvidenceDigestRecomputed=true
schemaCatalogDigestRecomputed=true
tapCountsMatchEvidence=true
artifactAllowlistEntries=23
credentialShapedMatches=0
```

The independently downloaded ZIP must prove:

```text
missingEntries=0
unexpectedEntries=0
regularFilesOnly=true
pathTraversalEntries=0
absolutePathEntries=0
drivePathEntries=0
uncPathEntries=0
nulPathEntries=0
symlinkEntries=0
specialFileEntries=0
unicodeNormalizationCollisions=0
caseFoldCollisions=0
allUtf8=true
credentialShapedMatches=0
```

Artifact API digest, upload-layer ZIP digest, independent ZIP SHA-256, Evidence JSON SHA-256, individual file digests, canonical Evidence digest and Schema Catalog digest remain distinct recorded values.

## Fault and security findings

```text
existingRuntimeDefectsFound=2
existingRuntimeDefectsClosed=2
encodedTraversalResolverBypass=CLOSED
backslashTraversalResolverBypass=CLOSED
correctionCommit=196c0cb66344af568b7767ff578c402d817ddd57
repositoryBlockers=[]
```

## CI safety boundary

```text
nodeProcessAdapterImplemented=true
realProcessStartedInCi=false
processIdCreatedInCi=false
signalSentInCi=false
k6InvokedInCi=false
xk6InvokedInCi=false
playwrightInvokedInCi=false
externalProcessExecutedInCi=false
targetNetworkAccessed=false
databaseAccessed=false
secretAccessed=false
filesystemCredentialAccessed=false
rawRuntimeOutputCollected=false
stdoutCollected=false
stderrCollected=false
numericProcessIdExposed=false
arbitraryFileReadEnabled=false
callerPathAccepted=false
sourceBundleModified=false
governedOutputRootImplemented=false
fileResultCollectionImplemented=false
allureImplemented=false
workerAdded=false
queueAdded=false
schedulerAdded=false
containerStarted=false
kubernetesResourceCreated=false
remoteExecutionApiAdded=false
m3R3G1Started=false
```

## Review and dashboard condition

```text
reviewsWithRequestChanges=0
unresolvedActionableReviewThreads=0
securityDashboardEnumerationAvailable=false
zeroAlertClaimMade=false
```

The review counts are confirmed from GitHub immediately after the final exact-Head Run rather than guessed in static Evidence.

## Merge control and stop point

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

This record does not authorize Ready, auto-merge or Merge. G1 requires separate authorization.
