import { sha256 } from '@kdtp/knowledge-core';
import {
  K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION,
  K6_API_ASSERTION_SCHEMA_VERSION,
  K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION,
  K6_API_COMPILER_VERSION,
  K6_API_EXECUTION_SPEC_SCHEMA_VERSION,
  K6_API_OPERATION_SCHEMA_VERSION,
  K6_API_REQUEST_GROUP_SCHEMA_VERSION,
  K6_API_THRESHOLD_SCHEMA_VERSION,
} from '../packages/k6-api-adapter/src/constants.js';
import { computeK6ApiCompilationEvidenceDigest } from '../packages/k6-api-adapter/src/compiler.js';
import {
  createK6ApiSourceGenerationRequest,
  createK6ApiSourceGeneratorDescriptor,
} from '../packages/k6-api-adapter/src/source-contract.js';

export const ACCEPTED_COMPILER_DECISION = Object.freeze({
  apiAdapterCompilerReady: true,
  executionRuntimeStarted: false,
  k6Invoked: false,
  externalProcessExecuted: false,
  nextRequiredSlice: 'M3-R2',
  repositoryBlockers: Object.freeze([]),
});
export const ACCEPTED_COMPILER_SAFETY_BOUNDARY = Object.freeze({
  k6Invoked: false,
  xk6Invoked: false,
  playwrightInvoked: false,
  externalProcessExecuted: false,
  networkEndpointAccessed: false,
  secretAccessed: false,
  filesystemCredentialAccessed: false,
  runnableJavaScriptGenerated: false,
  temporaryExecutionDirectoryCreated: false,
  containerStarted: false,
  kubernetesResourceCreated: false,
  workerAdded: false,
  queueAdded: false,
  schedulerAdded: false,
  runtimeResultCollected: false,
});

export const D = (character) => character.repeat(64);
export const BODY_ARTIFACT = Object.freeze({
  artifactId: 'artifact-approval-payload-v1',
  kind: 'test-data',
  mediaType: 'application/json',
  digest: D('6'),
  uri: `artifact://sha256/${D('6')}`,
});

export function statusAssertion(hex, expected = [201, 202]) {
  return {
    schemaVersion: K6_API_ASSERTION_SCHEMA_VERSION,
    assertionId: `k6assert-${hex.padStart(20, hex).slice(0, 20)}`,
    kind: 'STATUS_CODE_IN',
    operator: 'IN',
    expected,
  };
}

export function existsAssertion(hex, path) {
  return {
    schemaVersion: K6_API_ASSERTION_SCHEMA_VERSION,
    assertionId: `k6assert-${hex.padStart(20, hex).slice(0, 20)}`,
    kind: 'JSON_PATH_EXISTS',
    operator: 'EXISTS',
    path,
  };
}

export function equalsAssertion(hex, path, expected) {
  return {
    schemaVersion: K6_API_ASSERTION_SCHEMA_VERSION,
    assertionId: `k6assert-${hex.padStart(20, hex).slice(0, 20)}`,
    kind: 'JSON_PATH_EQUALS',
    operator: 'EQUALS',
    path,
    expected,
  };
}

export function threshold(hex, metric, operator, value) {
  return {
    schemaVersion: K6_API_THRESHOLD_SCHEMA_VERSION,
    thresholdId: `k6threshold-${hex.padStart(20, hex).slice(0, 20)}`,
    metric,
    operator,
    value,
  };
}

export function operation({ hex, intent, sourceOperationId, targetId, method = 'GET',
  pathTemplate, body = null, dependencyOperations = [], dependencyIntents = [],
  assertions, thresholds = [], tags = [], queryParameters = [] }) {
  return {
    schemaVersion: K6_API_OPERATION_SCHEMA_VERSION,
    operationId: `k6op-${hex.padStart(20, hex).slice(0, 20)}`,
    sourceIntentId: intent,
    sourceOperationId,
    targetId,
    capability: { capabilityId: 'api-functional', version: '1.0.0' },
    method,
    pathTemplate,
    requestBodyArtifact: body,
    queryParameters,
    assertions,
    thresholds,
    sourceDependencyIntentIds: dependencyIntents,
    tags,
    dependencyOperationIds: dependencyOperations,
  };
}

export function createRenderableSpecWithoutDigest() {
  const submit = operation({
    hex: '1',
    intent: 'intent-submit',
    sourceOperationId: 'submitApproval',
    targetId: 'api:approval-submit',
    method: 'POST',
    pathTemplate: '/v1/approvals/{approvalId}',
    body: {
      artifactId: BODY_ARTIFACT.artifactId,
      mediaType: BODY_ARTIFACT.mediaType,
      digest: BODY_ARTIFACT.digest,
      uri: BODY_ARTIFACT.uri,
    },
    assertions: [
      equalsAssertion('3', '$.status', 'PENDING'),
      statusAssertion('1'),
      existsAssertion('2', '$.id'),
    ],
    thresholds: [
      threshold('2', 'CHECK_FAILURE_RATE', 'LESS_THAN_OR_EQUAL', 0.01),
      threshold('1', 'HTTP_REQUEST_DURATION_MS', 'LESS_THAN_OR_EQUAL', 1500),
    ],
    tags: ['mandatory', 'api'],
  });
  const status = operation({
    hex: '2',
    intent: 'intent-status',
    sourceOperationId: 'getApprovalStatus',
    targetId: 'api:approval-submit',
    pathTemplate: '/v1/approvals/{approvalId}/status',
    dependencyOperations: [submit.operationId],
    dependencyIntents: [submit.sourceIntentId],
    assertions: [statusAssertion('4', [200]), existsAssertion('5', '$.status')],
    thresholds: [threshold('3', 'CHECK_SUCCESS_RATE', 'GREATER_THAN_OR_EQUAL', 0.995)],
    tags: ['functional', 'api'],
  });
  const audit = operation({
    hex: '3',
    intent: 'intent-audit',
    sourceOperationId: 'getApprovalAudit',
    targetId: 'api:approval-audit',
    pathTemplate: '/v1/approvals/{approvalId}/audit',
    dependencyOperations: [status.operationId],
    dependencyIntents: [status.sourceIntentId],
    assertions: [statusAssertion('6', [200]), existsAssertion('7', '$.entries[0]')],
    tags: ['audit', 'api'],
  });
  return {
    schemaVersion: K6_API_EXECUTION_SPEC_SCHEMA_VERSION,
    compilerVersion: K6_API_COMPILER_VERSION,
    inputContractDigest: D('4'),
    projectId: 'approval-platform',
    environment: { environmentId: 'staging-us-east-1', version: '1.0.0', digest: D('2') },
    frozenTestPlan: {
      planId: 'plan-m3-r2-p2',
      revision: 4,
      contentDigest: D('3'),
      inputFingerprint: D('5'),
    },
    knowledgeSnapshot: { snapshotId: 'snapshot-m3-r2-p2', digest: D('7') },
    adapter: {
      adapterId: 'adapter-k6-api-v1',
      adapterType: 'k6-api',
      version: '1.0.0',
      descriptorDigest: D('8'),
    },
    capabilities: [{ capabilityId: 'api-functional', version: '1.0.0' }],
    requestGroups: [
      {
        schemaVersion: K6_API_REQUEST_GROUP_SCHEMA_VERSION,
        groupId: `k6group-${'b'.repeat(20)}`,
        targetId: 'api:approval-audit',
        operations: [audit],
      },
      {
        schemaVersion: K6_API_REQUEST_GROUP_SCHEMA_VERSION,
        groupId: `k6group-${'a'.repeat(20)}`,
        targetId: 'api:approval-submit',
        operations: [status, submit],
      },
    ],
    inputArtifacts: [{ ...BODY_ARTIFACT }],
    specId: `k6spec-${'b'.repeat(20)}`,
  };
}

