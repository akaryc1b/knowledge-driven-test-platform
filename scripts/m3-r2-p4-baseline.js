export const M3_R2_P4_EVIDENCE_SCHEMA_VERSION =
  'm3-r2-source-generation-p4-evidence/v1';

export const ACCEPTED_P3 = Object.freeze({
  headSha: 'd8f900bd7f3555335c0b603ce6b61d9c44824889',
  runId: 30691711832,
  artifactId: 8815888882,
  artifactDigest: 'sha256:8df02a4e97ee7891abf4d842b1d106927d0282aa3d8b43094b1497c298373b23',
  evidenceReceiptFileDigest: '31f273a88130d3bab25b33fda38e6a2131cf80c22e9f623eb6b1b61011990a58',
  artifactReceiptBlobSha: 'dd34505f303db3f720a9bff2fc06369d091a7b10',
  evidenceDigest: 'b013a5a14ad88a4b3fa97f1574dfe3006d0047776b95b7770a8c88a1aeb7e490',
  sourceArtifactDigest: '56d121390b08aee343c3ad49fd63d5d36c9d067a56ccbebba66fa65115588d13',
  validationEvidenceDigest: 'a7324d928ca56c48428d67cb8329adc532c65f461f98dbbc61969341030f70bd',
  sourceDigest: 'ffe417669eb4f242b9ab9d5df968fab80c90aacc52c45b7d11c3fe3e258c88d9',
});

export const ACCEPTED_P3_GENERATED_AT = '2026-08-01T08:25:12.249Z';
export const ACCEPTED_P3_BRANCH = 'agent/m3-r2-governed-k6-api-source-generation';
export const ACCEPTED_P3_EVIDENCE_PATH =
  'evidence/m3-r2/m3-r2-source-generation-p3-accepted-evidence.json';
export const ACCEPTED_P3_ARTIFACT_BUNDLE_PATH =
  'evidence/m3-r2/m3-r2-source-generation-p3-accepted-artifact-receipt.json';

export const P4_PATHS = Object.freeze({
  rootPackage: 'package.json',
  constants: 'packages/k6-api-adapter/src/constants.js',
  errors: 'packages/k6-api-adapter/src/errors.js',
  index: 'packages/k6-api-adapter/src/index.js',
  publicationBundle: 'packages/k6-api-adapter/src/source-publication-bundle.js',
  publisher: 'packages/k6-api-adapter/src/source-bundle-publisher.js',
  testHelpers: 'packages/k6-api-adapter/test/p4-test-helpers.js',
  bundleTests: 'packages/k6-api-adapter/test/source-publication-bundle.test.js',
  publisherTests: 'packages/k6-api-adapter/test/source-bundle-publisher.test.js',
  schemaTests: 'packages/k6-api-adapter/test/source-p4-schema.test.js',
  catalog: 'schemas/execution/k6-api-source/p4-schema-catalog.json',
  bundleSchema:
    'schemas/execution/k6-api-source/v1/k6-api-source-publication-bundle.schema.json',
  receiptSchema:
    'schemas/execution/k6-api-source/v1/k6-api-source-publication-receipt.schema.json',
  publicationEvidenceSchema:
    'schemas/execution/k6-api-source/v1/k6-api-source-publication-evidence.schema.json',
  p4EvidenceSchema:
    'schemas/execution/k6-api-source/v1/m3-r2-source-generation-p4-evidence.schema.json',
  acceptedP3Evidence: ACCEPTED_P3_EVIDENCE_PATH,
  acceptedP3ArtifactBundle: ACCEPTED_P3_ARTIFACT_BUNDLE_PATH,
  example: 'examples/k6-api-source-bundle-publication.js',
  baseline: 'scripts/m3-r2-p4-baseline.js',
  repository: 'scripts/m3-r2-p4-repository.js',
  validator: 'scripts/validate-m3-r2-source-generation-p4.js',
  workflow: '.github/workflows/m3-r2-p4-source-bundle-publication.yml',
  handoff: 'docs/02-development/m3-r2-p4-handoff.md',
  roadmap: 'docs/03-roadmap/m3-r2-p4-source-bundle-publication.md',
  acceptance: 'docs/04-governance/m3-r2-p4-source-bundle-acceptance-matrix.md',
  adr: 'docs/05-adr/ADR-0032-content-addressed-source-bundle-publication.md',
  threatModel: 'docs/06-security/m3-r2-p4-source-bundle-threat-model.md',
  release: 'docs/releases/M3-R2-P4-source-bundle-publication.md',
});

export function resolveP4Branch(options = {}) {
  if (typeof options.branch === 'string' && options.branch.trim()) return options.branch;
  for (const value of [process.env.GITHUB_HEAD_REF, process.env.GITHUB_REF_NAME]) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return 'local';
}

export function assertP4(condition, message) {
  if (!condition) throw new Error(message);
}
