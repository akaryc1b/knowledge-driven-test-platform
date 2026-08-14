# k6 API Runtime Schemas

## Registered permanent governance Evidence

### M3-R3 G4 Historical Evidence and Closed-Schema Correction Evidence

- Schema: `v1/m3-r3-g4-evidence-correction.schema.json`
- Version: `m3-r3-g4-evidence-correction/v1`
- Scope: exact-Head correction evidence for historical P4/G1 emission gating and complete closed Draft 2020-12 validation.
- Boundary: governance-only; it does not add runtime execution capability or rewrite accepted P4/G1 Evidence.

### M3-R3 Final Main Closure Observer Evidence

- Schema: `v1/m3-r3-final-main-closure.schema.json`
- Version: `m3-r3-final-main-closure/v1`
- Scope: binds PR #68 source merge, PR #73 correction merge, exact-main natural Runs/Jobs, G1 and correction Artifacts, and Observer merge replay.
- Boundary: governance-only; it does not rewrite P4/G1 Evidence or add runtime execution capability.

### M3-R3 G4 Final Exact-Main Natural Workflow Manifest Evidence

- Schema: `v1/m3-r3-g4-final-main-run-manifest.schema.json`
- Version: `m3-r3-g4-final-main-run-manifest/v1`
- Scope: derives the accepted exact-Head Workflow names and permanently binds the complete natural exact-main Run and Job manifest after an ordinary Merge Commit.
- Boundary: governance-only; it preserves all P4, G1, correction and Observer Evidence and adds no runtime execution capability.

## M3-R4-P3 bounded result collector closed Schema set

- Catalog: `p3-bounded-result-schema-catalog.json`
- Catalog version: `k6-output-root-p3-schema-catalog/v1`
- Schema: `v1/k6-bounded-result-collector-port.schema.json`
- Schema: `v1/k6-output-root-seal-request.schema.json`
- Schema: `v1/k6-output-root-seal-receipt.schema.json`
- Schema: `v1/k6-output-artifact-inspection-request.schema.json`
- Schema: `v1/k6-output-artifact-inspection-receipt.schema.json`
- Schema: `v1/k6-output-artifact-payload-request.schema.json`
- Schema: `v1/k6-output-artifact-payload-receipt.schema.json`
- Schema: `v1/k6-bounded-file-result.schema.json`
- Schema: `v1/m3-r4-output-root-p3-evidence.schema.json`
- Boundary: fake-only contracts and Evidence; no host filesystem path, file read, process primitive, raw payload persistence, or new runtime capability is introduced.
