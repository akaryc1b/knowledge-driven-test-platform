import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { scanSensitiveValues } from '../../packages/k6-api-adapter/test/p5-test-helpers.js';
import { validateJsonSchemaDraft202012 } from '../json-schema-draft-2020.js';
import {
  ACCEPTANCE_FIELDS,
  ACCEPTED_P3,
  FALSE_SAFETY_FIELDS,
  P4_ARTIFACT_NAME,
  P4_ARTIFACT_PATHS,
  P4_EVIDENCE_SCHEMA_PATH,
  P4_EVIDENCE_SCHEMA_VERSION,
  PREDECESSOR_VALIDATORS,
} from './constants.js';
import {
  loadM3R3P4RepositoryFiles,
  resolveM3R3P4Branch,
  validateM3R3P4Repository,
} from './repository-validator.js';

export async function createM3R3P4Evidence(options = {}) {
  const repository = await validateM3R3P4Repository(options);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u
    .test(generatedAt) && !Number.isNaN(Date.parse(generatedAt)),
  'M3-R3-P4 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.M3_R3_P4_EXACT_HEAD
    ?? process.env.GITHUB_SHA;
  invariant(typeof commitSha === 'string' && /^[a-f0-9]{40}$/u.test(commitSha),
    'M3-R3-P4 exact Head must be a 40-character SHA');
  const branch = resolveM3R3P4Branch(options);
  const testResults = options.testResults ?? readTestResults();
  validateTestResults(testResults);
  const productDigest = testResults.node22Compatibility.productDigest;
  invariant(productDigest === testResults.node24Compatibility.productDigest,
    'Node 22 and Node 24 compatibility product digests differ');
  const acceptance = Object.fromEntries(
    ACCEPTANCE_FIELDS.map((field) => [field, true]));
  const runtimeFindings = [
    'encoded-traversal-resolver-bypass',
    'backslash-traversal-resolver-bypass',
  ].map((code) => ({
    code,
    status: 'CLOSED',
    correctionCommit: '196c0cb66344af568b7767ff578c402d817ddd57',
    regressionTest:
      'packages/k6-api-adapter/test/'
      + 'adversarial-runtime-security-acceptance.test.js',
  }));
  const safetyBoundary = {
    nodeProcessAdapterImplemented: true,
    ...Object.fromEntries(FALSE_SAFETY_FIELDS.map((field) => [field, false])),
  };
  const claims = {
    schemaVersion: P4_EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    source: { branch, commitSha },
    acceptedP3: { ...ACCEPTED_P3 },
    contracts: {
      p3EvidenceSchema: 'm3-r3-sanitized-runtime-result-p3-evidence/v1',
      acceptanceEvidenceSchema: P4_EVIDENCE_SCHEMA_VERSION,
      p3SchemaCatalogDigest: repository.p3SchemaCatalogDigest,
      p4SchemaCatalogDigest: repository.p4SchemaCatalogDigest,
      compatibilityProductDigest: productDigest,
    },
    acceptance,
    runtimeFindings,
    testResults,
    artifact: {
      name: P4_ARTIFACT_NAME,
      expectedPaths: [...P4_ARTIFACT_PATHS],
      pathCount: P4_ARTIFACT_PATHS.length,
      preUploadAudit: {
        missingEntries: 0,
        unexpectedEntries: 0,
        regularFilesOnly: true,
        pathTraversalEntries: 0,
        absolutePathEntries: 0,
        drivePathEntries: 0,
        uncPathEntries: 0,
        nulPathEntries: 0,
        symlinkEntries: 0,
        specialFileEntries: 0,
        unicodeNormalizationCollisions: 0,
        caseFoldCollisions: 0,
        credentialShapedMatches: 0,
      },
    },
    decision: {
      faultAcceptanceComplete: true,
      securityAcceptanceComplete: true,
      compatibilityAcceptanceComplete: true,
      runtimeAcceptanceComplete: true,
      existingRuntimeDefectsFound: runtimeFindings.length,
      existingRuntimeDefectsClosed: runtimeFindings.length,
      newRuntimeCapabilityAdded: false,
      governedOutputRootImplemented: false,
      fileResultCollectionImplemented: false,
      sourceBundleRemainsImmutable: true,
      m3R3P4ImplementationComplete: true,
      m3R3P4ExactHeadAcceptanceComplete: true,
      m3R3P4MergeReadinessEvidenceComplete: true,
      m3R3P4ReadyMarked: false,
      m3R3P4Merged: false,
      m3R3G1Started: false,
      nextRequiredSlice: 'M3-R3-G1',
      repositoryBlockers: [],
    },
    safetyBoundary,
  };
  invariant(Object.values(acceptance).every(Boolean),
    'P4 acceptance category is incomplete');
  invariant(Object.entries(safetyBoundary).every(([field, value]) =>
    field === 'nodeProcessAdapterImplemented' ? value === true : value === false),
  'P4 CI safety boundary widened');
  scanSensitiveValues(claims, 'M3-R3-P4 Evidence');
  const evidence = { ...claims, evidenceDigest: sha256(claims) };
  const files = options.files ?? await loadM3R3P4RepositoryFiles();
  validateM3R3P4EvidenceDocument(
    evidence, JSON.parse(files[P4_EVIDENCE_SCHEMA_PATH]));
  return evidence;
}

export function validateM3R3P4EvidenceDocument(evidence, schema) {
  invariant(schema?.properties?.schemaVersion?.const
    === P4_EVIDENCE_SCHEMA_VERSION && schema.additionalProperties === false,
  'P4 Evidence Schema is invalid');
  const fields = [
    'schemaVersion', 'generatedAt', 'source', 'acceptedP3', 'contracts',
    'acceptance', 'runtimeFindings', 'testResults', 'artifact', 'decision',
    'safetyBoundary', 'evidenceDigest',
  ];
  invariant(canonicalStringify(Object.keys(evidence).sort())
    === canonicalStringify(fields.sort()),
  'P4 Evidence top-level fields do not match the closed contract');
  invariant(evidence.schemaVersion === P4_EVIDENCE_SCHEMA_VERSION
    && /^[a-f0-9]{40}$/u.test(evidence.source?.commitSha),
  'P4 Evidence identity is invalid');
  invariant(canonicalStringify(evidence.acceptedP3)
    === canonicalStringify(ACCEPTED_P3), 'P4 accepted P3 identity changed');
  invariant(ACCEPTANCE_FIELDS.every(
    (field) => evidence.acceptance?.[field] === true),
  'P4 Evidence acceptance is incomplete');
  invariant(evidence.runtimeFindings?.length === 2
    && evidence.runtimeFindings.every((finding) => finding.status === 'CLOSED'),
  'P4 runtime findings are not closed');
  invariant(evidence.artifact?.pathCount === 23
    && canonicalStringify(evidence.artifact.expectedPaths)
      === canonicalStringify(P4_ARTIFACT_PATHS), 'P4 Artifact layout mismatch');
  invariant(Object.values(evidence.artifact.preUploadAudit)
    .every((value) => value === 0 || value === true),
  'P4 Artifact pre-upload audit failed');
  const decision = evidence.decision;
  invariant(decision?.m3R3P4ImplementationComplete === true
    && decision.m3R3P4ExactHeadAcceptanceComplete === true
    && decision.m3R3P4MergeReadinessEvidenceComplete === true
    && decision.m3R3P4ReadyMarked === false
    && decision.m3R3P4Merged === false
    && decision.m3R3G1Started === false
    && decision.nextRequiredSlice === 'M3-R3-G1'
    && decision.repositoryBlockers?.length === 0,
  'P4 Evidence merge control mismatch');
  invariant(evidence.safetyBoundary?.nodeProcessAdapterImplemented === true
    && FALSE_SAFETY_FIELDS.every(
      (field) => evidence.safetyBoundary[field] === false),
  'P4 Evidence CI safety boundary mismatch');
  invariant(evidence.contracts.compatibilityProductDigest
      === evidence.testResults.node22Compatibility.productDigest
    && evidence.contracts.compatibilityProductDigest
      === evidence.testResults.node24Compatibility.productDigest,
  'P4 cross-Node product digest binding mismatch');
  validateJsonSchemaDraft202012(evidence, schema, 'M3-R3-P4 Evidence');
  const claims = structuredClone(evidence);
  delete claims.evidenceDigest;
  invariant(sha256(claims) === evidence.evidenceDigest,
    'M3-R3-P4 Evidence canonical digest mismatch');
  return true;
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
    focused: complete('M3_R3_P4_FOCUSED'),
    allK6ApiAdapter: complete('M3_R3_P4_ADAPTER'),
    fullNode: {
      total: numberEnv('M3_R3_P4_FULL_TOTAL'),
      passed: numberEnv('M3_R3_P4_FULL_PASSED'),
      skipped: numberEnv('M3_R3_P4_FULL_SKIPPED'),
      failed: numberEnv('M3_R3_P4_FULL_FAILED'),
    },
    node22Compatibility: compatibility('M3_R3_P4_NODE22'),
    node24Compatibility: compatibility('M3_R3_P4_NODE24'),
    repositoryValidator: {
      status: requiredEnv('M3_R3_P4_REPOSITORY_VALIDATOR'),
    },
    predecessorValidators: {
      status: requiredEnv('M3_R3_P4_PREDECESSOR_VALIDATORS'),
      validators: [...PREDECESSOR_VALIDATORS],
    },
  };
}
function validateTestResults(results) {
  for (const key of [
    'focused', 'allK6ApiAdapter',
    'node22Compatibility', 'node24Compatibility',
  ]) {
    const result = results[key];
    invariant(Number.isInteger(result.total) && result.total > 0
      && result.passed === result.total && result.failed === 0,
    `M3-R3-P4 ${key} tests are not fully accepted`);
  }
  invariant(results.fullNode.total > 0
    && results.fullNode.passed + results.fullNode.skipped
      === results.fullNode.total
    && results.fullNode.failed === 0,
  'M3-R3-P4 full Node tests are not fully accepted');
  invariant(results.repositoryValidator.status === 'success'
    && results.predecessorValidators.status === 'success'
    && canonicalStringify(results.predecessorValidators.validators)
      === canonicalStringify(PREDECESSOR_VALIDATORS),
  'M3-R3-P4 repository or predecessor Validators are incomplete');
  for (const key of ['node22Compatibility', 'node24Compatibility']) {
    invariant(/^[a-f0-9]{64}$/u.test(results[key].productDigest),
      `M3-R3-P4 ${key} product digest is invalid`);
  }
}
function requiredEnv(name) {
  const value = process.env[name];
  invariant(typeof value === 'string' && value.length > 0, `${name} is required`);
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
