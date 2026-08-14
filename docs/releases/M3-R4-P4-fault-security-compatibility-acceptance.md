# M3-R4-P4 Fault, Security and Compatibility Acceptance

## Release boundary

P4 is a governance and acceptance release over the existing P3 injected
collector. It introduces no runtime product capability.

```text
slice=M3-R4-P4
issue=85
implementationStatus=ACCEPTANCE_ONLY
p3CollectorProductChanged=false
p3SchemasChanged=false
realFilesystemImplementationEvaluated=true
realFilesystemImplementationAuthorized=false
realFilesystemCollectorImplemented=false
rawPayloadPersisted=false
rawPayloadIncludedInEvidence=false
```

## Validation package

- 17 focused deterministic adversarial tests on Node.js 22 and Node.js 24;
- complete k6 API Adapter and complete Node.js suites on Node.js 22;
- accepted P3 product and Schema Catalog digest replay;
- exact diff guard preventing P3 product or Schema changes;
- permanent closed-Schema Validator and 32-path Evidence Artifact;
- Linux boundary ADR and threat model with no Windows/macOS claim.

## Promotion gate

```text
m3R4P3ExactHeadAcceptanceComplete=true
m3R4P3ArtifactIndependentlyVerified=true
m3R4P4Started=true
m3R4P4ImplementationComplete=true
m3R4P4ExactHeadAcceptanceComplete=false
platformCompatibility=linux-contract-baseline
windowsCompatibilityClaimed=false
macosCompatibilityClaimed=false
m3R4G1Started=false
repositoryBlockers=[]
nextRequiredSlice=M3-R4-G1
```

P4 exact-Head acceptance does not mark Ready, merge the stack, implement a
filesystem collector or start G1 in the same operation.
