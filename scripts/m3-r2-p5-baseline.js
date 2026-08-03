export const M3_R2_P5_EVIDENCE_SCHEMA_VERSION =
  'm3-r2-source-generation-p5-evidence/v1';
export const ACCEPTED_P4 = Object.freeze({
  headSha: '7ad6cf9b1769bac58147ddc858fcc3554cee5437',
  runId: 30708825486,
  artifactId: 8821188234,
  artifactApiDigest: 'sha256:191ae0e2cd913c858fba951d6a6cb4fe28542bdea9c0569bdb89443b9451bd61',
  uploadedZipDigest: 'sha256:036af70d36315e7342cee733cd311b3d7790f7b4e932b22dedbb0dd6413adba7',
  downloadedArchiveSha256: '036af70d36315e7342cee733cd311b3d7790f7b4e932b22dedbb0dd6413adba7',
  downloadedFileCount: 41,
  postgresArtifactId: 8821190178,
  postgresArtifactApiDigest: 'sha256:7dcee643867270575e68e313297bae31aa46fded92eb66701d3e50dc6af18b9',
  postgresDownloadedArchiveSha256: '47fe754f13c35ba71dbd13fa9d6a90782dd0699cfe6c08d18b04582a4bf8ec65',
  evidenceRawSha256: '7cb1f8fecd63384551677fc4ae5e22013c580c9db408dd9e8276340379ed1775',
  evidenceBlobSha: '7d1082aa0deeb8e75949fd36a1473b800ee26477',
  artifactReceiptRawSha256: '97f9ba93f45d3bbaedebe83274225b28b237836bf93c665fafd30e9dac6f00f9',
  artifactReceiptBlobSha: 'e457464967e6cb338b03d67c74cfc3e0b8382a97',
  evidenceDigest: 'becd63681959881b017214f55038f4b0de5e8eceb2c9c04efdaed789d6523f54',
  bundleDigest: 'be37017095bfe927615a4487d0cb1f5775f4abd8bfb0070d40e32e8ecd49ae0f',
  manifestDigest: 'fce734d0244118919e1927b17041200228b0010aa667b4d041c9bc4979860c36',
  receiptDigest: '6ad0c06d4603f047a5c5a98c6b9a5c3ea278ceaf712e51c469a5bd76a7d34465',
  publicationEvidenceDigest: 'd2f90c5ef2a1100cc82d447226a546b1affab7764140fc07ba0be6b3d2f52004',
  publicationArchiveSha256: '4cb984bf00e8ae24c6cffdf05708bac8de756c852fe3465481380c7ecfbcfefc',
  publicationArchiveBlobSha: '40b8fc5b10ac1da9621f8a4692aa04fd2a786d12',
  publicationPayloadSha256: '53de081f15e90ea3a7c0a5ee3e929fc91de8b8db6be75a249b3f9f754497e34b',
  publicationPayloadByteLength: 30178,
});
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
  validationReportDigest: 'def7e6e4d85e0dfb0fe219b82805bf65b65fa2b98463989555c3703703492cf4',
  sourceDigest: 'ffe417669eb4f242b9ab9d5df968fab80c90aacc52c45b7d11c3fe3e258c88d9',
});
export const ACCEPTED_SOURCE = Object.freeze({
  sourceIdentity: 'd2d75729802aa6a21d3f2deec9ba85bf31e35358e94b643004326067a0450f73',
  sourceDigest: ACCEPTED_P3.sourceDigest,
  sourceByteLength: 5895,
  sourceLineCount: 144,
  operationCount: 3,
  assertionCount: 7,
  thresholdCount: 3,
});
export const ACCEPTED_P4_EVIDENCE_PATH =
  'evidence/m3-r2/m3-r2-source-generation-p4-accepted-evidence.json';
export const ACCEPTED_P4_ARTIFACT_RECEIPT_PATH =
  'evidence/m3-r2/m3-r2-source-generation-p4-accepted-artifact-receipt.json';
export const FIXED_STORE_FILES = Object.freeze([
  'bundle.json', 'manifest.json', 'metadata/p3-evidence.json',
  'metadata/provenance.json', 'metadata/source-artifact.json',
  'metadata/source-validation-evidence.json', 'receipt.json', 'source/main.js',
]);
export const P5_FALSE_SAFETY_FIELDS = Object.freeze([
  'remoteArtifactPublished', 'sourceExecuted', 'executionRuntimeStarted',
  'k6Invoked', 'xk6Invoked', 'playwrightInvoked', 'externalProcessExecuted',
  'nodeVmUsed', 'evalUsed', 'dynamicImportUsed', 'targetNetworkAccessed',
  'databaseAccessed', 'secretAccessed', 'filesystemCredentialAccessed',
  'temporaryExecutionDirectoryCreated', 'containerStarted',
  'kubernetesResourceCreated', 'workerAdded', 'queueAdded', 'schedulerAdded',
  'runtimeResultCollected', 'allureImplemented',
]);
export const P5_TRUE_LOCAL_PUBLICATION_FIELDS = Object.freeze([
  'artifactStorageAccessed', 'artifactStorageDirectoryCreated',
  'sourcePersisted', 'artifactPublished',
]);
export const P5_PATHS = Object.freeze({
  rootPackage: 'package.json',
  evidenceSchema: 'schemas/execution/k6-api-source/v1/m3-r2-source-generation-p5-evidence.schema.json',
  catalog: 'schemas/execution/k6-api-source/p5-schema-catalog.json',
  acceptedP4Evidence: ACCEPTED_P4_EVIDENCE_PATH,
  acceptedP4Receipt: ACCEPTED_P4_ARTIFACT_RECEIPT_PATH,
  baseline: 'scripts/m3-r2-p5-baseline.js',
  repository: 'scripts/m3-r2-p5-repository.js',
  validator: 'scripts/validate-m3-r2-source-generation-p5.js',
  workflow: '.github/workflows/m3-r2-p5-source-generation-acceptance.yml',
  anchor: 'packages/k6-api-adapter/test/p5-test-anchor.js',
  anchorModules: Object.freeze([
    'packages/k6-api-adapter/test/p5-test-canonical.js',
    'packages/k6-api-adapter/test/p5-test-security-boundary.js',
    'packages/k6-api-adapter/test/p5-test-publication-verifier.js',
    'packages/k6-api-adapter/test/p5-test-fixture-loader.js',
  ]),
  helper: 'packages/k6-api-adapter/test/p5-test-helpers.js',
  tests: Object.freeze([
    'packages/k6-api-adapter/test/source-generation-p5-determinism.test.js',
    'packages/k6-api-adapter/test/source-generation-p5-binding.test.js',
    'packages/k6-api-adapter/test/source-generation-p5-security.test.js',
    'packages/k6-api-adapter/test/source-generation-p5-compatibility.test.js',
  ]),
  handoff: 'docs/02-development/m3-r2-p5-handoff.md',
  roadmap: 'docs/03-roadmap/m3-r2-p5-source-generation-acceptance.md',
  acceptance: 'docs/04-governance/m3-r2-p5-source-generation-acceptance-matrix.md',
  threatModel: 'docs/06-security/m3-r2-p5-source-generation-threat-model.md',
  release: 'docs/releases/M3-R2-P5-source-generation-acceptance.md',
});
export function assertP5(condition, message) {
  if (!condition) throw new Error(message);
}
export function resolveP5Branch(options = {}) {
  if (typeof options.branch === 'string' && options.branch.trim()) return options.branch;
  return process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'local';
}
