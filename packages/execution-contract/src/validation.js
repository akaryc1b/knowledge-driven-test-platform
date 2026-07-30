import { sha256 } from '@kdtp/knowledge-core';
import {
  EXECUTION_ADAPTER_DESCRIPTOR_SCHEMA_VERSION,
  EXECUTION_ADAPTER_TYPES,
  EXECUTION_CANCELLATION_MODES,
  EXECUTION_EVIDENCE_SCHEMA_VERSION,
  EXECUTION_FAILURE_CATEGORIES,
  EXECUTION_FAILURE_SCHEMA_VERSION,
  EXECUTION_IMPLEMENTATION_STATUSES,
  EXECUTION_REQUEST_SCHEMA_VERSION,
  EXECUTION_RESULT_SCHEMA_VERSION,
  EXECUTION_RESULT_STATES,
} from './constants.js';
import { executionInvariant } from './errors.js';
import {
  deriveAdapterId,
  deriveExecutionEvidenceId,
  deriveExecutionRequestId,
  deriveExecutionResultId,
  validateAdapterId,
  validateDigest,
  validateExecutionEvidenceId,
  validateExecutionRequestId,
  validateExecutionResultId,
  validateFailureCode,
  validateIdentifier,
  validateKind,
  validateMediaType,
  validateNonEmptyString,
  validateProjectId,
  validateSemver,
  validateUtcTimestamp,
} from './identity.js';
import {
  assertNoExecutableMaterial,
  assertNoPlaceholderData,
  assertNoSensitiveExecutionData,
  cloneExecutionJson,
  validateImmutableArtifactUri,
} from './json.js';
import { validateExecutionStateHistory } from './state-machine.js';

export function createExecutionAdapterDescriptor(command) {
  return normalizeDescriptor({
    ...command,
    schemaVersion: EXECUTION_ADAPTER_DESCRIPTOR_SCHEMA_VERSION,
    adapterId: null,
    descriptorDigest: null,
  }, false);
}

export function validateExecutionAdapterDescriptor(input) {
  return normalizeDescriptor(input, true);
}

function normalizeDescriptor(input, requireIdentity) {
  assertObject(input, 'INVALID_EXECUTION_ADAPTER_DESCRIPTOR', 'Execution adapter descriptor');
  exactFields(input, [
    'schemaVersion', 'adapterId', 'adapterType', 'version', 'implementationStatus',
    'supportedCapabilities', 'acceptedIntentKinds', 'outputArtifactKinds',
    'cancellationMode', 'descriptorDigest',
  ], 'INVALID_EXECUTION_ADAPTER_DESCRIPTOR', 'Execution adapter descriptor');
  executionInvariant(input.schemaVersion === EXECUTION_ADAPTER_DESCRIPTOR_SCHEMA_VERSION,
    'INVALID_EXECUTION_ADAPTER_SCHEMA', 'Execution adapter descriptor schema is unsupported');
  executionInvariant(EXECUTION_ADAPTER_TYPES.includes(input.adapterType),
    'INVALID_EXECUTION_ADAPTER_TYPE', 'Execution adapter type is unsupported', {
      adapterType: input.adapterType,
    });
  const version = validateSemver(input.version, 'adapter.version');
  executionInvariant(EXECUTION_IMPLEMENTATION_STATUSES.includes(input.implementationStatus),
    'INVALID_EXECUTION_IMPLEMENTATION_STATUS', 'M3-R0 adapters must remain CONTRACT_ONLY');
  const supportedCapabilities = normalizeCapabilityRefs(input.supportedCapabilities,
    'supportedCapabilities');
  const acceptedIntentKinds = normalizeKindArray(input.acceptedIntentKinds,
    'acceptedIntentKinds');
  const outputArtifactKinds = normalizeKindArray(input.outputArtifactKinds,
    'outputArtifactKinds');
  executionInvariant(EXECUTION_CANCELLATION_MODES.includes(input.cancellationMode),
    'INVALID_EXECUTION_CANCELLATION_MODE', 'Execution cancellation mode is unsupported');
  const identityPayload = {
    schemaVersion: input.schemaVersion,
    adapterType: input.adapterType,
    version,
    implementationStatus: input.implementationStatus,
    supportedCapabilities,
    acceptedIntentKinds,
    outputArtifactKinds,
    cancellationMode: input.cancellationMode,
  };
  const expectedId = deriveAdapterId(identityPayload);
  const descriptor = { ...identityPayload, adapterId: expectedId };
  assertContractSafe(descriptor, '$.adapterDescriptor');
  const expectedDigest = sha256(descriptor);
  if (requireIdentity) {
    validateAdapterId(input.adapterId);
    validateDigest(input.descriptorDigest, 'descriptorDigest');
    executionInvariant(input.adapterId === expectedId,
      'EXECUTION_ADAPTER_ID_MISMATCH', 'Adapter ID does not match canonical descriptor');
    executionInvariant(input.descriptorDigest === expectedDigest,
      'EXECUTION_ADAPTER_DIGEST_MISMATCH', 'Adapter digest does not match canonical descriptor');
  }
  const normalized = {
    schemaVersion: descriptor.schemaVersion,
    adapterId: requireIdentity ? input.adapterId : expectedId,
    adapterType: descriptor.adapterType,
    version: descriptor.version,
    implementationStatus: descriptor.implementationStatus,
    supportedCapabilities: descriptor.supportedCapabilities,
    acceptedIntentKinds: descriptor.acceptedIntentKinds,
    outputArtifactKinds: descriptor.outputArtifactKinds,
    cancellationMode: descriptor.cancellationMode,
    descriptorDigest: requireIdentity ? input.descriptorDigest : expectedDigest,
  };
  assertContractSafe(normalized, '$.adapterDescriptor');
  return normalized;
}

export function createExecutionRequest(command, descriptorInput) {
  return normalizeRequest({
    ...command,
    schemaVersion: EXECUTION_REQUEST_SCHEMA_VERSION,
    requestId: null,
    requestDigest: null,
  }, descriptorInput, false);
}

export function validateExecutionRequest(input, descriptorInput) {
  return normalizeRequest(input, descriptorInput, true);
}

function normalizeRequest(input, descriptorInput, requireIdentity) {
  const descriptor = validateExecutionAdapterDescriptor(descriptorInput);
  assertObject(input, 'INVALID_EXECUTION_REQUEST', 'Execution request');
  exactFields(input, [
    'schemaVersion', 'requestId', 'idempotencyKey', 'projectId', 'environment',
    'frozenTestPlan', 'adapter', 'requestedCapabilities', 'inputArtifacts', 'limits',
    'createdAt', 'createdBy', 'requestDigest',
  ], 'INVALID_EXECUTION_REQUEST', 'Execution request');
  executionInvariant(input.schemaVersion === EXECUTION_REQUEST_SCHEMA_VERSION,
    'INVALID_EXECUTION_REQUEST_SCHEMA', 'Execution request schema is unsupported');
  const projectId = validateProjectId(input.projectId);
  const idempotencyKey = validateDigest(input.idempotencyKey, 'idempotencyKey');
  const environment = normalizeEnvironment(input.environment);
  const frozenTestPlan = normalizeFrozenTestPlan(input.frozenTestPlan, projectId,
    environment.environmentId);
  const adapter = normalizeAdapterBinding(input.adapter, descriptor);
  const requestedCapabilities = normalizeCapabilityRefs(input.requestedCapabilities,
    'requestedCapabilities');
  assertCapabilitiesAuthorized(requestedCapabilities, descriptor.supportedCapabilities);
  const inputArtifacts = normalizeArtifacts(input.inputArtifacts ?? [], 'inputArtifacts');
  const limits = normalizeLimits(input.limits);
  const createdAt = validateUtcTimestamp(input.createdAt, 'createdAt');
  const createdBy = validateNonEmptyString(input.createdBy, 'createdBy', 256);
  const identityPayload = {
    idempotencyKey,
    projectId,
    environment,
    frozenTestPlan,
    adapter,
    requestedCapabilities,
    inputArtifacts,
    limits,
  };
  const expectedId = deriveExecutionRequestId(projectId, identityPayload);
  const request = {
    schemaVersion: input.schemaVersion,
    requestId: expectedId,
    idempotencyKey,
    projectId,
    environment,
    frozenTestPlan,
    adapter,
    requestedCapabilities,
    inputArtifacts,
    limits,
    createdAt,
    createdBy,
  };
  assertContractSafe(request, '$.executionRequest');
  const expectedDigest = sha256(request);
  if (requireIdentity) {
    validateExecutionRequestId(input.requestId);
    validateDigest(input.requestDigest, 'requestDigest');
    executionInvariant(input.requestId === expectedId,
      'EXECUTION_REQUEST_ID_MISMATCH', 'Execution request ID does not match canonical inputs');
    executionInvariant(input.requestDigest === expectedDigest,
      'EXECUTION_REQUEST_DIGEST_MISMATCH',
      'Execution request digest does not match canonical envelope');
  }
  const normalized = {
    ...request,
    requestId: requireIdentity ? input.requestId : expectedId,
    requestDigest: requireIdentity ? input.requestDigest : expectedDigest,
  };
  assertContractSafe(normalized, '$.executionRequest');
  return normalized;
}

export function createExecutionFailure(command) {
  return normalizeFailure({
    ...command,
    schemaVersion: EXECUTION_FAILURE_SCHEMA_VERSION,
    failureDigest: null,
  }, false);
}

export function validateExecutionFailure(input) {
  return normalizeFailure(input, true);
}

function normalizeFailure(input, requireDigest) {
  assertObject(input, 'INVALID_EXECUTION_FAILURE', 'Execution failure');
  exactFields(input, [
    'schemaVersion', 'category', 'code', 'retryable', 'message', 'occurredAt',
    'details', 'failureDigest',
  ], 'INVALID_EXECUTION_FAILURE', 'Execution failure');
  executionInvariant(input.schemaVersion === EXECUTION_FAILURE_SCHEMA_VERSION,
    'INVALID_EXECUTION_FAILURE_SCHEMA', 'Execution failure schema is unsupported');
  executionInvariant(EXECUTION_FAILURE_CATEGORIES.includes(input.category),
    'INVALID_EXECUTION_FAILURE_CATEGORY', 'Execution failure category is unsupported');
  executionInvariant(typeof input.retryable === 'boolean',
    'INVALID_EXECUTION_FAILURE', 'Execution failure retryable must be boolean');
  const failure = {
    schemaVersion: input.schemaVersion,
    category: input.category,
    code: validateFailureCode(input.code),
    retryable: input.retryable,
    message: validateNonEmptyString(input.message, 'failure.message', 512),
    occurredAt: validateUtcTimestamp(input.occurredAt, 'failure.occurredAt'),
    details: cloneExecutionJson(input.details ?? {}, '$.failure.details'),
  };
  assertContractSafe(failure, '$.executionFailure');
  const expectedDigest = sha256(failure);
  if (requireDigest) {
    validateDigest(input.failureDigest, 'failureDigest');
    executionInvariant(input.failureDigest === expectedDigest,
      'EXECUTION_FAILURE_DIGEST_MISMATCH', 'Execution failure digest is invalid');
  }
  const normalized = {
    ...failure,
    failureDigest: requireDigest ? input.failureDigest : expectedDigest,
  };
  assertContractSafe(normalized, '$.executionFailure');
  return normalized;
}

export function createExecutionResult(command, requestInput, descriptorInput) {
  return normalizeResult({
    ...command,
    schemaVersion: EXECUTION_RESULT_SCHEMA_VERSION,
    resultId: null,
    resultDigest: null,
  }, requestInput, descriptorInput, false);
}

export function validateExecutionResult(input, requestInput, descriptorInput) {
  return normalizeResult(input, requestInput, descriptorInput, true);
}

function normalizeResult(input, requestInput, descriptorInput, requireIdentity) {
  const descriptor = validateExecutionAdapterDescriptor(descriptorInput);
  const request = validateExecutionRequest(requestInput, descriptor);
  assertObject(input, 'INVALID_EXECUTION_RESULT', 'Execution result');
  exactFields(input, [
    'schemaVersion', 'resultId', 'requestId', 'requestDigest', 'adapter', 'state',
    'startedAt', 'completedAt', 'stateHistory', 'outputArtifacts', 'measurements',
    'failure', 'cancellation', 'resultDigest',
  ], 'INVALID_EXECUTION_RESULT', 'Execution result');
  executionInvariant(input.schemaVersion === EXECUTION_RESULT_SCHEMA_VERSION,
    'INVALID_EXECUTION_RESULT_SCHEMA', 'Execution result schema is unsupported');
  executionInvariant(input.requestId === request.requestId
      && input.requestDigest === request.requestDigest,
  'EXECUTION_RESULT_REQUEST_MISMATCH', 'Execution result request binding is invalid');
  const adapter = normalizeAdapterBinding(input.adapter, descriptor);
  executionInvariant(EXECUTION_RESULT_STATES.includes(input.state),
    'INVALID_EXECUTION_RESULT_STATE', 'Execution result must be terminal');
  const startedAt = validateUtcTimestamp(input.startedAt, 'result.startedAt');
  const completedAt = validateUtcTimestamp(input.completedAt, 'result.completedAt');
  executionInvariant(Date.parse(completedAt) >= Date.parse(startedAt),
    'INVALID_EXECUTION_RESULT_TIME', 'Execution result completedAt precedes startedAt');
  const stateHistory = validateExecutionStateHistory(input.stateHistory, input.state);
  executionInvariant(Date.parse(stateHistory[0].at) <= Date.parse(startedAt)
      && Date.parse(stateHistory.at(-1).at) === Date.parse(completedAt),
  'INVALID_EXECUTION_RESULT_TIME', 'Execution state history is not bound to result timestamps');
  const outputArtifacts = normalizeArtifacts(input.outputArtifacts ?? [], 'outputArtifacts');
  const measurements = normalizeMeasurements(input.measurements ?? []);
  const failure = input.failure === null ? null : validateExecutionFailure(input.failure);
  const cancellation = input.cancellation === null ? null : normalizeCancellation(input.cancellation);
  enforceTerminalSemantics(input.state, failure, cancellation, descriptor.cancellationMode);
  const identityPayload = {
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    adapter,
    state: input.state,
    completedAt,
    outputArtifactDigests: outputArtifacts.map(({ digest }) => digest),
    failureDigest: failure?.failureDigest ?? null,
    cancellationEffectiveAt: cancellation?.effectiveAt ?? null,
  };
  const expectedId = deriveExecutionResultId(identityPayload);
  const result = {
    schemaVersion: input.schemaVersion,
    resultId: expectedId,
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    adapter,
    state: input.state,
    startedAt,
    completedAt,
    stateHistory,
    outputArtifacts,
    measurements,
    failure,
    cancellation,
  };
  assertContractSafe(result, '$.executionResult');
  const expectedDigest = sha256(result);
  if (requireIdentity) {
    validateExecutionResultId(input.resultId);
    validateDigest(input.resultDigest, 'resultDigest');
    executionInvariant(input.resultId === expectedId,
      'EXECUTION_RESULT_ID_MISMATCH', 'Execution result ID is invalid');
    executionInvariant(input.resultDigest === expectedDigest,
      'EXECUTION_RESULT_DIGEST_MISMATCH', 'Execution result digest is invalid');
  }
  const normalized = {
    ...result,
    resultId: requireIdentity ? input.resultId : expectedId,
    resultDigest: requireIdentity ? input.resultDigest : expectedDigest,
  };
  assertContractSafe(normalized, '$.executionResult');
  return normalized;
}

export function createExecutionEvidence(command, requestInput, resultInput, descriptorInput) {
  return normalizeEvidence({
    ...command,
    schemaVersion: EXECUTION_EVIDENCE_SCHEMA_VERSION,
    evidenceId: null,
    evidenceDigest: null,
  }, requestInput, resultInput, descriptorInput, false);
}

export function validateExecutionEvidence(input, requestInput, resultInput, descriptorInput) {
  return normalizeEvidence(input, requestInput, resultInput, descriptorInput, true);
}

function normalizeEvidence(input, requestInput, resultInput, descriptorInput, requireIdentity) {
  const descriptor = validateExecutionAdapterDescriptor(descriptorInput);
  const request = validateExecutionRequest(requestInput, descriptor);
  const result = validateExecutionResult(resultInput, request, descriptor);
  assertObject(input, 'INVALID_EXECUTION_EVIDENCE', 'Execution evidence');
  exactFields(input, [
    'schemaVersion', 'evidenceId', 'requestId', 'requestDigest', 'resultId',
    'resultDigest', 'adapterDescriptorDigest', 'frozenTestPlanDigest',
    'knowledgeSnapshotDigest', 'environmentDigest', 'inputArtifactDigests',
    'outputArtifactDigests', 'generatedAt', 'generatedBy', 'evidenceDigest',
  ], 'INVALID_EXECUTION_EVIDENCE', 'Execution evidence');
  executionInvariant(input.schemaVersion === EXECUTION_EVIDENCE_SCHEMA_VERSION,
    'INVALID_EXECUTION_EVIDENCE_SCHEMA', 'Execution evidence schema is unsupported');
  const evidence = {
    schemaVersion: input.schemaVersion,
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    resultId: result.resultId,
    resultDigest: result.resultDigest,
    adapterDescriptorDigest: descriptor.descriptorDigest,
    frozenTestPlanDigest: request.frozenTestPlan.digest,
    knowledgeSnapshotDigest: request.frozenTestPlan.knowledgeSnapshot.digest,
    environmentDigest: request.environment.digest,
    inputArtifactDigests: request.inputArtifacts.map(({ digest }) => digest).sort(),
    outputArtifactDigests: result.outputArtifacts.map(({ digest }) => digest).sort(),
    generatedAt: validateUtcTimestamp(input.generatedAt, 'evidence.generatedAt'),
    generatedBy: validateNonEmptyString(input.generatedBy, 'evidence.generatedBy', 256),
  };
  executionInvariant(input.requestId === evidence.requestId
      && input.requestDigest === evidence.requestDigest
      && input.resultId === evidence.resultId
      && input.resultDigest === evidence.resultDigest,
  'EXECUTION_EVIDENCE_BINDING_MISMATCH', 'Execution evidence request/result binding is invalid');
  executionInvariant(input.adapterDescriptorDigest === evidence.adapterDescriptorDigest
      && input.frozenTestPlanDigest === evidence.frozenTestPlanDigest
      && input.knowledgeSnapshotDigest === evidence.knowledgeSnapshotDigest
      && input.environmentDigest === evidence.environmentDigest,
  'EXECUTION_EVIDENCE_BINDING_MISMATCH', 'Execution evidence immutable binding is invalid');
  same(input.inputArtifactDigests, evidence.inputArtifactDigests,
    'EXECUTION_EVIDENCE_BINDING_MISMATCH', 'Input Artifact digests changed');
  same(input.outputArtifactDigests, evidence.outputArtifactDigests,
    'EXECUTION_EVIDENCE_BINDING_MISMATCH', 'Output Artifact digests changed');
  const identityPayload = {
    requestDigest: evidence.requestDigest,
    resultDigest: evidence.resultDigest,
    adapterDescriptorDigest: evidence.adapterDescriptorDigest,
    frozenTestPlanDigest: evidence.frozenTestPlanDigest,
    environmentDigest: evidence.environmentDigest,
  };
  const expectedId = deriveExecutionEvidenceId(identityPayload);
  const withId = { ...evidence, evidenceId: expectedId };
  assertContractSafe(withId, '$.executionEvidence');
  const expectedDigest = sha256(withId);
  if (requireIdentity) {
    validateExecutionEvidenceId(input.evidenceId);
    validateDigest(input.evidenceDigest, 'evidenceDigest');
    executionInvariant(input.evidenceId === expectedId,
      'EXECUTION_EVIDENCE_ID_MISMATCH', 'Execution evidence ID is invalid');
    executionInvariant(input.evidenceDigest === expectedDigest,
      'EXECUTION_EVIDENCE_DIGEST_MISMATCH', 'Execution evidence digest is invalid');
  }
  const normalized = {
    schemaVersion: evidence.schemaVersion,
    evidenceId: requireIdentity ? input.evidenceId : expectedId,
    requestId: evidence.requestId,
    requestDigest: evidence.requestDigest,
    resultId: evidence.resultId,
    resultDigest: evidence.resultDigest,
    adapterDescriptorDigest: evidence.adapterDescriptorDigest,
    frozenTestPlanDigest: evidence.frozenTestPlanDigest,
    knowledgeSnapshotDigest: evidence.knowledgeSnapshotDigest,
    environmentDigest: evidence.environmentDigest,
    inputArtifactDigests: evidence.inputArtifactDigests,
    outputArtifactDigests: evidence.outputArtifactDigests,
    generatedAt: evidence.generatedAt,
    generatedBy: evidence.generatedBy,
    evidenceDigest: requireIdentity ? input.evidenceDigest : expectedDigest,
  };
  assertContractSafe(normalized, '$.executionEvidence');
  return normalized;
}

function normalizeEnvironment(input) {
  assertObject(input, 'INVALID_EXECUTION_ENVIRONMENT', 'Execution environment reference');
  exactFields(input, ['environmentId', 'version', 'digest'],
    'INVALID_EXECUTION_ENVIRONMENT', 'Execution environment reference');
  return {
    environmentId: validateIdentifier(input.environmentId, 'environment.environmentId'),
    version: validateSemver(input.version, 'environment.version'),
    digest: validateDigest(input.digest, 'environment.digest'),
  };
}

function normalizeFrozenTestPlan(input, projectId, environmentId) {
  assertObject(input, 'INVALID_FROZEN_TEST_PLAN', 'Frozen Test Plan binding');
  exactFields(input, [
    'planId', 'projectId', 'environmentId', 'revision', 'status', 'digest',
    'inputFingerprint', 'knowledgeSnapshot',
  ], 'INVALID_FROZEN_TEST_PLAN', 'Frozen Test Plan binding');
  executionInvariant(input.projectId === projectId && input.environmentId === environmentId,
    'EXECUTION_PLAN_CONTEXT_MISMATCH', 'Frozen Test Plan context does not match request');
  executionInvariant(input.status === 'FROZEN',
    'EXECUTION_PLAN_NOT_FROZEN', 'Execution requests may only bind FROZEN Test Plans');
  executionInvariant(Number.isSafeInteger(input.revision) && input.revision >= 1,
    'INVALID_FROZEN_TEST_PLAN', 'Frozen Test Plan revision must be a positive integer');
  assertObject(input.knowledgeSnapshot, 'INVALID_EXECUTION_SNAPSHOT',
    'Knowledge Snapshot binding');
  exactFields(input.knowledgeSnapshot, ['snapshotId', 'digest'],
    'INVALID_EXECUTION_SNAPSHOT', 'Knowledge Snapshot binding');
  return {
    planId: validateIdentifier(input.planId, 'frozenTestPlan.planId'),
    projectId,
    environmentId,
    revision: input.revision,
    status: 'FROZEN',
    digest: validateDigest(input.digest, 'frozenTestPlan.digest'),
    inputFingerprint: validateDigest(input.inputFingerprint, 'frozenTestPlan.inputFingerprint'),
    knowledgeSnapshot: {
      snapshotId: validateIdentifier(input.knowledgeSnapshot.snapshotId,
        'frozenTestPlan.knowledgeSnapshot.snapshotId'),
      digest: validateDigest(input.knowledgeSnapshot.digest,
        'frozenTestPlan.knowledgeSnapshot.digest'),
    },
  };
}

function normalizeAdapterBinding(input, descriptor) {
  assertObject(input, 'INVALID_EXECUTION_ADAPTER_BINDING', 'Execution adapter binding');
  exactFields(input, ['adapterId', 'adapterType', 'version', 'descriptorDigest'],
    'INVALID_EXECUTION_ADAPTER_BINDING', 'Execution adapter binding');
  const expected = {
    adapterId: descriptor.adapterId,
    adapterType: descriptor.adapterType,
    version: descriptor.version,
    descriptorDigest: descriptor.descriptorDigest,
  };
  same(input, expected, 'EXECUTION_ADAPTER_BINDING_MISMATCH',
    'Execution adapter binding does not match descriptor');
  return expected;
}

function normalizeCapabilityRefs(input, field) {
  executionInvariant(Array.isArray(input) && input.length > 0 && input.length <= 100,
    'INVALID_EXECUTION_CAPABILITIES', `${field} must contain between 1 and 100 capabilities`);
  const normalized = input.map((item, index) => {
    assertObject(item, 'INVALID_EXECUTION_CAPABILITY', `${field}[${index}]`);
    exactFields(item, ['capabilityId', 'version'],
      'INVALID_EXECUTION_CAPABILITY', `${field}[${index}]`);
    return {
      capabilityId: validateIdentifier(item.capabilityId, `${field}[${index}].capabilityId`),
      version: validateSemver(item.version, `${field}[${index}].version`),
    };
  }).sort(compareCapability);
  assertUnique(normalized.map(capabilityKey),
    'DUPLICATE_EXECUTION_CAPABILITY', `${field} contains duplicates`);
  return normalized;
}

function normalizeKindArray(input, field) {
  executionInvariant(Array.isArray(input) && input.length > 0 && input.length <= 100,
    'INVALID_EXECUTION_KIND_LIST', `${field} must contain between 1 and 100 values`);
  const normalized = input.map((value, index) =>
    validateKind(value, `${field}[${index}]`)).sort();
  assertUnique(normalized, 'DUPLICATE_EXECUTION_KIND', `${field} contains duplicates`);
  return normalized;
}

function normalizeArtifacts(input, field) {
  executionInvariant(Array.isArray(input) && input.length <= 1000,
    'INVALID_EXECUTION_ARTIFACTS', `${field} must contain at most 1000 Artifacts`);
  const artifacts = input.map((artifact, index) => {
    assertObject(artifact, 'INVALID_EXECUTION_ARTIFACT', `${field}[${index}]`);
    exactFields(artifact, ['artifactId', 'kind', 'mediaType', 'digest', 'uri'],
      'INVALID_EXECUTION_ARTIFACT', `${field}[${index}]`);
    const digest = validateDigest(artifact.digest, `${field}[${index}].digest`);
    return {
      artifactId: validateIdentifier(artifact.artifactId, `${field}[${index}].artifactId`),
      kind: validateKind(artifact.kind, `${field}[${index}].kind`),
      mediaType: validateMediaType(artifact.mediaType),
      digest,
      uri: validateImmutableArtifactUri(artifact.uri, digest),
    };
  }).sort((left, right) => left.artifactId.localeCompare(right.artifactId));
  assertUnique(artifacts.map(({ artifactId }) => artifactId),
    'DUPLICATE_EXECUTION_ARTIFACT', `${field} contains duplicate Artifact IDs`);
  return artifacts;
}

function normalizeLimits(input) {
  assertObject(input, 'INVALID_EXECUTION_LIMITS', 'Execution limits');
  exactFields(input, ['maxDurationSeconds', 'maxVirtualUsers', 'maxArtifactBytes'],
    'INVALID_EXECUTION_LIMITS', 'Execution limits');
  const integer = (value, field, max) => {
    executionInvariant(Number.isSafeInteger(value) && value >= 1 && value <= max,
      'INVALID_EXECUTION_LIMITS', `${field} is outside the contract limit`, { value });
    return value;
  };
  return {
    maxDurationSeconds: integer(input.maxDurationSeconds, 'maxDurationSeconds', 86_400),
    maxVirtualUsers: integer(input.maxVirtualUsers, 'maxVirtualUsers', 1_000_000),
    maxArtifactBytes: integer(input.maxArtifactBytes, 'maxArtifactBytes', 10_000_000_000),
  };
}

function normalizeMeasurements(input) {
  executionInvariant(Array.isArray(input) && input.length <= 10_000,
    'INVALID_EXECUTION_MEASUREMENTS', 'Execution measurements exceed the contract limit');
  const measurements = input.map((item, index) => {
    assertObject(item, 'INVALID_EXECUTION_MEASUREMENT', `measurements[${index}]`);
    exactFields(item, ['name', 'unit', 'value'],
      'INVALID_EXECUTION_MEASUREMENT', `measurements[${index}]`);
    executionInvariant(typeof item.value === 'number' && Number.isFinite(item.value),
      'INVALID_EXECUTION_MEASUREMENT', 'Execution measurement value must be finite');
    return {
      name: validateIdentifier(item.name, `measurements[${index}].name`),
      unit: validateNonEmptyString(item.unit, `measurements[${index}].unit`, 32),
      value: item.value,
    };
  }).sort((left, right) => left.name.localeCompare(right.name));
  assertUnique(measurements.map(({ name }) => name),
    'DUPLICATE_EXECUTION_MEASUREMENT', 'Execution measurement names must be unique');
  return measurements;
}

function normalizeCancellation(input) {
  assertObject(input, 'INVALID_EXECUTION_CANCELLATION', 'Execution cancellation');
  exactFields(input, ['requestedAt', 'effectiveAt', 'requestedBy', 'reason'],
    'INVALID_EXECUTION_CANCELLATION', 'Execution cancellation');
  const requestedAt = validateUtcTimestamp(input.requestedAt, 'cancellation.requestedAt');
  const effectiveAt = validateUtcTimestamp(input.effectiveAt, 'cancellation.effectiveAt');
  executionInvariant(Date.parse(effectiveAt) >= Date.parse(requestedAt),
    'INVALID_EXECUTION_CANCELLATION', 'Cancellation effectiveAt precedes requestedAt');
  return {
    requestedAt,
    effectiveAt,
    requestedBy: validateNonEmptyString(input.requestedBy, 'cancellation.requestedBy', 256),
    reason: validateNonEmptyString(input.reason, 'cancellation.reason', 512),
  };
}

function enforceTerminalSemantics(state, failure, cancellation, cancellationMode) {
  if (state === 'SUCCEEDED') {
    executionInvariant(failure === null && cancellation === null,
      'INVALID_EXECUTION_RESULT_SEMANTICS',
      'SUCCEEDED results cannot contain failure or cancellation');
  } else if (state === 'FAILED' || state === 'TIMED_OUT') {
    executionInvariant(failure !== null && cancellation === null,
      'INVALID_EXECUTION_RESULT_SEMANTICS', `${state} results require failure and no cancellation`);
    if (state === 'TIMED_OUT') {
      executionInvariant(failure.category === 'TIMEOUT',
        'INVALID_EXECUTION_RESULT_SEMANTICS', 'TIMED_OUT results require a TIMEOUT failure');
    }
  } else if (state === 'CANCELLED') {
    executionInvariant(cancellationMode === 'COOPERATIVE'
        && cancellation !== null && failure === null,
    'INVALID_EXECUTION_RESULT_SEMANTICS',
    'CANCELLED results require cooperative cancellation and no failure');
  }
}

function assertCapabilitiesAuthorized(requested, supported) {
  const supportedKeys = new Set(supported.map(capabilityKey));
  for (const capability of requested) {
    executionInvariant(supportedKeys.has(capabilityKey(capability)),
      'EXECUTION_CAPABILITY_NOT_AUTHORIZED',
      'Requested capability is not supported by the adapter', { capability });
  }
}

function assertContractSafe(value, path) {
  assertNoSensitiveExecutionData(value, path);
  assertNoExecutableMaterial(value, path);
  assertNoPlaceholderData(value, path);
}

function assertObject(value, code, label) {
  executionInvariant(value && typeof value === 'object' && !Array.isArray(value),
    code, `${label} must be an object`);
}

function exactFields(value, fields, code, label) {
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  executionInvariant(JSON.stringify(actual) === JSON.stringify(expected),
    code, `${label} fields are invalid`, { actual, expected });
}

function assertUnique(values, code, message) {
  executionInvariant(new Set(values).size === values.length, code, message);
}

function capabilityKey(value) {
  return `${value.capabilityId}@${value.version}`;
}

function compareCapability(left, right) {
  return capabilityKey(left).localeCompare(capabilityKey(right));
}

function same(actual, expected, code, message) {
  executionInvariant(sha256(actual) === sha256(expected), code, message);
}
