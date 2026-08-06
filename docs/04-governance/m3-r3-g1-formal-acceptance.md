# M3-R3-G1 Final Baseline, Scope and Evidence Consistency Audit

## Purpose

G1 formally audits the complete M3-R3 implementation PR after accepted P4. It
adds no runtime capability and does not authorize Ready or Merge.

## Accepted P4 predecessor

```text
p4BaseMain=8684836233837c905e0ced20e8eac2cfd0b43601
p4Head=e98357109bfc71f013c6f1af83a06a4358a1f922
p4Run=30997032758
p4Job=92276484278
p4Artifact=8926613070
p4ArtifactApiDigest=sha256:2b4964b535ffe8dbc4ff49d2d648f558f8a6c8288a5c8a0124e588a0619ab620
p4DownloadedZipSha256=2b4964b535ffe8dbc4ff49d2d648f558f8a6c8288a5c8a0124e588a0619ab620
p4EvidenceJsonSha256=2db2d56bfeeac7cabf46823af5bd9612a4bd13b8a6ee10e1a3b05c5f40cc4469
p4CanonicalEvidenceDigest=545598fd64f9907db51e1683b5de72623e4575ad05fe530f806fbfba1b7cbfb6
p4SchemaCatalogDigest=9fa80d60a744d4c99485596d8a0d89deb7da0a3e67408b21c87236a6cc414de6
p4CompatibilityProductDigest=9bf593893d370448ece828710969eb3b838951ae6e4df5a82c462b1b23d739dd
p4ArtifactPathCount=23
```

The G1 Validator rejects any substituted predecessor identity even when a forged
G1 document is re-digested.

## Exact-Head requirements

The authoritative G1 natural Run must prove:

```text
checkedOutExactEventHead=true
cleanTreeBeforeValidation=true
fullPrScopeMatchesManifest=true
rootValidatorIncludesG1=true
node22BaselineAccepted=true
node24CompatibilityAccepted=true
crossNodeProductDigestEqual=true
focusedG1TestsPassed=true
allK6ApiAdapterTestsPassed=true
fullNodeTestsPassed=true
rootRepositoryValidatorPassed=true
g1RepositoryValidatorPassed=true
p4PredecessorValidatorPassed=true
evidenceSchemaErrors=0
canonicalEvidenceDigestRecomputed=true
g1SchemaCatalogDigestRecomputed=true
artifactAllowlistEntries=16
credentialShapedMatches=0
cleanTreeAfterValidation=true
```

The independently downloaded Artifact must prove exact API/downloaded ZIP digest
equality, the exact 16-entry allow-list, regular-file-only content, UTF-8,
absence of unsafe paths, symlinks, special files, Unicode/case-fold collisions
and credential-shaped material.

## Scope boundary

The authoritative full PR path list is
`docs/04-governance/m3-r3-g1-scope-manifest.json`. The natural Workflow compares
the Git diff from the exact event base SHA to the exact event Head SHA directly
against that manifest. Missing or unexpected paths fail closed.

The scope is limited to runtime admission contracts, the injected local process
port, bounded fake-tested lifecycle behavior, sanitized runtime results,
fault/security/compatibility acceptance, Schemas, tests, read-only Workflows,
Evidence and governance records.

## Review and dashboard condition

Review submissions and inline threads are re-read from GitHub after exact-Head
CI. Dependabot, Code Scanning and Secret Scanning dashboards are not enumerable
through the available connector.

```text
securityDashboardEnumerationAvailable=false
zeroAlertClaimMade=false
```

## Metadata and Validator-chain correction

The PR metadata was corrected after G1 began so it no longer states that G1 is
unstarted. During that metadata operation, an empty root placeholder path was
created accidentally and removed immediately by an append-only corrective
commit. The final scope manifest excludes that path, the final Tree contains no
such file, and no historical commit was rewritten.

The same correction cycle closes a real governance omission: the dedicated G1
Validator is now explicitly registered as
`validate:m3-r3-g1-formal-acceptance` and ordered in the root `validate` chain
after P4 and before the final release-closure Validator. A focused mutation test
rejects removal of either binding.

```text
accidentalPlaceholderPresentInFinalTree=false
historyRewritten=false
forcePushUsed=false
rootValidatorIncludesG1=true
exactHeadRevalidationRequired=true
```

## Decision target

```text
g1Complete=true
finalBaselineVerified=true
fullScopeAuditComplete=true
permanentValidatorChainComplete=true
acceptedP4EvidenceBound=true
p4EvidenceRewritten=false
newRuntimeCapabilityAdded=false
readyMarked=false
merged=false
g2Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R3-G2
```
