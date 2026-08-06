export const G1_EVIDENCE_SCHEMA_VERSION =
  'm3-r3-formal-acceptance-g1-evidence/v1';
export const G1_ARTIFACT_NAME = 'm3-r3-g1-formal-acceptance-evidence';
export const G1_WORKFLOW_PATH =
  '.github/workflows/m3-r3-g1-formal-acceptance.yml';
export const G1_VALIDATOR_PATH =
  'scripts/validate-m3-r3-g1-formal-acceptance.js';
export const G1_SCHEMA_CATALOG_PATH =
  'schemas/execution/k6-api-runtime/g1-schema-catalog.json';
export const G1_EVIDENCE_SCHEMA_PATH =
  'schemas/execution/k6-api-runtime/v1/'
  + 'm3-r3-formal-acceptance-g1-evidence.schema.json';
export const G1_SCOPE_MANIFEST_PATH =
  'docs/04-governance/m3-r3-g1-scope-manifest.json';
export const G1_TEST_PATH =
  'packages/k6-api-adapter/test/m3-r3-g1-formal-acceptance.test.js';

export const ACCEPTED_BASE_MAIN = '8684836233837c905e0ced20e8eac2cfd0b43601';
export const ACCEPTED_P4 = Object.freeze({
  issue: 67,
  pullRequest: 68,
  headSha: 'e98357109bfc71f013c6f1af83a06a4358a1f922',
  runId: 30997032758,
  jobId: 92276484278,
  artifactId: 8926613070,
  artifactApiDigest:
    'sha256:2b4964b535ffe8dbc4ff49d2d648f558f8a6c8288a5c8a0124e588a0619ab620',
  downloadedZipSha256:
    '2b4964b535ffe8dbc4ff49d2d648f558f8a6c8288a5c8a0124e588a0619ab620',
  evidenceJsonSha256:
    '2db2d56bfeeac7cabf46823af5bd9612a4bd13b8a6ee10e1a3b05c5f40cc4469',
  canonicalEvidenceDigest:
    '545598fd64f9907db51e1683b5de72623e4575ad05fe530f806fbfba1b7cbfb6',
  p4SchemaCatalogDigest:
    '9fa80d60a744d4c99485596d8a0d89deb7da0a3e67408b21c87236a6cc414de6',
  p3SchemaCatalogDigest:
    'f9eb33758c4ccc9433a613569f3a524759f7f381e307a75b65c49d4a3e925cc0',
  compatibilityProductDigest:
    '9bf593893d370448ece828710969eb3b838951ae6e4df5a82c462b1b23d739dd',
  artifactPathCount: 23,
});

export const G1_MODULE_PATHS = Object.freeze([
  'scripts/m3-r3-g1/constants.js',
  'scripts/m3-r3-g1/repository-validator.js',
  'scripts/m3-r3-g1/evidence.js',
  'scripts/m3-r3-g1/scope-audit.js',
  'scripts/m3-r3-g1/ci-node22.sh',
  'scripts/m3-r3-g1/ci-node24.sh',
  'scripts/m3-r3-g1/ci-artifact.js',
]);

export const G1_DOCUMENT_PATHS = Object.freeze([
  'docs/02-development/m3-r3-g1-formal-acceptance-handoff.md',
  'docs/04-governance/m3-r3-g1-formal-acceptance.md',
  'docs/releases/M3-R3-G1-formal-acceptance.md',
  'docs/m3-r3-g1-index.md',
]);

export const G1_ARTIFACT_PATHS = Object.freeze([
  "evidence/m3-r3-g1-formal-acceptance-evidence.json",
  "schemas/execution/k6-api-runtime/g1-schema-catalog.json",
  "schemas/execution/k6-api-runtime/v1/m3-r3-formal-acceptance-g1-evidence.schema.json",
  "docs/04-governance/m3-r3-g1-scope-manifest.json",
  "docs/02-development/m3-r3-g1-formal-acceptance-handoff.md",
  "docs/04-governance/m3-r3-g1-formal-acceptance.md",
  "docs/releases/M3-R3-G1-formal-acceptance.md",
  "docs/m3-r3-g1-index.md",
  "docs/04-governance/m3-r3-p4-exact-head-acceptance.md",
  "docs/03-roadmap/m3-r3-p4-fault-security-compatibility-acceptance.md",
  "docs/releases/M3-R3-P4-fault-security-compatibility-acceptance.md",
  "logs/m3-r3-g1-focused-node22.tap",
  "logs/m3-r3-g1-adapter-node22.tap",
  "logs/m3-r3-g1-full-node22.tap",
  "logs/m3-r3-g1-compatibility-node22.tap",
  "logs/m3-r3-g1-compatibility-node24.tap"
]);

export const G1_FALSE_SAFETY_FIELDS = Object.freeze([
  "realProcessStartedInCi",
  "processIdCreatedInCi",
  "signalSentInCi",
  "k6InvokedInCi",
  "xk6InvokedInCi",
  "playwrightInvokedInCi",
  "externalProcessExecutedInCi",
  "targetNetworkAccessed",
  "databaseAccessed",
  "secretAccessed",
  "filesystemCredentialAccessed",
  "rawRuntimeOutputCollected",
  "stdoutCollected",
  "stderrCollected",
  "numericProcessIdExposed",
  "arbitraryFileReadEnabled",
  "callerPathAccepted",
  "sourceBundleModified",
  "governedOutputRootImplemented",
  "fileResultCollectionImplemented",
  "allureImplemented",
  "workerAdded",
  "queueAdded",
  "schedulerAdded",
  "containerStarted",
  "kubernetesResourceCreated",
  "remoteExecutionApiAdded"
]);

export const G1_PREDECESSOR_VALIDATORS = Object.freeze([
  "validate:m3-r3-p4-fault-security-compatibility",
  "validate:m3-r3-p3-sanitized-runtime-result",
  "validate:m3-r3-p2-bounded-process-lifecycle",
  "validate:m3-r3-p1-local-process-boundary",
  "validate:m3-r3-runtime-admission",
  "validate:m3-r2-source-generation-p5",
  "validate:m3-r1-k6-api-spec-compiler",
  "validate:m3-r0-execution-contracts",
  "validate:m2-final-release-closure"
]);
