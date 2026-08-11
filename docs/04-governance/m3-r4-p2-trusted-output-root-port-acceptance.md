# M3-R4-P2 Trusted Output-Root Port Acceptance

## Acceptance target

This record defines the permanent acceptance obligations for Issue #81. It does
not itself claim exact-Head acceptance; the final values must come from natural
CI and an independently downloaded Artifact.

## Accepted predecessor

```text
p1Issue=79
p1PullRequest=80
p1AcceptedHead=3f0459700e5d7e651011f8addeda8e8164a0ccbc
p1NaturalWorkflowCount=17
p1NaturalWorkflowSuccess=17
p1ArtifactId=9097350510
p1ArtifactRun=31481359612
p1ArtifactApiDigest=sha256:99b6a309b3c335d869d21187538285318b57daacc2df78973eb7d422fa2bd84a
p1CanonicalEvidenceDigest=9d46327e75671673a9a1cb75beb122135a54eb2508433ebc55ef255aae86fc68
p1SchemaCatalogDigest=09a782340e4a8ff0d0335445433ebad9b5a5464c4f654930f964677f618c67bb
p1EvidenceRewritten=false
```

## Product acceptance

The accepted P2 product must prove:

```text
trustedOutputRootPortReady=true
logicalRootAllocationSupported=true
logicalRootAllocated=true
exactArtifactResolutionSupported=true
exactArtifactResolved=true
realFilesystemPortImplemented=false
outputDirectoryCreated=false
fileResultCollectionSupported=false
fileResultCollectionImplemented=false
nextRequiredSlice=M3-R4-P3
repositoryBlockers=[]
```

Every public product must be closed, deterministic, deeply frozen and bound to
the exact P1 root contract and descriptor digests.

## Security acceptance

The independent audit must establish:

```text
callerPathAccepted=false
absolutePathAccepted=false
hostPathIncluded=false
hostPathResolved=false
realDirectoryCreated=false
realFilesystemAccessed=false
fileOpened=false
fileRead=false
fileWritten=false
recursiveDiscoveryPerformed=false
symbolicLinkFollowed=false
hardLinkTrusted=false
specialFileAccepted=false
sourceBundleMutated=false
invocationPlanModified=false
nodeProcessAdapterModified=false
newProcessPrimitiveAdded=false
k6Invoked=false
xk6Invoked=false
playwrightInvoked=false
targetNetworkAccessed=false
databaseAccessed=false
secretAccessed=false
filesystemCredentialAccessed=false
rawStdoutCollected=false
rawStderrCollected=false
numericPidExposed=false
workerAdded=false
queueAdded=false
schedulerAdded=false
containerExecutionAdded=false
kubernetesExecutionAdded=false
remoteExecutionApiAdded=false
allureImplemented=false
m4Started=false
```

## CI and Artifact gate

Required natural CI:

- focused Node.js 22 P2 tests;
- fake-only Node.js 24 tests and compatibility-product comparison;
- all k6 API Adapter tests;
- complete Node.js test suite;
- root Repository Validator;
- exact-Head P2 Evidence generation;
- permanent Artifact assembly and upload.

Independent Artifact checks must include:

```text
artifactExpired=false
apiDigestMatchesDownloadedZip=true
artifactPathCount=13
missingEntries=0
unexpectedEntries=0
unsafePathEntries=0
symlinkEntries=0
specialFileEntries=0
utf8Failures=0
caseFoldCollisions=0
unicodeNormalizationCollisions=0
credentialShapedMatches=0
manifestHashErrors=0
staticExactHeadBlobMismatches=0
evidenceSchemaErrors=0
canonicalEvidenceDigestRecomputed=true
schemaCatalogDigestRecomputed=true
portAndReceiptDigestsRecomputed=true
compatibilityProductDigestCrossMatched=true
```

## Merge control

```text
pullRequestDraft=true
readyMarked=false
mergeAttempted=false
merged=false
manualRerunAllowed=false
historyRewriteAllowed=false
forcePushAllowed=false
```

P2 exact-Head acceptance does not authorize Ready, merge, P3 or any real
filesystem effect.
