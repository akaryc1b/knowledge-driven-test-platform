export const SCHEMA_VERSION = 'm3-r3-final-main-closure/v1';
export const SCHEMA_PATH =
  'schemas/execution/k6-api-runtime/v1/m3-r3-final-main-closure.schema.json';
export const WORKFLOW_PATH = '.github/workflows/m3-r3-final-main-observer.yml';
export const ARTIFACT_NAME = 'm3-r3-final-main-observer-evidence';
export const OBSERVER_BRANCH = 'agent/m3-r3-final-main-observer-583e848';
export const REPOSITORY = 'akaryc1b/knowledge-driven-test-platform';
export const SOURCE_BASE = '8684836233837c905e0ced20e8eac2cfd0b43601';
export const SOURCE_HEAD = '3bcdab12e8fcea909ca6aa8479bac6a69b545747';
export const SOURCE_MERGE = '583e848a289a6fff2e2d2c4052002125b47bb853';
export const CORRECTION_HEAD = 'd55d3483064e38bb0c7853a6d57729fa97c48070';
export const CORRECTION_MERGE = 'c34c9e8234713f109bc98ff3b7ed663066083875';

export const SOURCE_WORKFLOWS = Object.freeze([
  'm2-r2-rebaseline-portable-release-readiness',
  'm2-r2a-external-evidence-intake',
  'm2-r3-final-release-closure',
  'm3-r0-execution-contract-foundation',
  'm3-r1-k6-api-spec-compiler',
  'm3-r2-k6-api-source-generation',
  'm3-r2-p3-source-artifact-validation',
  'm3-r2-p4-source-bundle-publication',
  'm3-r2-p5-source-generation-acceptance',
  'm3-r3-g1-formal-acceptance',
  'm3-r3-p1-local-process-boundary',
  'm3-r3-p2-bounded-process-lifecycle',
  'm3-r3-p3-sanitized-runtime-result',
  'm3-r3-p4-fault-security-compatibility-acceptance',
  'm3-r3-runtime-admission',
  'validation',
]);

export const CORRECTION_WORKFLOWS = Object.freeze([
  'm3-r0-execution-contract-foundation',
  'm3-r1-k6-api-spec-compiler',
  'm3-r2-k6-api-source-generation',
  'm3-r2-p3-source-artifact-validation',
  'm3-r2-p4-source-bundle-publication',
  'm3-r2-p5-source-generation-acceptance',
  'm3-r3-g1-formal-acceptance',
  'm3-r3-g4-evidence-correction',
  'm3-r3-p1-local-process-boundary',
  'm3-r3-p2-bounded-process-lifecycle',
  'm3-r3-p3-sanitized-runtime-result',
  'm3-r3-p4-fault-security-compatibility-acceptance',
  'm3-r3-runtime-admission',
  'validation',
]);

export const SOURCE_EXPECTED_CONCLUSIONS = Object.freeze(Object.fromEntries(
  SOURCE_WORKFLOWS.map((name) => [name, name === 'validation' ? 'failure' : 'success']),
));
export const CORRECTION_EXPECTED_CONCLUSIONS = Object.freeze(Object.fromEntries(
  CORRECTION_WORKFLOWS.map((name) => [name, 'success']),
));
export const SOURCE_HISTORICAL_FAILURE = Object.freeze({
  workflow: 'validation',
  classification: 'staleMainPushAssumption/workflowDefect',
  correctedByPullRequest: 73,
  correctedByHead: CORRECTION_HEAD,
  correctedByMerge: CORRECTION_MERGE,
  preserved: true,
  manualRerunPerformed: false,
});

export const ARTIFACT_PATHS = Object.freeze([
  'evidence/m3-r3-final-main-closure.json',
  SCHEMA_PATH,
  'scripts/m3-r3-final-main-observer.js',
  'scripts/m3-r3-final-main/constants.js',
  'scripts/m3-r3-final-main/repository.js',
  'scripts/m3-r3-final-main/github.js',
  'scripts/m3-r3-final-main/evidence.js',
  'scripts/json-schema-draft-2020.js',
  'scripts/collect-m2-main-branch-ci-evidence.js',
  WORKFLOW_PATH,
  'packages/k6-api-adapter/test/m3-r3-final-main-observer.test.js',
  'schemas/execution/k6-api-runtime/README.md',
  'docs/04-governance/m3-r3-final-main-closure.md',
  'logs/m3-r3-final-main-observer-focused-node22.tap',
  'logs/m3-r3-final-main-observer-root-validation.log',
  'logs/m3-r3-final-main-observer-validator.log',
]);

export const REQUIRED_PATHS = Object.freeze(ARTIFACT_PATHS.filter((path) =>
  !path.startsWith('evidence/') && !path.startsWith('logs/')));

export const SAFETY_FIELDS = Object.freeze([
  'k6Invoked', 'xk6Invoked', 'playwrightInvoked',
  'externalProcessExecuted', 'targetNetworkAccessed', 'databaseAccessed',
  'secretAccessed', 'filesystemCredentialAccessed', 'rawStdoutCollected',
  'rawStderrCollected', 'numericProcessIdExposed', 'sourceBundleModified',
  'governedOutputRootImplemented', 'fileResultCollectionImplemented',
  'workerAdded', 'queueAdded', 'schedulerAdded', 'containerStarted',
  'kubernetesResourceCreated', 'remoteExecutionApiAdded', 'allureImplemented',
]);

export const FIXED_DIGESTS = Object.freeze({
  acceptedP4CanonicalEvidence: '545598fd64f9907db51e1683b5de72623e4575ad05fe530f806fbfba1b7cbfb6',
  acceptedP4SchemaCatalog: '9fa80d60a744d4c99485596d8a0d89deb7da0a3e67408b21c87236a6cc414de6',
  acceptedG1CanonicalEvidence: '3d77b61234e060777e12a555314320db3b3a83083cff5c5fbfcafc7bb930298c',
  acceptedG1SchemaCatalog: 'cde2f3a7e41b0bc53cf8a7245d4147c64f842837da0d5ccc229df6f39cc7bbe4',
  scopeManifest: '01bd484fb5330eb075d1e0ff47df4c9063040176eaaecc86671d9e7480ec99e8',
  compatibilityProduct: '9bf593893d370448ece828710969eb3b838951ae6e4df5a82c462b1b23d739dd',
  correctionPrCanonicalEvidence: '3be035b0d0d581e851dc3afa5be28750f2f00d5347aa5e5444e205fbb9eccc6a',
  correctionPrArtifactApi: 'sha256:d4f5a63621045690861a2a2d4417cfffbb251c0c7fb93503d29fa9e4e13be1f8',
});
