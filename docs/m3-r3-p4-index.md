# M3-R3-P4 Document Index

This is the controlled document entry point for **M3-R3-P4 — Fault, Security and Compatibility Acceptance**.

## R0 acceptance foundation

- [Development handoff](02-development/m3-r3-p4-fault-security-compatibility-handoff.md)
- [Roadmap and safe-slice order](03-roadmap/m3-r3-p4-fault-security-compatibility-acceptance.md)
- [Executable acceptance matrix](04-governance/m3-r3-p4-fault-security-compatibility-acceptance-matrix.md)
- [Threat-model extension](06-security/m3-r3-p4-fault-security-compatibility-threat-model.md)

## Permanent P4 records

The following records are added by the later P4 evidence slice and must remain separate from accepted historical P3 evidence:

- P4 release note;
- P4 exact-Head acceptance record;
- P4 Acceptance Evidence Schema and Schema Catalog;
- P4 permanent Workflow and path-preserving Artifact;
- root Repository Validator registration.

## Frozen scope

```text
p4Issue=67
p4BaselineMain=8684836233837c905e0ced20e8eac2cfd0b43601
p4ProductCapabilityAdded=false
p4ExistingRuntimeBehaviorChanged=false
governedOutputRootImplemented=false
fileResultCollectionImplemented=false
sourceBundleRemainsImmutable=true
m3R3P4ReadyMarked=false
m3R3P4Merged=false
m3R3G1Started=false
```

P4 verifies the existing local governed runtime boundary. It does not authorize Ready, merge, remote execution, output-root creation, file-result collection, Worker/Queue/Scheduler, container/Kubernetes execution, Allure or UI work.