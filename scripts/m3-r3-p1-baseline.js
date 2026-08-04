export const M3_R3_P1_EVIDENCE_SCHEMA_VERSION =
  'm3-r3-local-process-boundary-p1-evidence/v1';

export const ACCEPTED_M3_R3_R0 = Object.freeze({
  mainSha: '99b1de75f325c46f84259bb21bc1de0ad45adb14',
  sourcePr: 56,
  sourceHead: 'cb396959b2fe22fc3bf8afe5968d7ee439947a5b',
  mergeSha: '99b1de75f325c46f84259bb21bc1de0ad45adb14',
  mainBoundRunId: 30876457794,
  mainBoundArtifactId: 8879700536,
  mainBoundArtifactDigest:
    'sha256:d54310dbf70f758b1729627d59efba0240bb3519f2e7934e530b64bb3a1c91c5',
  mainBoundCanonicalEvidenceDigest:
    '3b75c3229057898946eb37bf9f8f1735ef219d85f56cd9f9fd834492eaadf422',
  runtimePolicyDigest:
    '80c88eb3c91040b269c51a3d8e460bbc0ffcb330e75da4c52a1b5a178fe78ab5',
  runtimeAdmissionRequestDigest:
    'c1368f62985f25192bb53e375a3d49143c1d5c064ba1ca3182ab7df3e161812e',
  invocationPlanDigest:
    'ef82314a31c4f7d4950cb47e56e077ba9095edbc2cbe72fba792737369e86c48',
  runtimeAdmissionEvidenceDigest:
    'ac9c8224b4dfaa96472dda5e9f77e894b723bf6c358ac4a5e0388728d679f24c',
});

export const M3_R3_P1_FALSE_SAFETY_FIELDS = Object.freeze([
  'sourceExecuted',
  'executionRuntimeStarted',
  'nodeProcessAdapterImplemented',
  'processStarted',
  'processIdCreated',
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
  'runtimeResultCollected',
  'allureImplemented',
  'workerAdded',
  'queueAdded',
  'schedulerAdded',
  'containerStarted',
  'kubernetesResourceCreated',
  'remoteExecutionApiAdded',
]);

export const M3_R3_P1_SCHEMA_PATHS = Object.freeze([
  'schemas/execution/k6-api-runtime/v1/k6-local-process-port.schema.json',
  'schemas/execution/k6-api-runtime/v1/k6-process-launch-specification.schema.json',
  'schemas/execution/k6-api-runtime/v1/k6-process-launch-decision.schema.json',
  'schemas/execution/k6-api-runtime/v1/k6-process-boundary-evidence.schema.json',
  'schemas/execution/k6-api-runtime/v1/m3-r3-local-process-boundary-p1-evidence.schema.json',
]);

export const M3_R3_P1_PATHS = Object.freeze({
  rootPackage: 'package.json',
  constants: 'packages/k6-api-adapter/src/constants.js',
  errors: 'packages/k6-api-adapter/src/errors.js',
  runtimeModule: 'packages/k6-api-adapter/src/runtime-admission.js',
  boundaryModule: 'packages/k6-api-adapter/src/local-process-boundary.js',
  index: 'packages/k6-api-adapter/src/index.js',
  testHelper: 'packages/k6-api-adapter/test/local-process-boundary-test-helpers.js',
  tests: Object.freeze([
    'packages/k6-api-adapter/test/local-process-boundary.test.js',
    'packages/k6-api-adapter/test/local-process-boundary-schema.test.js',
    'packages/k6-api-adapter/test/local-process-boundary-repository.test.js',
  ]),
  schemaCatalog: 'schemas/execution/k6-api-runtime/p1-schema-catalog.json',
  schemas: M3_R3_P1_SCHEMA_PATHS,
  baseline: 'scripts/m3-r3-p1-baseline.js',
  repository: 'scripts/m3-r3-p1-repository.js',
  validator: 'scripts/validate-m3-r3-p1-local-process-boundary.js',
  workflow: '.github/workflows/m3-r3-p1-local-process-boundary.yml',
  handoff: 'docs/02-development/m3-r3-p1-local-process-boundary-handoff.md',
  roadmap: 'docs/03-roadmap/m3-r3-p1-local-process-boundary.md',
  acceptance: 'docs/04-governance/m3-r3-p1-local-process-boundary-acceptance-matrix.md',
  adr: 'docs/05-adr/ADR-0031-injected-local-process-boundary.md',
  threatModel: 'docs/06-security/m3-r3-p1-local-process-boundary-threat-model.md',
  release: 'docs/releases/M3-R3-P1-local-process-boundary.md',
  docsIndex: 'docs/README.md',
});

export function assertM3R3P1(condition, message) {
  if (!condition) throw new Error(message);
}

export function resolveM3R3P1Branch(options = {}) {
  if (typeof options.branch === 'string' && options.branch.trim()) return options.branch;
  return process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'local';
}
