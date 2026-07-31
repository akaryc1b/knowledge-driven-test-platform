import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createExecutionAdapterDescriptor,
  createExecutionRequest,
} from '@kdtp/execution-contract';
import {
  K6ApiCompilerError,
  canonicalStringifyK6ApiCompilation,
  compileK6ApiExecutionSpec,
} from '../src/index.js';
import {
  BODY_DIGEST,
  ENVIRONMENT_DIGEST,
  T5,
  adapterDescriptor,
  compilation,
  compilerInput,
  executionRequest,
  frozenPlanRecord,
} from './test-helpers.js';

function reorderObjectFields(value) {
  if (Array.isArray(value)) return value.map(reorderObjectFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).reverse()
    .map(([key, item]) => [key, reorderObjectFields(item)]));
}

function approvedRecordFrom(frozen) {
  const history = frozen.history.slice(0, -1);
  const terminal = history.at(-1);
  return {
    ...frozen,
    status: 'APPROVED',
    revision: terminal.revision,
    updatedAt: terminal.at,
    updatedBy: terminal.actor,
    history,
  };
}

function rebuildRequest(original, descriptor, overrides = {}) {
  const projectId = overrides.projectId ?? original.projectId;
  const environmentId = overrides.environmentId ?? original.environment.environmentId;
  const snapshot = overrides.knowledgeSnapshot ?? original.frozenTestPlan.knowledgeSnapshot;
  return createExecutionRequest({
    idempotencyKey: original.idempotencyKey,
    projectId,
    environment: {
      ...original.environment,
      environmentId,
      ...(overrides.environmentDigest ? { digest: overrides.environmentDigest } : {}),
    },
    frozenTestPlan: {
      ...original.frozenTestPlan,
      projectId,
      environmentId,
      knowledgeSnapshot: snapshot,
    },
    adapter: {
      adapterId: descriptor.adapterId,
      adapterType: descriptor.adapterType,
      version: descriptor.version,
      descriptorDigest: descriptor.descriptorDigest,
    },
    requestedCapabilities: overrides.requestedCapabilities ?? original.requestedCapabilities,
    inputArtifacts: original.inputArtifacts,
    limits: original.limits,
    createdAt: original.createdAt,
    createdBy: original.createdBy,
  }, descriptor);
}

test('compiler deterministically emits non-executable spec, bundle and evidence', async () => {
  const input = await compilerInput();
  const left = compileK6ApiExecutionSpec(input);
  const right = compileK6ApiExecutionSpec(structuredClone(input));
  assert.deepEqual(left, right);
  assert.equal(canonicalStringifyK6ApiCompilation(left),
    canonicalStringifyK6ApiCompilation(right));
  assert.match(left.spec.specId, /^k6spec-[a-f0-9]{20}$/);
  assert.match(left.spec.specDigest, /^[a-f0-9]{64}$/);
  assert.match(left.bundle.bundleId, /^k6bundle-[a-f0-9]{20}$/);
  assert.match(left.evidence.evidenceId, /^k6evidence-[a-f0-9]{20}$/);
  assert.equal(left.spec.requestGroups.length, 1);
  assert.equal(left.spec.requestGroups[0].operations.length, 2);
  assert.equal(left.bundle.artifactManifest.at(-1).uri,
    `artifact://sha256/${left.spec.specDigest}`);
  assert.equal(left.evidence.decision.apiAdapterCompilerReady, true);
  assert.equal(left.evidence.decision.executionRuntimeStarted, false);
  assert.equal(left.evidence.decision.k6Invoked, false);
  assert.equal(left.evidence.decision.externalProcessExecuted, false);
  assert(Object.values(left.evidence.safetyBoundary).every((value) => value === false));
  assert.equal(JSON.stringify(left).includes('export default'), false);
});

test('compiler ignores object field insertion order and normalizes arrays', async () => {
  const input = await compilerInput();
  const perturbed = reorderObjectFields(input);
  perturbed.descriptor.supportedCapabilities.reverse();
  perturbed.descriptor.acceptedIntentKinds.reverse();
  perturbed.descriptor.outputArtifactKinds.reverse();
  perturbed.executionRequest.requestedCapabilities.reverse();
  perturbed.frozenTestPlan.planningResult.plan.intents.reverse();
  const left = compileK6ApiExecutionSpec(input);
  const right = compileK6ApiExecutionSpec(perturbed);
  assert.deepEqual(left, right);
});

test('compilation time is metadata and does not change identities or digests', async () => {
  const input = await compilerInput();
  const later = { ...structuredClone(input), compiledAt: '2026-07-31T02:00:00.000Z' };
  const left = compileK6ApiExecutionSpec(input);
  const right = compileK6ApiExecutionSpec(later);
  assert.equal(left.spec.specId, right.spec.specId);
  assert.equal(left.spec.specDigest, right.spec.specDigest);
  assert.equal(left.bundle.bundleId, right.bundle.bundleId);
  assert.equal(left.bundle.bundleDigest, right.bundle.bundleDigest);
  assert.equal(left.evidence.evidenceId, right.evidence.evidenceId);
  assert.equal(left.evidence.evidenceDigest, right.evidence.evidenceDigest);
  assert.notEqual(left.evidence.metadata.compiledAt, right.evidence.metadata.compiledAt);
});

test('compiler rejects non-FROZEN Test Plan records', async () => {
  const frozen = await frozenPlanRecord();
  const descriptor = adapterDescriptor();
  const request = executionRequest(frozen, descriptor);
  const input = await compilerInput({
    descriptor,
    executionRequest: request,
    frozenTestPlan: approvedRecordFrom(frozen),
  });
  assert.throws(() => compileK6ApiExecutionSpec(input),
    (error) => error instanceof K6ApiCompilerError
      && error.code === 'K6_API_TEST_PLAN_NOT_FROZEN');
});

test('compiler rejects descriptor type and version mismatches', async () => {
  const record = await frozenPlanRecord();
  const wrongType = createExecutionAdapterDescriptor({
    adapterType: 'k6-performance',
    version: '1.0.0',
    implementationStatus: 'CONTRACT_ONLY',
    supportedCapabilities: [{ capabilityId: 'api-functional', version: '1.0.0' }],
    acceptedIntentKinds: ['api-functional'],
    outputArtifactKinds: ['k6-api-execution-spec'],
    cancellationMode: 'UNSUPPORTED',
  });
  const request = createExecutionRequest({
    idempotencyKey: '1'.repeat(64),
    projectId: record.projectId,
    environment: { environmentId: record.environmentId, version: '1.0.0', digest: ENVIRONMENT_DIGEST },
    frozenTestPlan: {
      planId: record.planId,
      projectId: record.projectId,
      environmentId: record.environmentId,
      revision: record.revision,
      status: 'FROZEN',
      digest: record.contentDigest,
      inputFingerprint: record.inputFingerprint,
      knowledgeSnapshot: record.knowledgeSnapshot,
    },
    adapter: {
      adapterId: wrongType.adapterId,
      adapterType: wrongType.adapterType,
      version: wrongType.version,
      descriptorDigest: wrongType.descriptorDigest,
    },
    requestedCapabilities: [{ capabilityId: 'api-functional', version: '1.0.0' }],
    inputArtifacts: [],
    limits: { maxDurationSeconds: 300, maxVirtualUsers: 10, maxArtifactBytes: 1000 },
    createdAt: T5,
    createdBy: 'compiler-client',
  }, wrongType);
  const input = await compilerInput({ descriptor: wrongType, executionRequest: request, frozenTestPlan: record });
  assert.throws(() => compileK6ApiExecutionSpec(input),
    (error) => error.code === 'K6_API_ADAPTER_REQUIRED');

  const valid = await compilerInput();
  valid.compilerVersion = '2.0.0';
  assert.throws(() => compileK6ApiExecutionSpec(valid),
    (error) => error.code === 'K6_API_COMPILER_VERSION_MISMATCH');
});

test('compiler rejects capability escalation and cross-context bindings', async () => {
  const input = await compilerInput();
  const narrowedDescriptor = createExecutionAdapterDescriptor({
    adapterType: 'k6-api',
    version: '1.0.0',
    implementationStatus: 'CONTRACT_ONLY',
    supportedCapabilities: [{ capabilityId: 'api-functional', version: '1.0.0' }],
    acceptedIntentKinds: ['api-functional', 'api-performance'],
    outputArtifactKinds: input.descriptor.outputArtifactKinds,
    cancellationMode: 'UNSUPPORTED',
  });
  assert.throws(() => rebuildRequest(input.executionRequest, narrowedDescriptor),
    (error) => error.code === 'EXECUTION_CAPABILITY_NOT_AUTHORIZED');

  const crossProjectRequest = rebuildRequest(input.executionRequest, input.descriptor, {
    projectId: 'other-project',
  });
  assert.throws(() => compileK6ApiExecutionSpec({
    ...input,
    executionRequest: crossProjectRequest,
  }), (error) => error.code === 'K6_API_PLAN_REQUEST_BINDING_MISMATCH');

  const crossSnapshotRequest = rebuildRequest(input.executionRequest, input.descriptor, {
    knowledgeSnapshot: {
      snapshotId: 'kb-other-project-abcdef123456',
      digest: '9'.repeat(64),
    },
  });
  assert.throws(() => compileK6ApiExecutionSpec({
    ...input,
    executionRequest: crossSnapshotRequest,
  }), (error) => error.code === 'K6_API_SNAPSHOT_BINDING_MISMATCH');
});

test('compiler preserves immutable request body Artifact binding', async () => {
  const output = await compilation();
  const operations = output.spec.requestGroups.flatMap((group) => group.operations);
  assert(operations.every((operation) => operation.requestBodyArtifact.digest === BODY_DIGEST));
  assert(operations.every((operation) =>
    operation.requestBodyArtifact.uri === `artifact://sha256/${BODY_DIGEST}`));
});
