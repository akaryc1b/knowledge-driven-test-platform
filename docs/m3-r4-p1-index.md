# M3-R4-P1 Document Index

## Development

- `docs/02-development/m3-r4-p1-output-root-contracts-handoff.md`

## Roadmap

- `docs/03-roadmap/m3-r4-governed-output-root.md`
- `docs/03-roadmap/roadmap.md`

## Governance

- `docs/04-governance/m3-r4-p1-output-root-contract-acceptance.md`
- `docs/04-governance/m3-r4-r0-governed-output-root-boundary-matrix.md`

## Architecture and security predecessor

- `docs/05-adr/ADR-0035-governed-output-root-contract-first.md`
- `docs/06-security/m3-r4-r0-governed-output-root-threat-model.md`

## Release

- `docs/releases/M3-R4-P1-output-root-contracts.md`

## Contracts and validation

- `packages/k6-api-adapter/src/output-root-contracts.js`
- `packages/k6-api-adapter/test/m3-r4-p1-output-root-contracts.test.js`
- `schemas/execution/k6-api-runtime/p1-output-root-schema-catalog.json`
- `scripts/validate-m3-r4-p1-output-root-contracts.js`
- `.github/workflows/m3-r4-p1-output-root-contracts.yml`

P1 is contract-only. It does not create a governed root, access a runtime result file or authorize P2.
