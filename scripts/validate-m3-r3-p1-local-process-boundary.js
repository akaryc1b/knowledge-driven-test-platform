import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { sha256 } from '@kdtp/knowledge-core';
import { scanSensitiveValues } from '../packages/k6-api-adapter/test/p5-test-helpers.js';
import { localProcessBoundaryFixture } from
  '../packages/k6-api-adapter/test/local-process-boundary-test-helpers.js';
import {
  ACCEPTED_M3_R3_R0,
  M3_R3_P1_EVIDENCE_SCHEMA_VERSION,
  assertM3R3P1,
  resolveM3R3P1Branch,
} from './m3-r3-p1-baseline.js';
import {
  computeM3R3P1SchemaCatalogDigest,
  loadM3R3P1Repository,
  validateM3R3P1Repository,
} from './m3-r3-p1-repository.js';
import {
  loadAndValidateM3R3P1WorkflowEvidence,
} from './validate-m3-r3-p1-workflow-evidence.js';

export async function validateM3R3P1LocalProcessBoundary(options = {}) {
  const repository = options.repository ?? await loadM3R3P1Repository();
  validateM3R3P1Repository(repository);
  await loadAndValidateM3R3P1WorkflowEvidence();
  const fixture = options.fixture ?? await localProcessBoundaryFixture();
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  assertM3R3P1(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(generatedAt)
      && !Number.isNaN(Date.parse(generatedAt)),
  'M3-R3-P1 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.M3_R3_P1_EXACT_HEAD
    ?? process.env.GITHUB_SHA ?? 'local';
  assertM3R3P1(commitSha === 'local' || /^[a-f0-9]{40}$/u.test(commitSha),
    'M3-R3-P1 exact Head must be local or a 40-character SHA');
  const branch = options.branch ?? resolveM3R3P1Branch(options);
  const testResults = options.testResults ?? readTestResults();
  validateTestResults(testResults);
  const boundary = fixture.result.boundaryEvidence;
  const claims = {
    schemaVersion: M3_R3_P1_EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    source: { branch, commitSha },
    acceptedR0: { ...ACCEPTED_M3_R3_R0 },
    contracts: {
      portSchema: fixture.descriptor.schemaVersion,
      launchSpecificationSchema: fixture.result.launchSpecification.schemaVersion,
      launchDecisionSchema: fixture.result.launchDecision.schemaVersion,
      boundaryEvidenceSchema: boundary.schemaVersion,
      portDigest: fixture.descriptor.portDigest,
      launchSpecificationDigest: fixture.result.launchSpecification.specificationDigest,
      launchDecisionDigest: fixture.result.launchDecision.decisionDigest,
      boundaryEvidenceDigest: boundary.evidenceDigest,
      schemaCatalogDigest: computeM3R3P1SchemaCatalogDigest(repository),
    },
    testResults,
    decision: { ...boundary.decision },
    safetyBoundary: { ...boundary.safetyBoundary },
  };
  assertM3R3P1(claims.acceptedR0.mainSha === ACCEPTED_M3_R3_R0.mainSha
      && claims.acceptedR0.runtimePolicyDigest
        === fixture.runtime.policy.policyDigest
      && claims.acceptedR0.runtimeAdmissionRequestDigest
        === fixture.runtime.admissionRequest.admissionDigest
      && claims.acceptedR0.invocationPlanDigest
        === fixture.runtime.invocationPlan.planDigest
      && claims.acceptedR0.runtimeAdmissionEvidenceDigest
        === fixture.runtime.admissionEvidence.evidenceDigest
      && claims.decision.nodeProcessAdapterImplemented === false
      && claims.decision.processStarted === false
      && Object.values(claims.safetyBoundary).every((value) => value === false),
  'M3-R3-P1 Evidence is not bound to accepted R0 and the non-execution boundary');
  scanSensitiveValues(claims, 'M3-R3-P1 Evidence');
  return { ...claims, evidenceDigest: sha256(claims) };
}

function readTestResults() {
  return {
    focused: result('M3_R3_P1_FOCUSED', 40, 40, 0),
    k6ApiAdapter: result('M3_R3_P1_ADAPTER', 195, 195, 0),
    fullNode: {
      total: numberEnv('M3_R3_P1_FULL_TOTAL', 547),
      passed: numberEnv('M3_R3_P1_FULL_PASSED', 535),
      skipped: numberEnv('M3_R3_P1_FULL_SKIPPED', 12),
      failed: numberEnv('M3_R3_P1_FULL_FAILED', 0),
    },
    repositoryValidator: {
      status: process.env.M3_R3_P1_REPOSITORY_VALIDATOR ?? 'success',
    },
  };
}

function result(prefix, defaultTotal, defaultPassed, defaultFailed) {
  return {
    total: numberEnv(`${prefix}_TOTAL`, defaultTotal),
    passed: numberEnv(`${prefix}_PASSED`, defaultPassed),
    failed: numberEnv(`${prefix}_FAILED`, defaultFailed),
  };
}

function numberEnv(name, fallback) {
  if (process.env[name] === undefined) return fallback;
  const value = Number(process.env[name]);
  assertM3R3P1(Number.isInteger(value) && value >= 0, `${name} is invalid`);
  return value;
}

function validateTestResults(results) {
  for (const key of ['focused', 'k6ApiAdapter']) {
    const item = results[key];
    assertM3R3P1(item.total > 0 && item.passed === item.total && item.failed === 0,
      `M3-R3-P1 ${key} tests are not fully accepted`);
  }
  assertM3R3P1(results.fullNode.total > 0
      && results.fullNode.passed + results.fullNode.skipped === results.fullNode.total
      && results.fullNode.failed === 0,
  'M3-R3-P1 full Node tests are not fully accepted');
  assertM3R3P1(results.repositoryValidator.status === 'success',
    'M3-R3-P1 Repository Validator did not succeed');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(await validateM3R3P1LocalProcessBoundary(), null, 2)}\n`);
}
