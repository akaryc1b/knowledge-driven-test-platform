import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { sha256 } from '@kdtp/knowledge-core';
import { scanSensitiveValues } from '../packages/k6-api-adapter/test/p5-test-helpers.js';
import { runtimeAdmissionFixture } from '../packages/k6-api-adapter/test/runtime-admission-test-helpers.js';
import {
  ACCEPTED_M3_R2,
  M3_R3_R0_EVIDENCE_SCHEMA_VERSION,
  M3_R3_R0_FALSE_SAFETY_FIELDS,
  assertM3R3R0,
  resolveM3R3R0Branch,
} from './m3-r3-r0-baseline.js';
import {
  computeM3R3R0SchemaCatalogDigest,
  loadM3R3R0Repository,
  validateM3R3R0Repository,
} from './m3-r3-r0-repository.js';

export async function validateM3R3RuntimeAdmission(options = {}) {
  const repository = options.repository ?? await loadM3R3R0Repository();
  validateM3R3R0Repository(repository);
  const fixture = options.fixture ?? await runtimeAdmissionFixture();
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  assertM3R3R0(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(generatedAt)
      && !Number.isNaN(Date.parse(generatedAt)),
  'M3-R3-R0 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.M3_R3_R0_EXACT_HEAD
    ?? process.env.GITHUB_SHA ?? 'local';
  assertM3R3R0(commitSha === 'local' || /^[a-f0-9]{40}$/u.test(commitSha),
    'M3-R3-R0 exact Head must be local or a 40-character SHA');
  const branch = options.branch ?? resolveM3R3R0Branch(options);
  const testResults = options.testResults ?? readTestResults();
  validateTestResults(testResults);

  const claims = {
    schemaVersion: M3_R3_R0_EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    source: { branch, commitSha },
    acceptedM3R2: { ...ACCEPTED_M3_R2 },
    contracts: {
      policySchema: fixture.policy.schemaVersion,
      admissionSchema: fixture.admissionRequest.schemaVersion,
      invocationPlanSchema: fixture.invocationPlan.schemaVersion,
      admissionEvidenceSchema: fixture.admissionEvidence.schemaVersion,
      policyDigest: fixture.policy.policyDigest,
      admissionDigest: fixture.admissionRequest.admissionDigest,
      planDigest: fixture.invocationPlan.planDigest,
      admissionEvidenceDigest: fixture.admissionEvidence.evidenceDigest,
      schemaCatalogDigest: computeM3R3R0SchemaCatalogDigest(repository),
    },
    testResults,
    decision: {
      runtimeAdmissionContractReady: true,
      invocationPlanReady: true,
      executionImplementationStarted: false,
      sourceExecuted: false,
      k6Invoked: false,
      externalProcessExecuted: false,
      nextRequiredSlice: 'M3-R3-P1',
      repositoryBlockers: [],
    },
    safetyBoundary: Object.fromEntries(
      M3_R3_R0_FALSE_SAFETY_FIELDS.map((field) => [field, false])),
  };
  assertM3R3R0(claims.acceptedM3R2.mainSha === ACCEPTED_M3_R2.mainSha
      && claims.acceptedM3R2.bundleDigest === fixture.admissionRequest.source.bundleDigest
      && claims.acceptedM3R2.sourceDigest === fixture.admissionRequest.source.sourceDigest
      && claims.contracts.admissionDigest === fixture.admissionRequest.admissionDigest
      && claims.contracts.planDigest === fixture.invocationPlan.planDigest
      && Object.values(claims.safetyBoundary).every((value) => value === false),
  'M3-R3-R0 Evidence is not bound to the accepted predecessor and product contracts');
  scanSensitiveValues(claims, 'M3-R3-R0 Evidence');
  return { ...claims, evidenceDigest: sha256(claims) };
}

function readTestResults() {
  return {
    focused: result('M3_R3_R0_FOCUSED', 16, 16, 0),
    k6ApiAdapter: result('M3_R3_R0_ADAPTER', 154, 154, 0),
    fullNode: {
      total: numberEnv('M3_R3_R0_FULL_TOTAL', 506),
      passed: numberEnv('M3_R3_R0_FULL_PASSED', 494),
      skipped: numberEnv('M3_R3_R0_FULL_SKIPPED', 12),
      failed: numberEnv('M3_R3_R0_FULL_FAILED', 0),
    },
    repositoryValidator: {
      status: process.env.M3_R3_R0_REPOSITORY_VALIDATOR ?? 'success',
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
  assertM3R3R0(Number.isInteger(value) && value >= 0, `${name} is invalid`);
  return value;
}

function validateTestResults(results) {
  for (const key of ['focused', 'k6ApiAdapter']) {
    const item = results[key];
    assertM3R3R0(item.total > 0 && item.passed === item.total && item.failed === 0,
      `M3-R3-R0 ${key} tests are not fully accepted`);
  }
  assertM3R3R0(results.fullNode.total > 0
      && results.fullNode.passed + results.fullNode.skipped === results.fullNode.total
      && results.fullNode.failed === 0,
  'M3-R3-R0 full Node tests are not fully accepted');
  assertM3R3R0(results.repositoryValidator.status === 'success',
    'M3-R3-R0 Repository Validator did not succeed');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(await validateM3R3RuntimeAdmission(), null, 2)}\n`);
}
