# M3-R4-P3 Document Index

- [Development handoff](02-development/m3-r4-p3-bounded-result-collector-handoff.md)
- [Program roadmap](03-roadmap/m3-r4-governed-output-root.md)
- [Acceptance obligations](04-governance/m3-r4-p3-bounded-result-collector-acceptance.md)
- [Release record](releases/M3-R4-P3-bounded-result-collector.md)
- [R0 boundary matrix](04-governance/m3-r4-r0-governed-output-root-boundary-matrix.md)
- [R0 threat model](06-security/m3-r4-r0-governed-output-root-threat-model.md)
- [ADR-0035](05-adr/ADR-0035-governed-output-root-contract-first.md)

P3 verifies a bounded transient fake payload and publishes metadata-only
products. It does not add a concrete host filesystem adapter, create a real
output directory, expose a host path or invoke k6.
