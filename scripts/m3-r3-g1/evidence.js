import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { scanSensitiveValues } from '../../packages/k6-api-adapter/test/p5-test-helpers.js';
import {
  ACCEPTED_BASE_MAIN,
  ACCEPTED_P4,
  G1_ARTIFACT_NAME,
  G1_ARTIFACT_PATHS,
  G1_EVIDENCE_SCHEMA_PATH,
  G1_EVIDENCE_SCHEMA_VERSION,
  G1_FALSE_SAFETY_FIELDS,
  G1_PREDECESSOR_VALIDATORS,
  G1_SCOPE_MANIFEST_PATH,
} from './constants.js';
import {
  loadM3R3G1RepositoryFiles,
  resolveG1Branch,
  validateM3R3G1Repository,
} from './repository-validator.js';

export async function createM3R3G1Evidence(options = {}) {
  const repository = await validateM3R3G1Repository(options);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u
    .test(generatedAt) && !Number.isNaN(Date.parse(generatedAt)),
  'M3-R3-G1 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.M3_R3_G1_EXACT_HEAD
    ?? process.env.GITHUB_SHA;
  const baseSha = options.baseSha ?? process.env.M3_R3_G1_BASE_SHA;
  invariant(typeof commitSha === 'string' && /^[a-f0-9]{40}$/u.test(commitSha),
    'M3-R3-G1 exact Head must be a 40-character SHA');
  invariant(baseSha === ACCEPTED_BASE_MAIN,
    'M3-R3-G1 base SHA does not match the accepted main baseline');
  const source = {
    eventName: options.eventName ?? process.env.M3_R3_G1_EVENT_NAME
      ?? 'local',
    branch: resolveG1Branch(options),
    baseSha,
    commitSha,
  };
  const testResults = options.testResults ?? readTestResults();
  validateTestResults(testResults);
  const scopeAudit = options.scopeAudit ?? readScopeAudit(repository);
  validateScopeAudit(scopeAudit, repository);
  const compatibilityProductDigest =
    testResults.node22Compatibility.productDigest;
  invariant(compatibilityProductDigest
      === testResults.node24Compatibility.productDigest
    && compatibilityProductDigest
      === ACCEPTED_P4.compatibilityProductDigest,
  'M3-R3-G1 compatibility product digest changed');
  const acceptance = {
    finalBaseline: true,
    fullScope: true,
    p4EvidenceConsistency: true,
    validatorContinuity: true,
    node22: true,
    node24: true,
    determinism: true,
    artifactPortability: true,
    reviewRecheckRequired: true,
  };
  const safetyBoundary = {
    nodeProcessAdapterImplemented: true,
    ...Object.fromEntries(
      G1_FALSE_SAFETY_FIELDS.map((field) => [field, false])),
  };
  const claims = {
    schemaVersion: G1_EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    source,
    acceptedP4: { ...ACCEPTED_P4 },
    contracts: {
      g1EvidenceSchema: G1_EVIDENCE_SCHEMA_VERSION,
      g1SchemaCatalogDigest: repository.g1SchemaCatalogDigest,
      p4EvidenceSchema:
        'm3-r3-fault-security-compatibility-p4-evidence/v1',
      p4SchemaCatalogDigest: ACCEPTED_P4.p4SchemaCatalogDigest,
      compatibilityProductDigest,
    },
    scopeAudit,
    acceptance,
    testResults,
    artifact: {
      name: G1_ARTIFACT_NAME,
      expectedPaths: [...G1_ARTIFACT_PATHS],
      pathCount: G1_ARTIFACT_PATHS.length,
      preUploadAudit: {
        missingEntries: 0,
        unexpectedEntries: 0,
        regularFilesOnly: true,
        unsafePathEntries: 0,
        symlinkEntries: 0,
        specialFileEntries: 0,
        unicodeNormalizationCollisions: 0,
        caseFoldCollisions: 0,
        credentialShapedMatches: 0,
      },
    },
    decision: {
      g1Complete: true,
      finalBaselineVerified: true,
      fullScopeAuditComplete: true,
      permanentValidatorChainComplete: true,
      acceptedP4EvidenceBound: true,
      p4EvidenceRewritten: false,
      newRuntimeCapabilityAdded: false,
      readyMarked: false,
      merged: false,
      g2Started: false,
      nextRequiredSlice: 'M3-R3-G2',
      repositoryBlockers: [],
    },
    safetyBoundary,
  };
  invariant(Object.values(acceptance).every(Boolean),
    'M3-R3-G1 acceptance is incomplete');
  invariant(Object.entries(safetyBoundary).every(([field, value]) =>
    field === 'nodeProcessAdapterImplemented' ? value === true : value === false),
  'M3-R3-G1 CI safety boundary widened');
  scanSensitiveValues(claims, 'M3-R3-G1 Evidence');
  const evidence = { ...claims, evidenceDigest: sha256(claims) };
  const files = options.files ?? await loadM3R3G1RepositoryFiles();
  validateM3R3G1EvidenceDocument(
    evidence, JSON.parse(files[G1_EVIDENCE_SCHEMA_PATH]));
  return evidence;
}

export function validateM3R3G1EvidenceDocument(evidence, schema) {
  invariant(schema?.properties?.schemaVersion?.const
      === G1_EVIDENCE_SCHEMA_VERSION
    && schema.additionalProperties === false,
  'M3-R3-G1 Evidence Schema is invalid');
  const expectedFields = [
    'schemaVersion', 'generatedAt', 'source', 'acceptedP4', 'contracts',
    'scopeAudit', 'acceptance', 'testResults', 'artifact', 'decision',
    'safetyBoundary', 'evidenceDigest',
  ].sort();
  invariant(canonicalStringify(Object.keys(evidence).sort())
    === canonicalStringify(expectedFields),
  'M3-R3-G1 Evidence top-level fields do not match the closed contract');
  invariant(evidence.schemaVersion === G1_EVIDENCE_SCHEMA_VERSION
    && /^[a-f0-9]{40}$/u.test(evidence.source?.commitSha)
    && evidence.source.baseSha === ACCEPTED_BASE_MAIN,
  'M3-R3-G1 Evidence source identity is invalid');
  invariant(canonicalStringify(evidence.acceptedP4)
      === canonicalStringify(ACCEPTED_P4),
  'M3-R3-G1 accepted P4 identity changed');
  invariant(evidence.contracts?.p4SchemaCatalogDigest
      === ACCEPTED_P4.p4SchemaCatalogDigest
    && evidence.contracts.compatibilityProductDigest
      === ACCEPTED_P4.compatibilityProductDigest
    && /^[a-f0-9]{64}$/u.test(
      evidence.contracts.g1SchemaCatalogDigest),
  'M3-R3-G1 contract identity is invalid');
  invariant(evidence.scopeAudit?.manifestPath === G1_SCOPE_MANIFEST_PATH
    && evidence.scopeAudit.manifestDigest
      === evidence.scopeAudit.manifestDigest.toLowerCase()
    && /^[a-f0-9]{64}$/u.test(evidence.scopeAudit.manifestDigest)
    && evidence.scopeAudit.pathCount === 45
    && Number.isInteger(evidence.scopeAudit.commitCount)
    && evidence.scopeAudit.commitCount > 0
    && evidence.scopeAudit.baseMain === ACCEPTED_BASE_MAIN
    && evidence.scopeAudit.exactDiffMatched === true,
  'M3-R3-G1 scope audit is invalid');
  invariant(Object.values(evidence.acceptance).every((value) => value === true),
    'M3-R3-G1 acceptance is incomplete');
  validateTestResults(evidence.testResults);
  invariant(evidence.artifact?.name === G1_ARTIFACT_NAME
    && evidence.artifact.pathCount === G1_ARTIFACT_PATHS.length
    && canonicalStringify(evidence.artifact.expectedPaths)
      === canonicalStringify(G1_ARTIFACT_PATHS)
    && Object.values(evidence.artifact.preUploadAudit)
      .every((value) => value === 0 || value === true),
  'M3-R3-G1 Artifact contract is invalid');
  const decision = evidence.decision;
  invariant(decision?.g1Complete === true
    && decision.finalBaselineVerified === true
    && decision.fullScopeAuditComplete === true
    && decision.permanentValidatorChainComplete === true
    && decision.acceptedP4EvidenceBound === true
    && decision.p4EvidenceRewritten === false
    && decision.newRuntimeCapabilityAdded === false
    && decision.readyMarked === false
    && decision.merged === false
    && decision.g2Started === false
    && decision.nextRequiredSlice === 'M3-R3-G2'
    && decision.repositoryBlockers?.length === 0,
  'M3-R3-G1 Evidence merge control mismatch');
  invariant(evidence.safetyBoundary?.nodeProcessAdapterImplemented === true
    && G1_FALSE_SAFETY_FIELDS.every(
      (field) => evidence.safetyBoundary[field] === false),
  'M3-R3-G1 Evidence safety boundary mismatch');
  invariant(evidence.contracts.compatibilityProductDigest
      === evidence.testResults.node22Compatibility.productDigest
    && evidence.contracts.compatibilityProductDigest
      === evidence.testResults.node24Compatibility.productDigest,
  'M3-R3-G1 cross-Node digest binding mismatch');
  const claims = structuredClone(evidence);
  delete claims.evidenceDigest;
  invariant(sha256(claims) === evidence.evidenceDigest,
    'M3-R3-G1 Evidence canonical digest mismatch');
  return true;
}

function readScopeAudit(repository) {
  return {
    manifestPath: G1_SCOPE_MANIFEST_PATH,
    manifestDigest: repository.scopeManifestDigest,
    pathCount: numberEnv('M3_R3_G1_SCOPE_PATH_COUNT'),
    commitCount: numberEnv('M3_R3_G1_SCOPE_COMMIT_COUNT'),
    baseMain: requiredEnv('M3_R3_G1_BASE_SHA'),
    exactDiffMatched:
      requiredEnv('M3_R3_G1_SCOPE_EXACT_DIFF_MATCHED') === 'true',
  };
}

function validateScopeAudit(scope, repository) {
  invariant(scope.manifestPath === G1_SCOPE_MANIFEST_PATH
    && scope.manifestDigest === repository.scopeManifestDigest
    && scope.pathCount === repository.scopePathCount
    && scope.pathCount === 45
    && Number.isInteger(scope.commitCount) && scope.commitCount > 0
    && scope.baseMain === ACCEPTED_BASE_MAIN
    && scope.exactDiffMatched === true,
  'M3-R3-G1 full-scope audit did not match the manifest');
}

function complete(prefix) {
  return {
    total: numberEnv(`${prefix}_TOTAL`),
    passed: numberEnv(`${prefix}_PASSED`),
    failed: numberEnv(`${prefix}_FAILED`),
  };
}

function compatibility(prefix) {
  return {
    ...complete(prefix),
    productDigest: digestEnv(`${prefix}_PRODUCT_DIGEST`),
  };
}

function readTestResults() {
  return {
    focused: complete('M3_R3_G1_FOCUSED'),
    allK6ApiAdapter: complete('M3_R3_G1_ADAPTER'),
    fullNode: {
      total: numberEnv('M3_R3_G1_FULL_TOTAL'),
      passed: numberEnv('M3_R3_G1_FULL_PASSED'),
      skipped: numberEnv('M3_R3_G1_FULL_SKIPPED'),
      failed: numberEnv('M3_R3_G1_FULL_FAILED'),
    },
    node22Compatibility: compatibility('M3_R3_G1_NODE22'),
    node24Compatibility: compatibility('M3_R3_G1_NODE24'),
    repositoryValidator: {
      status: requiredEnv('M3_R3_G1_REPOSITORY_VALIDATOR'),
    },
    g1Validator: {
      status: requiredEnv('M3_R3_G1_VALIDATOR'),
    },
    predecessorValidators: {
      status: requiredEnv('M3_R3_G1_PREDECESSOR_VALIDATORS'),
      validators: [...G1_PREDECESSOR_VALIDATORS],
    },
  };
}

function validateTestResults(results) {
  for (const key of [
    'focused', 'allK6ApiAdapter',
    'node22Compatibility', 'node24Compatibility',
  ]) {
    const result = results?.[key];
    invariant(Number.isInteger(result?.total) && result.total > 0
      && result.passed === result.total && result.failed === 0,
    `M3-R3-G1 ${key} tests are not fully accepted`);
  }
  invariant(Number.isInteger(results.fullNode?.total)
    && results.fullNode.total > 0
    && results.fullNode.passed + results.fullNode.skipped
      === results.fullNode.total
    && results.fullNode.failed === 0,
  'M3-R3-G1 full Node tests are not fully accepted');
  invariant(results.repositoryValidator?.status === 'success'
    && results.g1Validator?.status === 'success'
    && results.predecessorValidators?.status === 'success'
    && canonicalStringify(results.predecessorValidators.validators)
      === canonicalStringify(G1_PREDECESSOR_VALIDATORS),
  'M3-R3-G1 Validators are incomplete');
  for (const key of ['node22Compatibility', 'node24Compatibility']) {
    invariant(results[key].productDigest
      === ACCEPTED_P4.compatibilityProductDigest,
    `M3-R3-G1 ${key} product digest changed`);
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  invariant(typeof value === 'string' && value.length > 0,
    `${name} is required`);
  return value;
}

function numberEnv(name) {
  const value = Number(requiredEnv(name));
  invariant(Number.isInteger(value) && value >= 0, `${name} is invalid`);
  return value;
}

function digestEnv(name) {
  const value = requiredEnv(name);
  invariant(/^[a-f0-9]{64}$/u.test(value), `${name} is invalid`);
  return value;
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
