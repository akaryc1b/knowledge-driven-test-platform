export const M3_R3_R0_EVIDENCE_SCHEMA_VERSION =
  'm3-r3-runtime-admission-r0-evidence/v1';

export const ACCEPTED_M3_R2 = Object.freeze({
  mainSha: '62e1deb6b6f9c8e82188c0fe8e66d83350d6f9cf',
  sourcePr: 48,
  sourceHead: 'fc81b9184a3f1024eb1ff0d64b5145ede7569aa0',
  mergeSha: '62e1deb6b6f9c8e82188c0fe8e66d83350d6f9cf',
  p5RunId: 30867429404,
  p5EvidenceArtifactId: 8876646118,
  p5EvidenceArtifactDigest:
    'sha256:d42f0820b5101c1aa9c8c7e7b887500a9c4b159a2e41258d8e3ec9cfb46fb069',
  p5CanonicalEvidenceDigest:
    '792c3494a305d863bd8ee4a291746d40035b289444de6eab304ef5edb55d6622',
  p5PostgresArtifactId: 8876634767,
  p5PostgresArtifactDigest:
    'sha256:805ee75a9fb49662aeeaaeff24ed771c4b242074e79ae795cd22f44f27cd3abe',
  sourceIdentity: 'd2d75729802aa6a21d3f2deec9ba85bf31e35358e94b643004326067a0450f73',
  sourceDigest: 'ffe417669eb4f242b9ab9d5df968fab80c90aacc52c45b7d11c3fe3e258c88d9',
  sourceArtifactDigest:
    '56d121390b08aee343c3ad49fd63d5d36c9d067a56ccbebba66fa65115588d13',
  validationEvidenceDigest:
    'a7324d928ca56c48428d67cb8329adc532c65f461f98dbbc61969341030f70bd',
  p3EvidenceDigest: 'b013a5a14ad88a4b3fa97f1574dfe3006d0047776b95b7770a8c88a1aeb7e490',
  p4EvidenceDigest: 'becd63681959881b017214f55038f4b0de5e8eceb2c9c04efdaed789d6523f54',
  bundleDigest: 'be37017095bfe927615a4487d0cb1f5775f4abd8bfb0070d40e32e8ecd49ae0f',
  manifestDigest: 'fce734d0244118919e1927b17041200228b0010aa667b4d041c9bc4979860c36',
  receiptDigest: '6ad0c06d4603f047a5c5a98c6b9a5c3ea278ceaf712e51c469a5bd76a7d34465',
  publicationEvidenceDigest:
    'd2f90c5ef2a1100cc82d447226a546b1affab7764140fc07ba0be6b3d2f52004',
});

export const M3_R3_R0_FALSE_SAFETY_FIELDS = Object.freeze([
  'sourceExecuted',
  'executionRuntimeStarted',
  'k6Invoked',
  'xk6Invoked',
  'playwrightInvoked',
  'externalProcessExecuted',
  'shellUsed',
  'nodeVmUsed',
  'evalUsed',
  'dynamicImportUsed',
  'targetNetworkAccessed',
  'databaseAccessed',
  'secretAccessed',
  'filesystemCredentialAccessed',
  'temporaryExecutionDirectoryCreated',
  'containerStarted',
  'kubernetesResourceCreated',
  'workerAdded',
  'queueAdded',
  'schedulerAdded',
  'runtimeResultCollected',
  'allureImplemented',
]);

export const M3_R3_R0_PATHS = Object.freeze({
  rootPackage: 'package.json',
  constants: 'packages/k6-api-adapter/src/constants.js',
  errors: 'packages/k6-api-adapter/src/errors.js',
  runtimeModule: 'packages/k6-api-adapter/src/runtime-admission.js',
  index: 'packages/k6-api-adapter/src/index.js',
  testHelper: 'packages/k6-api-adapter/test/runtime-admission-test-helpers.js',
  tests: Object.freeze([
    'packages/k6-api-adapter/test/runtime-admission.test.js',
    'packages/k6-api-adapter/test/runtime-admission-schema.test.js',
  ]),
  schemaCatalog: 'schemas/execution/k6-api-runtime/schema-catalog.json',
  schemas: Object.freeze([
    'schemas/execution/k6-api-runtime/v1/k6-api-runtime-policy.schema.json',
    'schemas/execution/k6-api-runtime/v1/k6-api-runtime-admission-request.schema.json',
    'schemas/execution/k6-api-runtime/v1/k6-api-invocation-plan.schema.json',
    'schemas/execution/k6-api-runtime/v1/k6-api-runtime-admission-evidence.schema.json',
    'schemas/execution/k6-api-runtime/v1/m3-r3-runtime-admission-r0-evidence.schema.json',
  ]),
  baseline: 'scripts/m3-r3-r0-baseline.js',
  repository: 'scripts/m3-r3-r0-repository.js',
  validator: 'scripts/validate-m3-r3-runtime-admission.js',
  workflow: '.github/workflows/m3-r3-runtime-admission.yml',
  handoff: 'docs/02-development/m3-r3-r0-handoff.md',
  roadmap: 'docs/03-roadmap/m3-r3-runtime-admission.md',
  acceptance: 'docs/04-governance/m3-r3-runtime-admission-acceptance-matrix.md',
  adr: 'docs/05-adr/ADR-0030-governed-k6-runtime-admission.md',
  threatModel: 'docs/06-security/m3-r3-runtime-admission-threat-model.md',
  release: 'docs/releases/M3-R3-R0-runtime-admission.md',
});

export function assertM3R3R0(condition, message) {
  if (!condition) throw new Error(message);
}

export function resolveM3R3R0Branch(options = {}) {
  if (typeof options.branch === 'string' && options.branch.trim()) return options.branch;
  return process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'local';
}
