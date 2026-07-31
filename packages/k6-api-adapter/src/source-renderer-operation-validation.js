import {
  K6_API_HTTP_METHODS,
  K6_API_OPERATION_SCHEMA_VERSION,
  K6_API_REQUEST_GROUP_SCHEMA_VERSION,
} from './constants.js';
import { sourceRendererInvariant } from './errors.js';
import {
  DIGEST,
  OPERATION_ID,
  exactFields,
  validateSafeString,
  validateUniqueStrings,
} from './source-renderer-shared.js';
import {
  validateAssertion,
  validateThreshold,
} from './source-renderer-assertion-validation.js';

const GROUP_FIELDS = Object.freeze(['schemaVersion', 'groupId', 'targetId', 'operations']);
const OPERATION_FIELDS = Object.freeze([
  'schemaVersion', 'operationId', 'sourceIntentId', 'sourceOperationId',
  'targetId', 'capability', 'method', 'pathTemplate', 'requestBodyArtifact',
  'queryParameters', 'assertions', 'thresholds', 'sourceDependencyIntentIds',
  'tags', 'dependencyOperationIds',
]);
const BODY_FIELDS = Object.freeze(['artifactId', 'mediaType', 'digest', 'uri']);
const CAPABILITY_FIELDS = Object.freeze(['capabilityId', 'version']);
const PATH_TEMPLATE = /^\/(?:[A-Za-z0-9._~!$&'()*+,;=:@%-]|\{[A-Za-z][A-Za-z0-9_]*\}|\/)*$/;
const GROUP_ID = /^k6group-[a-f0-9]{20}$/;
const ARTIFACT_URI = /^artifact:\/\/sha256\/([a-f0-9]{64})$/;

export function validateGroup(group, limits, state) {
  exactFields(group, GROUP_FIELDS, 'INVALID_K6_API_RENDERABLE_GROUP', 'Request Group');
  sourceRendererInvariant(group.schemaVersion === K6_API_REQUEST_GROUP_SCHEMA_VERSION
      && GROUP_ID.test(group.groupId) && !state.groups.has(group.groupId),
  'INVALID_K6_API_RENDERABLE_GROUP', 'Request Group identity is invalid');
  state.groups.add(group.groupId);
  validateSafeString(group.targetId, '$.spec.requestGroups.targetId', limits);
  sourceRendererInvariant(Array.isArray(group.operations) && group.operations.length > 0,
    'INVALID_K6_API_RENDERABLE_GROUP', 'Request Group operations must be non-empty');
  for (const operation of group.operations) validateOperation(operation, group, limits, state);
}

function validateOperation(operation, group, limits, state) {
  exactFields(operation, OPERATION_FIELDS, 'INVALID_K6_API_RENDERABLE_OPERATION', 'Operation');
  sourceRendererInvariant(operation.schemaVersion === K6_API_OPERATION_SCHEMA_VERSION
      && OPERATION_ID.test(operation.operationId)
      && !state.operations.has(operation.operationId),
  'INVALID_K6_API_RENDERABLE_OPERATION', 'Operation identity is invalid');
  state.operations.add(operation.operationId);
  sourceRendererInvariant(!state.intents.has(operation.sourceIntentId),
    'INVALID_K6_API_RENDERABLE_OPERATION', 'Operation source intent is duplicated');
  state.intents.add(operation.sourceIntentId);
  sourceRendererInvariant(operation.targetId === group.targetId,
    'K6_API_SOURCE_GROUP_TARGET_MISMATCH', 'Operation target does not match its group');
  sourceRendererInvariant(K6_API_HTTP_METHODS.includes(operation.method),
    'INVALID_K6_API_RENDERABLE_OPERATION', 'Operation HTTP method is unsupported');
  sourceRendererInvariant(typeof operation.pathTemplate === 'string'
      && operation.pathTemplate.length <= 2048
      && PATH_TEMPLATE.test(operation.pathTemplate)
      && !operation.pathTemplate.includes('..')
      && !operation.pathTemplate.includes('\\'),
  'INVALID_K6_API_RENDERABLE_OPERATION', 'Operation path template is unsafe');
  for (const [field, value] of [
    ['sourceIntentId', operation.sourceIntentId],
    ['sourceOperationId', operation.sourceOperationId],
    ['targetId', operation.targetId],
  ]) validateSafeString(value, `$.operation.${field}`, limits);
  exactFields(operation.capability, CAPABILITY_FIELDS,
    'INVALID_K6_API_RENDERABLE_OPERATION', 'Operation capability');
  validateSafeString(operation.capability.capabilityId, '$.operation.capabilityId', limits);
  validateSafeString(operation.capability.version, '$.operation.capabilityVersion', limits);
  if (operation.requestBodyArtifact !== null) validateArtifact(operation.requestBodyArtifact, limits, true);
  sourceRendererInvariant(Array.isArray(operation.queryParameters),
    'INVALID_K6_API_RENDERABLE_OPERATION', 'Operation queryParameters must be an array');
  sourceRendererInvariant(operation.queryParameters.length === 0,
    'K6_API_SOURCE_QUERY_PARAMETER_VALUE_UNAVAILABLE',
    'P2 cannot render query parameters because the accepted IR contains no bound values');
  validateAssertions(operation, limits, state);
  validateThresholds(operation, limits, state);
  validateUniqueStrings(operation.sourceDependencyIntentIds,
    '$.operation.sourceDependencyIntentIds', limits);
  validateUniqueStrings(operation.dependencyOperationIds,
    '$.operation.dependencyOperationIds', limits, OPERATION_ID);
  validateUniqueStrings(operation.tags, '$.operation.tags', limits);
}

function validateAssertions(operation, limits, state) {
  sourceRendererInvariant(Array.isArray(operation.assertions)
      && operation.assertions.length > 0
      && operation.assertions.length <= limits.maxAssertionsPerOperation,
  'K6_API_SOURCE_INVALID_ASSERTION_COUNT', 'Operation assertion count is invalid');
  for (const assertion of operation.assertions) {
    validateAssertion(assertion, limits);
    sourceRendererInvariant(!state.assertions.has(assertion.assertionId),
      'INVALID_K6_API_RENDERABLE_ASSERTION', 'Assertion identity is duplicated');
    state.assertions.add(assertion.assertionId);
  }
}

function validateThresholds(operation, limits, state) {
  sourceRendererInvariant(Array.isArray(operation.thresholds)
      && operation.thresholds.length <= limits.maxThresholdsPerOperation,
  'K6_API_SOURCE_INVALID_THRESHOLD_COUNT', 'Operation threshold count is invalid');
  for (const threshold of operation.thresholds) {
    validateThreshold(threshold);
    sourceRendererInvariant(!state.thresholds.has(threshold.thresholdId),
      'INVALID_K6_API_RENDERABLE_THRESHOLD', 'Threshold identity is duplicated');
    state.thresholds.add(threshold.thresholdId);
  }
}

export function validateArtifact(artifact, limits, bodyOnly = false) {
  exactFields(artifact, bodyOnly ? BODY_FIELDS
    : ['artifactId', 'kind', 'mediaType', 'digest', 'uri'],
  'INVALID_K6_API_RENDERABLE_ARTIFACT', 'Artifact reference');
  validateSafeString(artifact.artifactId, '$.artifact.artifactId', limits);
  if (!bodyOnly) validateSafeString(artifact.kind, '$.artifact.kind', limits);
  validateSafeString(artifact.mediaType, '$.artifact.mediaType', limits);
  sourceRendererInvariant(DIGEST.test(artifact.digest)
      && ARTIFACT_URI.exec(artifact.uri)?.[1] === artifact.digest,
  'INVALID_K6_API_RENDERABLE_ARTIFACT', 'Artifact reference is not immutable');
}

export function validateDependencyGraph(groups, operationIds) {
  const groupByOperation = new Map();
  for (const group of groups) {
    for (const operation of group.operations) groupByOperation.set(operation.operationId, group.groupId);
  }
  const byId = new Map(groups.flatMap((group) => group.operations)
    .map((operation) => [operation.operationId, operation]));
  for (const group of groups) {
    for (const operation of group.operations) {
      for (const dependency of operation.dependencyOperationIds) {
        sourceRendererInvariant(operationIds.has(dependency) && dependency !== operation.operationId,
          'K6_API_SOURCE_INVALID_DEPENDENCY', 'Operation dependency is invalid');
        sourceRendererInvariant(groupByOperation.get(dependency).localeCompare(group.groupId) <= 0,
          'K6_API_SOURCE_DEPENDENCY_ORDER_CONFLICT',
          'Operation depends on a lexicographically later group');
      }
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    sourceRendererInvariant(!visiting.has(id), 'K6_API_SOURCE_DEPENDENCY_CYCLE',
      'Operation dependency graph contains a cycle');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).dependencyOperationIds) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) visit(id);
}
