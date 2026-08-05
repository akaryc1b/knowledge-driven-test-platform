export const P4_EVIDENCE_SCHEMA_VERSION =
  'm3-r3-fault-security-compatibility-p4-evidence/v1';
export const P4_CATALOG_PATH =
  'schemas/execution/k6-api-runtime/p4-schema-catalog.json';
export const P3_CATALOG_PATH =
  'schemas/execution/k6-api-runtime/p3-schema-catalog.json';
export const P4_EVIDENCE_SCHEMA_PATH =
  'schemas/execution/k6-api-runtime/v1/'
  + 'm3-r3-fault-security-compatibility-p4-evidence.schema.json';

export const ACCEPTED_P3 = Object.freeze({
  p3Issue: 64,
  p3ImplementationPr: 65,
  p3ImplementationSourceHead: '2d573b62aa78e66c7b767e55004ed0e0d41b512d',
  p3ImplementationMergeSha: 'e406e82fdb5ffba6ccfa527a1e069675ed39f03b',
  p3CorrectionPr: 66,
  p3CorrectionSourceHead: 'dc202168e26f26d08084273cebeb3efd3073c0af',
  p3CorrectionMergeSha: '8684836233837c905e0ced20e8eac2cfd0b43601',
  p3ExactMainRun: 30972073647,
  p3ExactMainJob: 92198391799,
  p3ExactMainArtifact: 8916886644,
  p3ExactMainArtifactDigest:
    'sha256:03aa6427219be39b0daf771d08a7a604b9a4e4c17ccf9ec314ef3d55f39c74f4',
  p3CanonicalEvidenceDigest:
    '5420c474aa95840fc216c8ff61de52dfbc4d8d137a10d5233e82d6f6963ab6c7',
  p3SchemaCatalogDigest:
    'f9eb33758c4ccc9433a613569f3a524759f7f381e307a75b65c49d4a3e925cc0',
  p3RuntimeExecutionEvidenceDigest:
    'a0bef0eca6a8ec5b02535f0688e14e3a8ca16c2f5fdda746ec14b8f76ab2afd9',
});

export const P4_ARTIFACT_NAME =
  'm3-r3-p4-fault-security-compatibility-evidence';
export const P4_ARTIFACT_PATHS = Object.freeze([
  'evidence/m3-r3-p4-fault-security-compatibility-evidence.json',
  P4_CATALOG_PATH,
  P3_CATALOG_PATH,
  'schemas/execution/k6-api-runtime/v1/k6-node-process-adapter.schema.json',
  'schemas/execution/k6-api-runtime/v1/k6-process-execution-command.schema.json',
  'schemas/execution/k6-api-runtime/v1/k6-process-lifecycle-evidence.schema.json',
  'schemas/execution/k6-api-runtime/v1/k6-process-terminal-observation.schema.json',
  'schemas/execution/k6-api-runtime/v1/k6-sanitized-runtime-outcome.schema.json',
  'schemas/execution/k6-api-runtime/v1/k6-runtime-execution-evidence.schema.json',
  'schemas/execution/k6-api-runtime/v1/'
    + 'm3-r3-sanitized-runtime-result-p3-evidence.schema.json',
  P4_EVIDENCE_SCHEMA_PATH,
  'docs/02-development/m3-r3-p4-fault-security-compatibility-handoff.md',
  'docs/03-roadmap/m3-r3-p4-fault-security-compatibility-acceptance.md',
  'docs/04-governance/'
    + 'm3-r3-p4-fault-security-compatibility-acceptance-matrix.md',
  'docs/04-governance/m3-r3-p4-exact-head-acceptance.md',
  'docs/05-adr/ADR-0034-linux-node22-node24-runtime-acceptance.md',
  'docs/06-security/'
    + 'm3-r3-p4-fault-security-compatibility-threat-model.md',
  'docs/releases/M3-R3-P4-fault-security-compatibility-acceptance.md',
  'logs/m3-r3-p4-focused-node22.tap',
  'logs/m3-r3-p4-adapter-node22.tap',
  'logs/m3-r3-p4-full-node22.tap',
  'logs/m3-r3-p4-compatibility-node22.tap',
  'logs/m3-r3-p4-compatibility-node24.tap',
]);

export const WORKFLOW_PATH =
  '.github/workflows/m3-r3-p4-fault-security-compatibility-acceptance.yml';
export const VALIDATOR_PATH =
  'scripts/validate-m3-r3-p4-fault-security-compatibility.js';
export const VALIDATOR_MODULE_PATHS = Object.freeze([
  'scripts/m3-r3-p4/constants.js',
  'scripts/m3-r3-p4/repository-validator.js',
  'scripts/m3-r3-p4/evidence.js',
  'scripts/m3-r3-p4/ci-node22.sh',
  'scripts/m3-r3-p4/ci-node24.sh',
  'scripts/m3-r3-p4/ci-artifact.js',
]);
export const TEST_PATHS = Object.freeze([
  'packages/k6-api-adapter/test/fault-security-compatibility-r0.test.js',
  'packages/k6-api-adapter/test/fault-lifecycle-race-acceptance.test.js',
  'packages/k6-api-adapter/test/adversarial-runtime-security-acceptance.test.js',
  'packages/k6-api-adapter/test/compatibility-determinism-acceptance.test.js',
  'packages/k6-api-adapter/test/'
    + 'fault-security-compatibility-validator.test.js',
]);

export const PREDECESSOR_VALIDATORS = Object.freeze([
  'validate:m3-r3-p3-sanitized-runtime-result',
  'validate:m3-r3-p2-bounded-process-lifecycle',
  'validate:m3-r3-p1-local-process-boundary',
  'validate:m3-r3-runtime-admission',
  'validate:m3-r2-source-generation-p5',
  'validate:m3-r1-k6-api-spec-compiler',
  'validate:m3-r0-execution-contracts',
  'validate:m2-final-release-closure',
  'validate:m2-portable-release-readiness',
  'validate:m2-r2a-external-evidence-intake',
]);
export const ACCEPTANCE_FIELDS = Object.freeze([
  'faultAcceptance', 'raceAcceptance', 'cancellationAcceptance',
  'timeoutAcceptance', 'forcedTerminationAcceptance', 'resolverAcceptance',
  'processPrimitiveBoundaryAcceptance', 'argvInjectionAcceptance',
  'adapterIdentityAcceptance', 'environmentIsolationAcceptance',
  'sensitiveMaterialAcceptance', 'pathIsolationAcceptance',
  'digestBindingAcceptance', 'schemaCompatibilityAcceptance',
  'publicApiCompatibilityAcceptance', 'node22CompatibilityAcceptance',
  'node24CompatibilityAcceptance', 'determinismAcceptance',
  'artifactPortabilityAcceptance', 'fileResultDeferralAcceptance',
]);
export const FALSE_SAFETY_FIELDS = Object.freeze([
  'realProcessStartedInCi', 'processIdCreatedInCi', 'signalSentInCi',
  'k6InvokedInCi', 'xk6InvokedInCi', 'playwrightInvokedInCi',
  'externalProcessExecutedInCi', 'targetNetworkAccessed', 'databaseAccessed',
  'secretAccessed', 'filesystemCredentialAccessed',
  'rawRuntimeOutputCollected', 'stdoutCollected', 'stderrCollected',
  'numericProcessIdExposed', 'arbitraryFileReadEnabled', 'callerPathAccepted',
  'sourceBundleModified', 'governedOutputRootImplemented',
  'fileResultCollectionImplemented', 'allureImplemented', 'workerAdded',
  'queueAdded', 'schedulerAdded', 'containerStarted',
  'kubernetesResourceCreated', 'remoteExecutionApiAdded', 'm3R3G1Started',
]);
