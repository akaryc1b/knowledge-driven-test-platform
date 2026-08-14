# M3-R4-P4 Fault, Security and Compatibility Acceptance

## Acceptance statement

P4 accepts only the fault, security and compatibility characteristics of the
already accepted P3 fake-only collector. The product sources and P3 Schemas are
frozen by an exact diff guard.

```text
repository=akaryc1b/knowledge-driven-test-platform
slice=M3-R4-P4
issue=85
acceptedP3Head=9a11bd749620af23735955fb3c90b034c8e63944
m3R4P3ExactHeadAcceptanceComplete=true
m3R4P3ArtifactIndependentlyVerified=true
m3R4P4Started=true
m3R4P4ImplementationComplete=true
m3R4P4ExactHeadAcceptanceComplete=false
implementationStatus=ACCEPTANCE_ONLY
p3CollectorProductChanged=false
```

## Required gates

- exact P4 changed-path allow-list;
- Node.js 22 focused, adapter and full-suite success;
- Node.js 24 focused fake-only success;
- identical P3 compatibility product digest across Node versions;
- complete root Repository Validator success;
- closed P4 Evidence Schema validation;
- permanent path-preserving Artifact generation and independent audit;
- zero Changes Requested Reviews and zero unresolved actionable threads.

## Decision boundary

```text
faultSecurityCompatibilityAccepted=true
adversarialAcceptanceComplete=true
realFilesystemImplementationEvaluated=true
realFilesystemImplementationAuthorized=false
realFilesystemCollectorImplemented=false
platformCompatibility=linux-contract-baseline
windowsCompatibilityClaimed=false
macosCompatibilityClaimed=false
rawPayloadPersisted=false
rawPayloadIncludedInEvidence=false
m3R4G1Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R4-G1
```

The decision becomes authoritative only after natural exact-Head CI and
independent Artifact verification. Until then the PR remains Draft/Open and no
G1 operation is authorized.
