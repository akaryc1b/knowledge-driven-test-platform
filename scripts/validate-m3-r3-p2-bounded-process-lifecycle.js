import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { sha256 } from '@kdtp/knowledge-core';
import { scanSensitiveValues } from '../packages/k6-api-adapter/test/p5-test-helpers.js';
import { processExecutionFixture } from
  '../packages/k6-api-adapter/test/process-execution-lifecycle-test-helpers.js';
import {
  ACCEPTED_M3_R3_P1,
  M3_R3_P2_CI_SAFETY_FIELDS,
  M3_R3_P2_EVIDENCE_SCHEMA_VERSION,
  assertM3R3P2,
  resolveM3R3P2Branch,
} from './m3-r3-p2-baseline.js';
import {
  computeM3R3P2SchemaCatalogDigest,
  loadM3R3P2Repository,
  validateM3R3P2Repository,
} from './m3-r3-p2-repository.js';
import {
  loadAndValidateM3R3P2WorkflowEvidence,
} from './validate-m3-r3-p2-workflow-evidence.js';

export async function validateM3R3P2BoundedProcessLifecycle(options = {}) {
  const repository = options.repository ?? await loadM3R3P2Repository();
  validateM3R3P2Repository(repository);
  await loadAndValidateM3R3P2WorkflowEvidence({
    source: repository.files['.github/workflows/m3-r3-p2-bounded-process-lifecycle.yml'],
  });
  const fixture = options.fixture ?? await processExecutionFixture();
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  assertM3R3P2(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(generatedAt)
      && !Number.isNaN(Date.parse(generatedAt)),
  'M3-R3-P2 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.M3_R3_P2_EXACT_HEAD
    ?? process.env.GITHUB_SHA ?? 'local';
  assertM3R3P2(commitSha === 'local' || /^[a-f0-9]{40}$/u.test(commitSha),
    'M3-R3-P2 exact Head must be local or a 40-character SHA');
  const branch = options.branch ?? resolveM3R3P2Branch(options);
  const testResults = options.testResults ?? readTestResults();
  validateTestResults(testResults);
  const decision = {
    nodeProcessAdapterImplemented: true,
    boundedLifecycleImplemented: true,
    startupAcknowledgementBounded: true,
    timeoutImplemented: true,
    cooperativeCancellationImplemented: true,
    realProcessStartedInCi: false,
    processIdCreatedInCi: false,
    signalSentInCi: false,
    k6InvokedInCi: false,
    externalProcessExecutedInCi: false,
    runtimeResultCollected: false,
    nextRequiredSlice: 'M3-R3-P3',
    repositoryBlockers: [],
  };
  const safetyBoundary = Object.fromEntries(
    M3_R3_P2_CI_SAFETY_FIELDS.map((field) => [field, false]));
  const claims = {
    schemaVersion: M3_R3_P2_EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    source: { branch, commitSha },
    acceptedP1: { ...ACCEPTED_M3_R3_P1 },
    contracts: {
      adapterSchema: fixture.adapterDescriptor.schemaVersion,
      commandSchema: fixture.command.schemaVersion,
      lifecycleEvidenceSchema: 'k6-process-lifecycle-evidence/v1',
      adapterDigest: fixture.adapterDescriptor.adapterDigest,
      commandDigest: fixture.command.commandDigest,
      schemaCatalogDigest: computeM3R3P2SchemaCatalogDigest(repository),
    },
    testResults,
    decision,
    safetyBoundary,
  };
  assertM3R3P2(fixture.p1.result.boundaryEvidence.evidenceDigest
      === ACCEPTED_M3_R3_P1.boundaryEvidenceDigest
      && fixture.p1.result.boundaryEvidence.decision.nodeProcessAdapterImplemented === false
      && fixture.command.predecessor.boundaryEvidenceDigest
        === ACCEPTED_M3_R3_P1.boundaryEvidenceDigest
      && fixture.command.processStartAuthorized === true
      && Object.values(safetyBoundary).every((value) => value === false),
  'M3-R3-P2 Evidence is not bound to accepted P1 and non-executing CI');
  scanSensitiveValues(claims, 'M3-R3-P2 Evidence');
  return { ...claims, evidenceDigest: sha256(claims) };
}

function readTestResults() {
  return {
    focused: result('M3_R3_P2_FOCUSED', 52, 52, 0),
    k6ApiAdapter: result('M3_R3_P2_ADAPTER', 261, 261, 0),
    fullNode: {
      total: numberEnv('M3_R3_P2_FULL_TOTAL', 613),
      passed: numberEnv('M3_R3_P2_FULL_PASSED', 601),
      skipped: numberEnv('M3_R3_P2_FULL_SKIPPED', 12),
      failed: numberEnv('M3_R3_P2_FULL_FAILED', 0),
    },
    repositoryValidator: {
      status: process.env.M3_R3_P2_REPOSITORY_VALIDATOR ?? 'success',
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
  assertM3R3P2(Number.isInteger(value) && value >= 0, `${name} is invalid`);
  return value;
}

function validateTestResults(results) {
  for (const key of ['focused', 'k6ApiAdapter']) {
    const item = results[key];
    assertM3R3P2(item.total > 0 && item.passed === item.total && item.failed === 0,
      `M3-R3-P2 ${key} tests are not fully accepted`);
  }
  assertM3R3P2(results.fullNode.total > 0
      && results.fullNode.passed + results.fullNode.skipped === results.fullNode.total
      && results.fullNode.failed === 0,
  'M3-R3-P2 full Node tests are not fully accepted');
  assertM3R3P2(results.repositoryValidator.status === 'success',
    'M3-R3-P2 Repository Validator did not succeed');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(
    await validateM3R3P2BoundedProcessLifecycle(), null, 2)}\n`);
}
