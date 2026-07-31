import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  cloneExecutionJson,
  validateDigest,
  validateIdentifier,
  validateImmutableArtifactUri,
  validateNonEmptyString,
} from '@kdtp/execution-contract';
import {
  K6_API_ASSERTION_KINDS,
  K6_API_ASSERTION_SCHEMA_VERSION,
  K6_API_HTTP_METHODS,
  K6_API_OPERATION_SCHEMA_VERSION,
  K6_API_REQUEST_GROUP_SCHEMA_VERSION,
  K6_API_THRESHOLD_METRICS,
  K6_API_THRESHOLD_SCHEMA_VERSION,
} from './constants.js';
import { compilerInvariant } from './errors.js';
import { assertK6ApiCompilationSafe } from './safety.js';
import { exactFields, unique } from './validation.js';

const OPERATION_INPUT_FIELDS = new Set([
  'operationId', 'method', 'pathTemplate', 'requestBodyArtifact', 'queryParameters',
]);
const ASSERTION_FIELDS = new Set(['statusCodes', 'jsonPathExists', 'jsonPathEquals']);
const THRESHOLD_FIELDS = new Set(['maxDurationMs', 'maxFailureRate', 'minChecksRate']);
const BODY_ARTIFACT_FIELDS = new Set(['artifactId', 'mediaType', 'digest', 'uri']);
const QUERY_PARAMETER_FIELDS = new Set(['name', 'required', 'source']);
const JSON_PATH_EQUALS_FIELDS = new Set(['path', 'expected']);
const QUERY_PARAMETER_SOURCES = new Set(['TEST_DATA_ARTIFACT', 'CONSTANT_METADATA']);
const PATH_TEMPLATE = /^\/(?:[A-Za-z0-9._~!$&'()*+,;=:@%-]|\{[A-Za-z][A-Za-z0-9_]*\}|\/)*$/;
const JSON_PATH = /^\$(?:\.[A-Za-z_][A-Za-z0-9_]*|\[[0-9]+\])*$/;
const OPERATION_KEY = /^[A-Za-z][A-Za-z0-9._:-]{1,255}$/;
const QUERY_PARAMETER_NAME = /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/;

export function normalizeIntent(intent, descriptor, request) {
  assertK6ApiCompilationSafe(intent, `$.frozenTestPlan.intents.${intent.intentId}`);
  exactFields(intent.input, OPERATION_INPUT_FIELDS, 'INVALID_K6_API_OPERATION_INPUT',
    `Intent ${intent.intentId} input`, true, ['requestBodyArtifact', 'queryParameters']);
  const operationKey = validateOperationKey(intent.input.operationId);
  const method = String(intent.input.method ?? '').toUpperCase();
  compilerInvariant(K6_API_HTTP_METHODS.includes(method), 'INVALID_K6_API_HTTP_METHOD',
    'HTTP method is unsupported', { method });
  const pathTemplate = validatePathTemplate(intent.input.pathTemplate);
  const requestBodyArtifact = intent.input.requestBodyArtifact === undefined
    ? null : normalizeBodyArtifact(intent.input.requestBodyArtifact, request.inputArtifacts);
  const queryParameters = normalizeQueryParameters(intent.input.queryParameters ?? []);
  const assertions = normalizeAssertions(intent.intentId, intent.assertions);
  const thresholds = normalizeThresholds(intent.intentId, intent.thresholds);
  const identity = {
    sourceIntentId: intent.intentId,
    sourceOperationId: operationKey,
    targetId: intent.targetId,
    capability: intent.capability,
    method,
    pathTemplate,
    requestBodyArtifact,
    queryParameters,
    assertions,
    thresholds,
    sourceDependencyIntentIds: [...intent.dependencies].sort(),
    tags: [...intent.tags].sort(),
  };
  return {
    schemaVersion: K6_API_OPERATION_SCHEMA_VERSION,
    operationId: `k6op-${sha256(identity).slice(0, 20)}`,
    ...identity,
  };
}

function normalizeBodyArtifact(input, availableArtifacts) {
  exactFields(input, BODY_ARTIFACT_FIELDS, 'INVALID_K6_API_BODY_ARTIFACT',
    'requestBodyArtifact');
  const digest = validateDigest(input.digest, 'requestBodyArtifact.digest');
  validateImmutableArtifactUri(input.uri, digest);
  const expected = availableArtifacts.find((artifact) => artifact.artifactId === input.artifactId);
  compilerInvariant(expected && expected.digest === digest && expected.uri === input.uri
      && expected.mediaType === input.mediaType,
  'K6_API_BODY_ARTIFACT_BINDING_MISMATCH',
  'Request body Artifact is not bound to the Execution Request');
  return {
    artifactId: validateIdentifier(input.artifactId, 'requestBodyArtifact.artifactId'),
    mediaType: validateNonEmptyString(input.mediaType, 'requestBodyArtifact.mediaType', 128),
    digest,
    uri: input.uri,
  };
}

function normalizeQueryParameters(input) {
  compilerInvariant(Array.isArray(input) && input.length <= 100,
    'INVALID_K6_API_QUERY_PARAMETERS', 'queryParameters must contain at most 100 entries');
  const values = input.map((item, index) => {
    exactFields(item, QUERY_PARAMETER_FIELDS, 'INVALID_K6_API_QUERY_PARAMETER',
      `queryParameters[${index}]`);
    compilerInvariant(typeof item.required === 'boolean', 'INVALID_K6_API_QUERY_PARAMETER',
      'query parameter required must be boolean');
    compilerInvariant(QUERY_PARAMETER_SOURCES.has(item.source), 'INVALID_K6_API_QUERY_PARAMETER',
      'query parameter source is unsupported');
    return {
      name: validateQueryParameterName(item.name, index),
      required: item.required,
      source: item.source,
    };
  }).sort((left, right) => left.name.localeCompare(right.name));
  unique(values.map(({ name }) => name), 'DUPLICATE_K6_API_QUERY_PARAMETER');
  return values;
}

function normalizeAssertions(intentId, input) {
  compilerInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_K6_API_ASSERTIONS', 'Intent assertions must be an object');
  exactFields(input, ASSERTION_FIELDS, 'INVALID_K6_API_ASSERTIONS', 'Intent assertions', true,
    ['statusCodes', 'jsonPathExists', 'jsonPathEquals']);
  const items = [];
  const statusCodes = [...(input.statusCodes ?? [])];
  compilerInvariant(statusCodes.every((value) => Number.isSafeInteger(value) && value >= 100 && value <= 599),
    'INVALID_K6_API_STATUS_CODE', 'statusCodes must contain valid HTTP status codes');
  unique(statusCodes, 'DUPLICATE_K6_API_STATUS_CODE');
  if (statusCodes.length > 0) items.push(createAssertion(intentId, 'STATUS_CODE_IN', {
    operator: 'IN', expected: statusCodes.sort((a, b) => a - b),
  }));
  const exists = [...(input.jsonPathExists ?? [])].map(validateJsonPath).sort();
  unique(exists, 'DUPLICATE_K6_API_JSON_PATH_ASSERTION');
  for (const path of exists) items.push(createAssertion(intentId, 'JSON_PATH_EXISTS', {
    operator: 'EXISTS', path,
  }));
  const equals = [...(input.jsonPathEquals ?? [])].map((item, index) => {
    exactFields(item, JSON_PATH_EQUALS_FIELDS, 'INVALID_K6_API_JSON_PATH_ASSERTION',
      `jsonPathEquals[${index}]`);
    return { path: validateJsonPath(item.path), expected: cloneExecutionJson(item.expected) };
  }).sort((left, right) => left.path.localeCompare(right.path)
    || canonicalStringify(left.expected).localeCompare(canonicalStringify(right.expected)));
  unique(equals.map((item) => `${item.path}|${canonicalStringify(item.expected)}`),
    'DUPLICATE_K6_API_JSON_PATH_ASSERTION');
  for (const item of equals) items.push(createAssertion(intentId, 'JSON_PATH_EQUALS', {
    operator: 'EQUALS', path: item.path, expected: item.expected,
  }));
  compilerInvariant(items.length > 0, 'K6_API_ASSERTION_REQUIRED',
    'Each k6 API operation requires at least one assertion');
  return items.sort((left, right) => left.assertionId.localeCompare(right.assertionId));
}

function createAssertion(intentId, kind, payload) {
  compilerInvariant(K6_API_ASSERTION_KINDS.includes(kind), 'INVALID_K6_API_ASSERTION_KIND',
    'Assertion kind is unsupported');
  const identity = { sourceIntentId: intentId, kind, ...payload };
  return {
    schemaVersion: K6_API_ASSERTION_SCHEMA_VERSION,
    assertionId: `k6assert-${sha256(identity).slice(0, 20)}`,
    kind,
    ...payload,
  };
}

function normalizeThresholds(intentId, input) {
  compilerInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_K6_API_THRESHOLDS', 'Intent thresholds must be an object');
  exactFields(input, THRESHOLD_FIELDS, 'INVALID_K6_API_THRESHOLDS', 'Intent thresholds', true,
    ['maxDurationMs', 'maxFailureRate', 'minChecksRate']);
  const values = [];
  if (input.maxDurationMs !== undefined) {
    compilerInvariant(Number.isSafeInteger(input.maxDurationMs)
        && input.maxDurationMs >= 1 && input.maxDurationMs <= 86_400_000,
    'INVALID_K6_API_THRESHOLD_VALUE', 'maxDurationMs is outside the supported range');
    values.push(createThreshold(intentId, 'HTTP_REQUEST_DURATION_MS', 'LESS_THAN_OR_EQUAL',
      input.maxDurationMs));
  }
  for (const [field, metric, operator] of [
    ['maxFailureRate', 'CHECK_FAILURE_RATE', 'LESS_THAN_OR_EQUAL'],
    ['minChecksRate', 'CHECK_SUCCESS_RATE', 'GREATER_THAN_OR_EQUAL'],
  ]) {
    if (input[field] === undefined) continue;
    compilerInvariant(typeof input[field] === 'number' && Number.isFinite(input[field])
        && input[field] >= 0 && input[field] <= 1,
    'INVALID_K6_API_THRESHOLD_VALUE', `${field} must be between 0 and 1`);
    values.push(createThreshold(intentId, metric, operator, input[field]));
  }
  return values.sort((left, right) => left.thresholdId.localeCompare(right.thresholdId));
}

function createThreshold(intentId, metric, operator, value) {
  compilerInvariant(K6_API_THRESHOLD_METRICS.includes(metric), 'INVALID_K6_API_THRESHOLD_METRIC',
    'Threshold metric is unsupported');
  const identity = { sourceIntentId: intentId, metric, operator, value };
  return {
    schemaVersion: K6_API_THRESHOLD_SCHEMA_VERSION,
    thresholdId: `k6threshold-${sha256(identity).slice(0, 20)}`,
    metric,
    operator,
    value,
  };
}

export function createRequestGroups(operations) {
  const grouped = new Map();
  for (const operation of operations) {
    const values = grouped.get(operation.targetId) ?? [];
    values.push(operation);
    grouped.set(operation.targetId, values);
  }
  return [...grouped.entries()].map(([targetId, values]) => {
    const sorted = values.sort((left, right) => left.operationId.localeCompare(right.operationId));
    const identity = { targetId, operationIds: sorted.map(({ operationId }) => operationId) };
    return {
      schemaVersion: K6_API_REQUEST_GROUP_SCHEMA_VERSION,
      groupId: `k6group-${sha256(identity).slice(0, 20)}`,
      targetId,
      operations: sorted,
    };
  }).sort((left, right) => left.groupId.localeCompare(right.groupId));
}

function validateOperationKey(value) {
  compilerInvariant(typeof value === 'string' && OPERATION_KEY.test(value),
    'INVALID_K6_API_OPERATION_ID', 'operationId must be a stable HTTP operation identifier');
  return value;
}

function validateQueryParameterName(value, index) {
  compilerInvariant(typeof value === 'string' && QUERY_PARAMETER_NAME.test(value),
    'INVALID_K6_API_QUERY_PARAMETER', 'query parameter name is invalid', { index, value });
  return value;
}

function validatePathTemplate(value) {
  compilerInvariant(typeof value === 'string' && value.length <= 2048
      && PATH_TEMPLATE.test(value) && !value.includes('..') && !value.includes('\\'),
  'INVALID_K6_API_PATH_TEMPLATE', 'pathTemplate must be a relative HTTP path template');
  return value;
}

function validateJsonPath(value) {
  compilerInvariant(typeof value === 'string' && value.length <= 512 && JSON_PATH.test(value),
    'INVALID_K6_API_JSON_PATH', 'JSON path is unsupported', { value });
  return value;
}
