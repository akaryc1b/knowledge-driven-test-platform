# M3-R4-P3 Bounded Result Collector Acceptance

## Acceptance target

This record defines the permanent acceptance obligations for Issue #83. It does
not claim exact-Head acceptance. Final Run, Job, Artifact and digest identities
must come from natural Pull Request CI and an independently downloaded ZIP.

## Accepted predecessor

```text
p2Issue=81
p2PullRequest=82
p2AcceptedHead=b66f223cc4453da4cab4af4df2676327aaa4bd76
p2NaturalWorkflowCount=18
p2NaturalWorkflowSuccess=18
p2ArtifactId=9099506980
p2ArtifactRun=31486998071
p2ArtifactJob=93764560325
p2ArtifactApiDigest=sha256:2775d56a5a9dc66847e6e9239a1c4271fc0ebf7476d43b414e2b324b1f4d8e44
p2CanonicalEvidenceDigest=b431b64406700b13a63464c4cb67c5bfabd973a452c45ce777f1ab7477cfefed
p2SchemaCatalogDigest=f65d9d76e8937900ad10e862dfda1ec987ee88bcfedcc8aa265d87caa3ca0216
```

## Exact scope obligations

Acceptance must prove the exact changed-path set contains only:

- the P3 injected collector module family and export;
- focused fake-only tests and helper;
- nine closed Draft 2020-12 Schemas and Catalog;
- permanent Validator and read-only Workflow;
- root validation-chain binding;
- bounded roadmap, handoff, acceptance, release and index records;
- the R0 anti-escalation test update required to recognize the P3 fake-only
  module while continuing to reject a concrete host filesystem implementation.

No unrelated runtime, deployment, database or service path is permitted.

## Product obligations

```text
logicalSealSupported=true
exactArtifactInspectionSupported=true
transientPayloadVerificationSupported=true
boundedJsonResultCollected=true
realFilesystemCollectorImplemented=false
realHostFileReadPerformed=false
rawPayloadPersisted=false
rawPayloadIncludedInEvidence=false
sourceBundleRemainsImmutable=true
```

The product must reject all receipt and payload substitutions after full
self-redigestion.

## Test obligations

```text
focusedNode22Failed=0
focusedNode24Failed=0
k6ApiAdapterFailed=0
fullNodeFailed=0
repositoryValidator=success
node22Node24CompatibilityProductMatched=true
```

Focused coverage must include:

- deterministic products and deep freeze;
- exact P2 digest-chain binding;
- adjacent seal and collection lifecycle states;
- object type and link-policy failures;
- byte, aggregate and duration limits;
- malformed UTF-8 and BOM rejection;
- duplicate-key and depth rejection;
- stale P2 and digest substitution rejection;
- raw-payload, host-path, PID and credential non-disclosure;
- absence of host filesystem/process/environment primitives.

## Artifact obligations

The permanent Artifact must include the P3 contract sources, index export,
Schema Catalog, all nine Schemas, exact-Head Evidence, exact test results and a
path-preserving manifest.

```text
artifactExpired=false
apiDigestMatchesDownloadedZip=true
expectedPathsMatchActual=true
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
compatibilityProductDigestCrossMatched=true
```

## Review and merge gate

```text
changesRequestedReviewCount=0
unresolvedActionableThreadCount=0
unresolvedActionableConversationFindingCount=0
mergeable=true
readyMarked=false
mergeAttempted=false
merged=false
```

P3 exact-Head acceptance does not authorize P4, Ready or merge.
