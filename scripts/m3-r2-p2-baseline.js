export const M3_R2_P2_EVIDENCE_SCHEMA_VERSION =
  'm3-r2-source-generation-p2-evidence/v1';

export const ACCEPTED_FOUNDATION = Object.freeze({
  baselineMain: 'ab93321738222c087e6f3c90fd39e092116cf3c8',
  p1AcceptedHead: '4604cbc7bf85565f7152525379d30c0024336ee9',
  r0AcceptedHead: '1a30d103ade7bd9eb954ddb097126c88f60dce9c',
  p1RunId: 30610514627,
  p1ArtifactId: 8785261888,
  r0RunId: 30605067352,
  r0ArtifactId: 8783292187,
});

export const ACCEPTED_M3_R1_DIGESTS = Object.freeze({
  inputContract: '4b2a767d273ca0e888278eea599f044b5a00ddd4c619ac6bce0a566b9bdad718',
  spec: '4601fc2d37a343b94516e451bbd8616baaf569a5a4c685ca679cc4a8266c9079',
  bundle: '1b4a5c2dc4d6ce12d63805abc53b2bcd6be1100d12cd7d8a7195797eb5fd41b1',
  compilationEvidence: '7c5972c8901198dbe236d27c51fb10510bf7439a486efafcb5a46ca8860ca65e',
  schemaCatalog: '80d0f740bc063add8f715355717494520fefee2fb9c14c737d8c1c6edbfed66d',
});

export const P2_SAFETY_BOUNDARY = Object.freeze({
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

export const P2_PATHS = Object.freeze({
  rootPackage: 'package.json',
  packageManifest: 'packages/k6-api-adapter/package.json',
  index: 'packages/k6-api-adapter/src/index.js',
  renderer: 'packages/k6-api-adapter/src/source-renderer.js',
  rendererAssertionValidation:
    'packages/k6-api-adapter/src/source-renderer-assertion-validation.js',
  rendererDocument: 'packages/k6-api-adapter/src/source-renderer-document.js',
  rendererInput: 'packages/k6-api-adapter/src/source-renderer-input.js',
  rendererOperation: 'packages/k6-api-adapter/src/source-renderer-operation.js',
  rendererOperationValidation:
    'packages/k6-api-adapter/src/source-renderer-operation-validation.js',
  rendererOrder: 'packages/k6-api-adapter/src/source-renderer-order.js',
  rendererShared: 'packages/k6-api-adapter/src/source-renderer-shared.js',
  rendererStatic: 'packages/k6-api-adapter/src/source-renderer-static.js',
  rendererTests: 'packages/k6-api-adapter/test/source-renderer-determinism.test.js',
  resultTests: 'packages/k6-api-adapter/test/source-renderer-result.test.js',
  safetyTests: 'packages/k6-api-adapter/test/source-renderer-safety.test.js',
  schemaTests: 'packages/k6-api-adapter/test/source-renderer-schema.test.js',
  tamperTests: 'packages/k6-api-adapter/test/source-renderer-tamper.test.js',
  testHelpers: 'packages/k6-api-adapter/test/p2-test-helpers.js',
  testSupport: 'packages/k6-api-adapter/test/source-renderer-test-support.js',
  p2Catalog: 'schemas/execution/k6-api-source/p2-schema-catalog.json',
  sourceResultSchema:
    'schemas/execution/k6-api-source/v1/k6-api-source-result.schema.json',
  p2EvidenceSchema:
    'schemas/execution/k6-api-source/v1/m3-r2-source-generation-p2-evidence.schema.json',
  example: 'examples/k6-api-source-renderer.js',
  fixture: 'examples/k6-api-source-renderer-fixture.js',
  fixtureData: 'examples/k6-api-source-renderer-fixture-data.js',
  workflow: '.github/workflows/m3-r2-k6-api-source-generation.yml',
  handoff: 'docs/02-development/m3-r2-p2-handoff.md',
  roadmap: 'docs/03-roadmap/m3-r2-p2-deterministic-source-renderer.md',
  acceptance: 'docs/04-governance/m3-r2-p2-source-renderer-acceptance-matrix.md',
  adr: 'docs/05-adr/ADR-0030-deterministic-in-memory-k6-source-renderer.md',
  threatModel: 'docs/06-security/m3-r2-p2-source-renderer-threat-model.md',
  release: 'docs/releases/M3-R2-P2-deterministic-source-renderer.md',
});

export function resolveP2Branch(options = {}) {
  if (typeof options.branch === 'string' && options.branch.trim()) return options.branch;
  for (const value of [process.env.GITHUB_HEAD_REF, process.env.GITHUB_REF_NAME]) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return 'local';
}

export function assertP2(condition, message) {
  if (!condition) throw new Error(message);
}
