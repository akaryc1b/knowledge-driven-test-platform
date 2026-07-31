import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ExecutionContractError,
  assertExecutionStateTransition,
  createExecutionAdapterDescriptor,
  createExecutionEvidence,
  createExecutionFailure,
  createExecutionRequest,
  createExecutionResult,
  validateExecutionAdapterDescriptor,
  validateExecutionEvidence,
  validateExecutionRequest,
  validateExecutionResult,
} from '../src/index.js';

const D = (character) => character.repeat(64);
const T0 = '2026-07-30T10:00:00.000Z';
const T1 = '2026-07-30T10:00:01.000Z';
const T2 = '2026-07-30T10:00:02.000Z';
const T3 = '2026-07-30T10:00:03.000Z';

function descriptor() {
  return createExecutionAdapterDescriptor({
    adapterType: 'k6-api',
    version: '1.0.0',
    implementationStatus: 'CONTRACT_ONLY',
    supportedCapabilities: [
      { capabilityId: 'api.functional', version: '1.0.0' },
      { capabilityId: 'http.performance', version: '1.0.0' },
    ],
    acceptedIntentKinds: ['api-functional', 'api-performance'],
    outputArtifactKinds: ['execution-log', 'summary-json'],
    cancellationMode: 'COOPERATIVE',
  });
}

function request(adapter = descriptor()) {
  return createExecutionRequest({
    idempotencyKey: D('1'),
    projectId: 'approval-platform',
    environment: {
      environmentId: 'staging-us-east-1',
      version: '3.2.1',
      digest: D('2'),
    },
    frozenTestPlan: {
      planId: 'tp-approval-platform-abcdef123456',
      projectId: 'approval-platform',
      environmentId: 'staging-us-east-1',
      revision: 7,
      status: 'FROZEN',
      digest: D('3'),
      inputFingerprint: D('4'),
      knowledgeSnapshot: {
        snapshotId: 'kb-approval-platform-abcdef123456',
        digest: D('5'),
      },
    },
    adapter: {
      adapterId: adapter.adapterId,
      adapterType: adapter.adapterType,
      version: adapter.version,
      descriptorDigest: adapter.descriptorDigest,
    },
    requestedCapabilities: [
      { capabilityId: 'api.functional', version: '1.0.0' },
    ],
    inputArtifacts: [{
      artifactId: 'artifact-test-data-v1',
      kind: 'test-data',
      mediaType: 'application/json',
      digest: D('6'),
      uri: `artifact://sha256/${D('6')}`,
    }],
    limits: {
      maxDurationSeconds: 300,
      maxVirtualUsers: 50,
      maxArtifactBytes: 10_000_000,
    },
    createdAt: T0,
    createdBy: 'release-engineer',
  }, adapter);
}

function succeededResult(executionRequest, adapter = descriptor()) {
  return createExecutionResult({
    requestId: executionRequest.requestId,
    requestDigest: executionRequest.requestDigest,
    adapter: {
      adapterId: adapter.adapterId,
      adapterType: adapter.adapterType,
      version: adapter.version,
      descriptorDigest: adapter.descriptorDigest,
    },
    state: 'SUCCEEDED',
    startedAt: T1,
    completedAt: T3,
    stateHistory: [
      { state: 'PENDING', at: T0 },
      { state: 'VALIDATED', at: T1 },
      { state: 'RUNNING', at: T2 },
      { state: 'SUCCEEDED', at: T3 },
    ],
    outputArtifacts: [{
      artifactId: 'artifact-summary-v1',
      kind: 'summary-json',
      mediaType: 'application/json',
      digest: D('7'),
      uri: `artifact://sha256/${D('7')}`,
    }],
    measurements: [
      { name: 'checks.passed', unit: 'count', value: 12 },
      { name: 'checks.failed', unit: 'count', value: 0 },
    ],
    failure: null,
    cancellation: null,
  }, executionRequest, adapter);
}

test('adapter descriptor identity and digest are deterministic', () => {
  const left = descriptor();
  const right = descriptor();
  assert.deepEqual(left, right);
  assert.equal(validateExecutionAdapterDescriptor(left).descriptorDigest, left.descriptorDigest);
});

test('execution request binds a frozen plan, immutable environment and exact capabilities', () => {
  const adapter = descriptor();
  const executionRequest = request(adapter);
  const validated = validateExecutionRequest(executionRequest, adapter);
  assert.equal(validated.frozenTestPlan.status, 'FROZEN');
  assert.equal(validated.adapter.descriptorDigest, adapter.descriptorDigest);
  assert.match(validated.requestId, /^exec-approval-platform-[a-f0-9]{16}$/);
});

test('execution request rejects a non-frozen Test Plan', () => {
  const adapter = descriptor();
  const value = structuredClone(request(adapter));
  value.frozenTestPlan.status = 'APPROVED';
  assert.throws(() => validateExecutionRequest(value, adapter),
    (error) => error instanceof ExecutionContractError && error.code === 'EXECUTION_PLAN_NOT_FROZEN');
});

test('execution request rejects an unauthorized capability', () => {
  const adapter = descriptor();
  const value = structuredClone(request(adapter));
  value.requestedCapabilities = [{ capabilityId: 'browser.visual', version: '1.0.0' }];
  assert.throws(() => validateExecutionRequest(value, adapter),
    (error) => error.code === 'EXECUTION_CAPABILITY_NOT_AUTHORIZED');
});

test('execution request rejects mutable Artifact references', () => {
  const adapter = descriptor();
  const value = structuredClone(request(adapter));
  value.inputArtifacts[0].uri = 'artifact://latest/test-data';
  assert.throws(() => validateExecutionRequest(value, adapter),
    (error) => error.code === 'MUTABLE_ARTIFACT_REFERENCE');
});

test('execution request rejects placeholders and executable expressions', () => {
  const adapter = descriptor();
  const placeholder = structuredClone(request(adapter));
  placeholder.createdBy = 'replace-me';
  assert.throws(() => validateExecutionRequest(placeholder, adapter),
    (error) => error.code === 'EXECUTION_PLACEHOLDER_FORBIDDEN');
  const executable = structuredClone(request(adapter));
  executable.createdBy = 'node:child_process';
  assert.throws(() => validateExecutionRequest(executable, adapter),
    (error) => error.code === 'EXECUTABLE_MATERIAL_FORBIDDEN');
});

test('execution request rejects secret material', () => {
  const adapter = descriptor();
  const value = structuredClone(request(adapter));
  value.createdBy = 'Bearer abcdefghijklmnopqrstuvwxyz';
  assert.throws(() => validateExecutionRequest(value, adapter),
    (error) => error.code === 'SENSITIVE_EXECUTION_DATA');
});

test('execution state machine rejects invalid transitions', () => {
  assert.throws(() => assertExecutionStateTransition('PENDING', 'SUCCEEDED'),
    (error) => error.code === 'INVALID_EXECUTION_STATE_TRANSITION');
  assert.equal(assertExecutionStateTransition('RUNNING', 'SUCCEEDED'), 'SUCCEEDED');
});

test('execution result and evidence preserve immutable bindings', () => {
  const adapter = descriptor();
  const executionRequest = request(adapter);
  const result = succeededResult(executionRequest, adapter);
  const validatedResult = validateExecutionResult(result, executionRequest, adapter);
  const evidence = createExecutionEvidence({
    requestId: executionRequest.requestId,
    requestDigest: executionRequest.requestDigest,
    resultId: result.resultId,
    resultDigest: result.resultDigest,
    adapterDescriptorDigest: adapter.descriptorDigest,
    frozenTestPlanDigest: executionRequest.frozenTestPlan.digest,
    knowledgeSnapshotDigest: executionRequest.frozenTestPlan.knowledgeSnapshot.digest,
    environmentDigest: executionRequest.environment.digest,
    inputArtifactDigests: executionRequest.inputArtifacts.map(({ digest }) => digest),
    outputArtifactDigests: result.outputArtifacts.map(({ digest }) => digest),
    generatedAt: '2026-07-30T10:00:04.000Z',
    generatedBy: 'evidence-recorder',
  }, executionRequest, result, adapter);
  assert.equal(validatedResult.state, 'SUCCEEDED');
  assert.equal(validateExecutionEvidence(evidence, executionRequest, result, adapter).evidenceId,
    evidence.evidenceId);
});

test('failed and cancelled result semantics are explicit', () => {
  const adapter = descriptor();
  const executionRequest = request(adapter);
  const failure = createExecutionFailure({
    category: 'EXECUTION',
    code: 'ADAPTER_FAILED',
    retryable: false,
    message: 'Adapter returned a governed failure',
    occurredAt: T3,
    details: { phase: 'run' },
  });
  const failed = createExecutionResult({
    requestId: executionRequest.requestId,
    requestDigest: executionRequest.requestDigest,
    adapter: {
      adapterId: adapter.adapterId,
      adapterType: adapter.adapterType,
      version: adapter.version,
      descriptorDigest: adapter.descriptorDigest,
    },
    state: 'FAILED',
    startedAt: T1,
    completedAt: T3,
    stateHistory: [
      { state: 'PENDING', at: T0 },
      { state: 'VALIDATED', at: T1 },
      { state: 'RUNNING', at: T2 },
      { state: 'FAILED', at: T3 },
    ],
    outputArtifacts: [],
    measurements: [],
    failure,
    cancellation: null,
  }, executionRequest, adapter);
  assert.equal(failed.failure.failureDigest, failure.failureDigest);

  const cancelled = createExecutionResult({
    requestId: executionRequest.requestId,
    requestDigest: executionRequest.requestDigest,
    adapter: {
      adapterId: adapter.adapterId,
      adapterType: adapter.adapterType,
      version: adapter.version,
      descriptorDigest: adapter.descriptorDigest,
    },
    state: 'CANCELLED',
    startedAt: T1,
    completedAt: T3,
    stateHistory: [
      { state: 'PENDING', at: T0 },
      { state: 'VALIDATED', at: T1 },
      { state: 'RUNNING', at: T2 },
      { state: 'CANCELLATION_REQUESTED', at: T2, reason: 'operator-request' },
      { state: 'CANCELLED', at: T3 },
    ],
    outputArtifacts: [],
    measurements: [],
    failure: null,
    cancellation: {
      requestedAt: T2,
      effectiveAt: T3,
      requestedBy: 'release-engineer',
      reason: 'operator-request',
    },
  }, executionRequest, adapter);
  assert.equal(cancelled.state, 'CANCELLED');
});
