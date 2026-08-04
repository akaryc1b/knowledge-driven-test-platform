export const M3_R3_P2_EVIDENCE_SCHEMA_VERSION =
  'm3-r3-bounded-process-lifecycle-p2-evidence/v1';

export const ACCEPTED_M3_R3_P1 = Object.freeze({
  mainSha: 'd830f923e5b7a7e1129307fc6bf591c88a4c7f4b',
  sourcePr: 59,
  sourceHead: '19ed7fc40ef9bc305027f36a51f174c1e292c591',
  mergeSha: 'd830f923e5b7a7e1129307fc6bf591c88a4c7f4b',
  mainBoundRunId: 30895410513,
  mainBoundJobId: 91947015653,
  mainBoundArtifactId: 8886800896,
  mainBoundArtifactDigest:
    'sha256:84a41fa636651412765796ed1040305fa0c2ca1b6441f2e8f37a542772736f61',
  mainBoundEvidenceJsonSha256:
    'fc7e919f290435056bb9e6bc80587acd44a6d188e8bc9987135459892d2aa4fc',
  mainBoundCanonicalEvidenceDigest:
    '4aa20c5b733498004b4a083dd8af99aa565c7a8df21a9509f0c759f9fc630c7c',
  portDigest:
    '7a13efa1d039f92cbd94c38fa1ca218d00408da076583243ea090e4889566cfd',
  launchSpecificationDigest:
    '52aa60792a770b254b71ac89ae85837c5946e4c9d8d0cc7391ea53bd1bff37b8',
  launchDecisionDigest:
    '4260ffefe149629444887c3cdb0b86ae68f80d9832d94535c05e1c8da09f8097',
  boundaryEvidenceDigest:
    '932f2f28d6303b86091e67757b63556593af0422625e7fb0b4de0eed0e5c7539',
  schemaCatalogDigest:
    '687bfbca8940698722ddc9d2eb36a6ed8c38d4c739c8a9bb0b790eb7edb638ed',
});

export const M3_R3_P2_SCHEMA_PATHS = Object.freeze([
  'schemas/execution/k6-api-runtime/v1/k6-node-process-adapter.schema.json',
  'schemas/execution/k6-api-runtime/v1/k6-process-execution-command.schema.json',
  'schemas/execution/k6-api-runtime/v1/k6-process-lifecycle-evidence.schema.json',
  'schemas/execution/k6-api-runtime/v1/m3-r3-bounded-process-lifecycle-p2-evidence.schema.json',
]);

export const M3_R3_P2_PATHS = Object.freeze({
  rootPackage: 'package.json',
  index: 'packages/k6-api-adapter/src/index.js',
  lifecycleModule: 'packages/k6-api-adapter/src/process-execution-lifecycle.js',
  contractsModule: 'packages/k6-api-adapter/src/process-execution-contracts.js',
  evidenceModule: 'packages/k6-api-adapter/src/process-lifecycle-evidence.js',
  adapterModule: 'packages/k6-api-adapter/src/node-process-adapter.js',
  testHelper:
    'packages/k6-api-adapter/test/process-execution-lifecycle-test-helpers.js',
  tests: Object.freeze([
    'packages/k6-api-adapter/test/process-execution-lifecycle.test.js',
    'packages/k6-api-adapter/test/process-execution-lifecycle-schema.test.js',
    'packages/k6-api-adapter/test/process-execution-lifecycle-repository.test.js',
    'packages/k6-api-adapter/test/process-execution-lifecycle-workflow.test.js',
  ]),
  p1BoundaryModule: 'packages/k6-api-adapter/src/local-process-boundary.js',
  p1SchemaCatalog: 'schemas/execution/k6-api-runtime/p1-schema-catalog.json',
  schemaCatalog: 'schemas/execution/k6-api-runtime/p2-schema-catalog.json',
  schemas: M3_R3_P2_SCHEMA_PATHS,
  baseline: 'scripts/m3-r3-p2-baseline.js',
  repository: 'scripts/m3-r3-p2-repository.js',
  validator: 'scripts/validate-m3-r3-p2-bounded-process-lifecycle.js',
  workflowValidator: 'scripts/validate-m3-r3-p2-workflow-evidence.js',
  workflow: '.github/workflows/m3-r3-p2-bounded-process-lifecycle.yml',
  handoff: 'docs/02-development/m3-r3-p2-bounded-process-lifecycle-handoff.md',
  roadmap: 'docs/03-roadmap/m3-r3-p2-bounded-process-lifecycle.md',
  acceptance:
    'docs/04-governance/m3-r3-p2-bounded-process-lifecycle-acceptance-matrix.md',
  adr: 'docs/05-adr/ADR-0032-bounded-local-process-lifecycle.md',
  threatModel: 'docs/06-security/m3-r3-p2-bounded-process-lifecycle-threat-model.md',
  release: 'docs/releases/M3-R3-P2-bounded-process-lifecycle.md',
  docsIndex: 'docs/README.md',
});

export const M3_R3_P2_CI_SAFETY_FIELDS = Object.freeze([
  'realProcessStartedInCi',
  'processIdCreatedInCi',
  'signalSentInCi',
  'k6InvokedInCi',
  'externalProcessExecutedInCi',
  'targetNetworkAccessed',
  'databaseAccessed',
  'secretAccessed',
  'filesystemCredentialAccessed',
  'runtimeOutputCollected',
  'runtimeResultCollected',
  'allureImplemented',
  'workerAdded',
  'queueAdded',
  'schedulerAdded',
  'containerStarted',
  'kubernetesResourceCreated',
  'remoteExecutionApiAdded',
]);

export function assertM3R3P2(condition, message) {
  if (!condition) throw new Error(message);
}

export function resolveM3R3P2Branch(options = {}) {
  if (typeof options.branch === 'string' && options.branch.trim()) return options.branch;
  return process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'local';
}
