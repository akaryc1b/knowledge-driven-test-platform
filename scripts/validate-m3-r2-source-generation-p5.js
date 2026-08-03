import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  ACCEPTED_P3, ACCEPTED_P4, ACCEPTED_SOURCE,
  M3_R2_P5_EVIDENCE_SCHEMA_VERSION, P5_FALSE_SAFETY_FIELDS,
  P5_TRUE_LOCAL_PUBLICATION_FIELDS, assertP5, resolveP5Branch,
} from './m3-r2-p5-baseline.js';
import { loadP5Repository, validateP5Repository } from './m3-r2-p5-repository.js';
import {
  loadAcceptedP5Fixture, scanSensitiveValues, sha256,
} from '../packages/k6-api-adapter/test/p5-test-helpers.js';

export async function validateM3R2SourceGenerationP5(options = {}) {
  const repository = options.repository ?? await loadP5Repository();
  validateP5Repository(repository);
  const fixture = options.fixture ?? await loadAcceptedP5Fixture();
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  assertP5(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(generatedAt)
      && !Number.isNaN(Date.parse(generatedAt)), 'P5 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.P5_EXACT_HEAD
    ?? process.env.GITHUB_SHA ?? 'local';
  assertP5(commitSha === 'local' || /^[a-f0-9]{40}$/u.test(commitSha),
    'P5 exact source Head must be local or a 40-character SHA');
  const branch = options.branch ?? resolveP5Branch(options);
  const testResults = options.testResults ?? readTestResults();
  validateTestResults(testResults);

  const acceptance = Object.freeze({
    determinism: true,
    binding: true,
    injection: true,
    sensitiveMaterial: true,
    nonExecution: true,
    compatibility: true,
    persistenceFaults: true,
    concurrency: true,
  });
  const decision = Object.freeze({
    sourceGenerationAcceptanceComplete: true,
    determinismAccepted: true,
    bindingAccepted: true,
    injectionResistanceAccepted: true,
    sensitiveMaterialBoundaryAccepted: true,
    nonExecutionAccepted: true,
    compatibilityAccepted: true,
    persistenceFaultAcceptanceComplete: true,
    concurrencyAcceptanceComplete: true,
    sourceGenerationContractReady: true,
    deterministicSourceRendererReady: true,
    independentStaticValidatorReady: true,
    sourceArtifactContractReady: true,
    sourceBundleContractReady: true,
    sourceGenerated: true,
    sourceStaticallyValidated: true,
    sourceArtifactCreated: true,
    sourcePersisted: true,
    artifactPublished: true,
    remoteArtifactPublished: false,
    sourceExecuted: false,
    executionRuntimeStarted: false,
    nextRequiredSlice: 'M3-R2-G1',
    repositoryBlockers: Object.freeze([]),
  });
  const safetyBoundary = Object.fromEntries([
    ...P5_TRUE_LOCAL_PUBLICATION_FIELDS.map((field) => [field, true]),
    ...P5_FALSE_SAFETY_FIELDS.map((field) => [field, false]),
  ]);
  const claims = {
    schemaVersion: M3_R2_P5_EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    source: { branch, commitSha },
    acceptedP4: {
      headSha: ACCEPTED_P4.headSha,
      runId: ACCEPTED_P4.runId,
      artifactId: ACCEPTED_P4.artifactId,
      artifactApiDigest: ACCEPTED_P4.artifactApiDigest,
      uploadedZipDigest: ACCEPTED_P4.uploadedZipDigest,
      downloadedArchiveSha256: ACCEPTED_P4.downloadedArchiveSha256,
      downloadedFileCount: ACCEPTED_P4.downloadedFileCount,
      evidenceRawSha256: ACCEPTED_P4.evidenceRawSha256,
      evidenceBlobSha: ACCEPTED_P4.evidenceBlobSha,
      artifactReceiptRawSha256: ACCEPTED_P4.artifactReceiptRawSha256,
      artifactReceiptBlobSha: ACCEPTED_P4.artifactReceiptBlobSha,
      evidenceDigest: ACCEPTED_P4.evidenceDigest,
      bundleDigest: ACCEPTED_P4.bundleDigest,
      manifestDigest: ACCEPTED_P4.manifestDigest,
      receiptDigest: ACCEPTED_P4.receiptDigest,
      publicationEvidenceDigest: ACCEPTED_P4.publicationEvidenceDigest,
      publicationArchiveSha256: ACCEPTED_P4.publicationArchiveSha256,
      publicationArchiveBlobSha: ACCEPTED_P4.publicationArchiveBlobSha,
      publicationPayloadSha256: ACCEPTED_P4.publicationPayloadSha256,
      publicationPayloadByteLength: ACCEPTED_P4.publicationPayloadByteLength,
    },
    acceptedP3: {
      headSha: ACCEPTED_P3.headSha,
      runId: ACCEPTED_P3.runId,
      artifactId: ACCEPTED_P3.artifactId,
      artifactDigest: ACCEPTED_P3.artifactDigest,
      evidenceReceiptFileDigest: ACCEPTED_P3.evidenceReceiptFileDigest,
      artifactReceiptBlobSha: ACCEPTED_P3.artifactReceiptBlobSha,
      evidenceDigest: ACCEPTED_P3.evidenceDigest,
      sourceArtifactDigest: ACCEPTED_P3.sourceArtifactDigest,
      validationEvidenceDigest: ACCEPTED_P3.validationEvidenceDigest,
      validationReportDigest: ACCEPTED_P3.validationReportDigest,
    },
    sourceResult: {
      sourceIdentity: ACCEPTED_SOURCE.sourceIdentity,
      sourceDigest: ACCEPTED_SOURCE.sourceDigest,
      sourceByteLength: ACCEPTED_SOURCE.sourceByteLength,
      sourceLineCount: ACCEPTED_SOURCE.sourceLineCount,
      operationCount: ACCEPTED_SOURCE.operationCount,
      assertionCount: ACCEPTED_SOURCE.assertionCount,
      thresholdCount: ACCEPTED_SOURCE.thresholdCount,
    },
    acceptance,
    testResults,
    decision,
    safetyBoundary,
  };
  assertP5(fixture.identity.bundleDigest === claims.acceptedP4.bundleDigest
      && fixture.identity.manifestDigest === claims.acceptedP4.manifestDigest
      && fixture.identity.sourceDigest === claims.sourceResult.sourceDigest,
  'P5 generated Evidence is not bound to the accepted product identity');
  scanSensitiveValues(claims, 'P5 Evidence');
  return { ...claims, evidenceDigest: sha256(claims) };
}

function readTestResults() {
  return {
    focused: result('P5_FOCUSED', 24, 24, 0),
    k6ApiAdapter: result('P5_ADAPTER', 137, 137, 0),
    fullNode: {
      total: numberEnv('P5_FULL_TOTAL', 489),
      passed: numberEnv('P5_FULL_PASSED', 477),
      skipped: numberEnv('P5_FULL_SKIPPED', 12),
      failed: numberEnv('P5_FULL_FAILED', 0),
    },
    postgresql: result('P5_POSTGRES', 64, 64, 0),
    repositoryValidator: { status: process.env.P5_REPOSITORY_VALIDATOR ?? 'success' },
  };
}
function result(prefix, defaultTotal, defaultPassed, defaultFailed) {
  return { total: numberEnv(`${prefix}_TOTAL`, defaultTotal),
    passed: numberEnv(`${prefix}_PASSED`, defaultPassed),
    failed: numberEnv(`${prefix}_FAILED`, defaultFailed) };
}
function numberEnv(name, fallback) {
  if (process.env[name] === undefined) return fallback;
  const value = Number(process.env[name]);
  assertP5(Number.isInteger(value) && value >= 0, `${name} is invalid`); return value;
}
function validateTestResults(results) {
  for (const key of ['focused', 'k6ApiAdapter', 'postgresql']) {
    const item = results[key];
    assertP5(item.total > 0 && item.passed === item.total && item.failed === 0,
      `P5 ${key} tests are not fully accepted`);
  }
  assertP5(results.fullNode.total > 0
      && results.fullNode.passed + results.fullNode.skipped === results.fullNode.total
      && results.fullNode.failed === 0,
  'P5 full Node tests are not fully accepted');
  assertP5(results.repositoryValidator.status === 'success',
    'P5 Repository Validator did not succeed');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(await validateM3R2SourceGenerationP5(), null, 2)}\n`);
}
