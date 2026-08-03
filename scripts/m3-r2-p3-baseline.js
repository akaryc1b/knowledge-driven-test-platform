export const M3_R2_P3_EVIDENCE_SCHEMA_VERSION =
  'm3-r2-source-generation-p3-evidence/v1';

export const ACCEPTED_P2 = Object.freeze({
  headSha: 'b4bb9ed7833869edf9762adc7e7ab13971cc87c9',
  runId: 30622919099,
  artifactId: 8790138196,
  artifactDigest: 'sha256:c88e3db7caa07c2af0122413a8a2c4869231b3e4c0086d110d5ea508cecbf8f8',
  evidenceDigest: '62a00ec823e33880aa358aa16080b2aabe08b91e7d935a2bf351bb3c7d1a9a00',
  sourceDigest: 'ffe417669eb4f242b9ab9d5df968fab80c90aacc52c45b7d11c3fe3e258c88d9',
  sourceResultDigest: 'e2eb4e1b2761cbacdbe78a9f4eaed1613accda117ad195d1d623bbfc9c535287',
});

export const ACCEPTED_P2_GENERATED_AT = '2026-07-31T10:15:48.232Z';
export const ACCEPTED_P2_BRANCH = 'agent/m3-r2-governed-k6-api-source-generation';
export const ACCEPTED_P2_RECEIPT_PATH =
  'evidence/m3-r2/m3-r2-source-generation-p2-accepted-evidence.json';
export const ACCEPTED_P2_RECEIPT_FILE_DIGEST =
  '652342a6fd4634b82458aa892ae3039939137c8a6493e7b41c1fa17b45d949f1';

export const P3_SAFETY_BOUNDARY = Object.freeze({
  sourcePersisted: false,
  artifactPublished: false,
  sourceExecuted: false,
  executionRuntimeStarted: false,
  k6Invoked: false,
  xk6Invoked: false,
  playwrightInvoked: false,
  externalProcessExecuted: false,
  nodeVmUsed: false,
  evalUsed: false,
  dynamicImportUsed: false,
  targetNetworkAccessed: false,
  databaseAccessed: false,
  secretAccessed: false,
  filesystemCredentialAccessed: false,
  temporaryExecutionDirectoryCreated: false,
  containerStarted: false,
  kubernetesResourceCreated: false,
  workerAdded: false,
  queueAdded: false,
  schedulerAdded: false,
  runtimeResultCollected: false,
  allureImplemented: false,
});

export const P3_PATHS = Object.freeze({
  rootPackage: 'package.json',
  packageManifest: 'packages/k6-api-adapter/package.json',
  constants: 'packages/k6-api-adapter/src/constants.js',
  errors: 'packages/k6-api-adapter/src/errors.js',
  index: 'packages/k6-api-adapter/src/index.js',
  validationShared: 'packages/k6-api-adapter/src/source-validation-shared.js',
  staticValidator: 'packages/k6-api-adapter/src/source-static-validator.js',
  sourceArtifact: 'packages/k6-api-adapter/src/source-artifact.js',
  testHelpers: 'packages/k6-api-adapter/test/p3-test-helpers.js',
  staticValidatorTests: 'packages/k6-api-adapter/test/source-static-validator.test.js',
  artifactTests: 'packages/k6-api-adapter/test/source-artifact.test.js',
  schemaTests: 'packages/k6-api-adapter/test/source-p3-schema.test.js',
  p3Catalog: 'schemas/execution/k6-api-source/p3-schema-catalog.json',
  sourceArtifactSchema:
    'schemas/execution/k6-api-source/v1/k6-api-source-artifact.schema.json',
  sourceValidationEvidenceSchema:
    'schemas/execution/k6-api-source/v1/k6-api-source-validation-evidence.schema.json',
  p3EvidenceSchema:
    'schemas/execution/k6-api-source/v1/m3-r2-source-generation-p3-evidence.schema.json',
  acceptedP2Receipt: ACCEPTED_P2_RECEIPT_PATH,
  example: 'examples/k6-api-source-artifact.js',
  baseline: 'scripts/m3-r2-p3-baseline.js',
  repository: 'scripts/m3-r2-p3-repository.js',
  validator: 'scripts/validate-m3-r2-source-generation-p3.js',
  workflow: '.github/workflows/m3-r2-p3-source-artifact-validation.yml',
  handoff: 'docs/02-development/m3-r2-p3-handoff.md',
  roadmap: 'docs/03-roadmap/m3-r2-p3-independent-source-validation.md',
  acceptance: 'docs/04-governance/m3-r2-p3-source-validation-acceptance-matrix.md',
  adr: 'docs/05-adr/ADR-0031-independent-static-source-validation.md',
  threatModel: 'docs/06-security/m3-r2-p3-source-validation-threat-model.md',
  release: 'docs/releases/M3-R2-P3-independent-source-validation.md',
});

export function resolveP3Branch(options = {}) {
  if (typeof options.branch === 'string' && options.branch.trim()) return options.branch;
  for (const value of [process.env.GITHUB_HEAD_REF, process.env.GITHUB_REF_NAME]) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return 'local';
}

export function assertP3(condition, message) {
  if (!condition) throw new Error(message);
}
