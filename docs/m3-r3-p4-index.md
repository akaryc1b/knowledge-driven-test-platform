# M3-R3-P4 Document Index

Controlled entry point for **M3-R3-P4 — Fault, Security and Compatibility Acceptance**.

## Scope and implementation

- [Development handoff](02-development/m3-r3-p4-fault-security-compatibility-handoff.md)
- [Roadmap and safe-slice completion](03-roadmap/m3-r3-p4-fault-security-compatibility-acceptance.md)
- [Executable acceptance matrix](04-governance/m3-r3-p4-fault-security-compatibility-acceptance-matrix.md)
- [Threat-model extension and closed findings](06-security/m3-r3-p4-fault-security-compatibility-threat-model.md)

## Permanent acceptance

- [Exact-Head acceptance record](04-governance/m3-r3-p4-exact-head-acceptance.md)
- [ADR-0034 Linux and Node 22/24 compatibility contract](05-adr/ADR-0034-linux-node22-node24-runtime-acceptance.md)
- [Release note](releases/M3-R3-P4-fault-security-compatibility-acceptance.md)
- Evidence Schema: `schemas/execution/k6-api-runtime/v1/m3-r3-fault-security-compatibility-p4-evidence.schema.json`
- Schema Catalog: `schemas/execution/k6-api-runtime/p4-schema-catalog.json`
- Repository Validator: `scripts/validate-m3-r3-p4-fault-security-compatibility.js`
- Permanent Workflow: `.github/workflows/m3-r3-p4-fault-security-compatibility-acceptance.yml`

## Frozen scope

```text
p4Issue=67
p4Pr=68
p4BaselineMain=8684836233837c905e0ced20e8eac2cfd0b43601
newRuntimeCapabilityAdded=false
governedOutputRootImplemented=false
fileResultCollectionImplemented=false
sourceBundleRemainsImmutable=true
p4ReadyMarked=false
p4Merged=false
m3R3G1Started=false
```

P4 verifies the existing local governed runtime boundary. It does not authorize Ready, merge, remote execution, output-root creation, file-result collection, Worker/Queue/Scheduler, container/Kubernetes execution, Allure or UI work.
