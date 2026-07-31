import {
  K6_API_ASSERTION_KINDS,
  K6_API_ASSERTION_SCHEMA_VERSION,
  K6_API_THRESHOLD_METRICS,
  K6_API_THRESHOLD_SCHEMA_VERSION,
} from './constants.js';
import { sourceRendererInvariant } from './errors.js';
import { assertBoundedJson, exactFields } from './source-renderer-shared.js';

const JSON_PATH = /^\$(?:\.[A-Za-z_][A-Za-z0-9_]*|\[[0-9]+\])*$/;
const ASSERTION_ID = /^k6assert-[a-f0-9]{20}$/;
const THRESHOLD_ID = /^k6threshold-[a-f0-9]{20}$/;

export function validateAssertion(assertion, limits) {
  sourceRendererInvariant(assertion && typeof assertion === 'object'
      && !Array.isArray(assertion)
      && assertion.schemaVersion === K6_API_ASSERTION_SCHEMA_VERSION
      && ASSERTION_ID.test(assertion.assertionId)
      && K6_API_ASSERTION_KINDS.includes(assertion.kind),
  'INVALID_K6_API_RENDERABLE_ASSERTION', 'Assertion identity or kind is invalid');
  if (assertion.kind === 'STATUS_CODE_IN') {
    exactFields(assertion, ['schemaVersion', 'assertionId', 'kind', 'operator', 'expected'],
      'INVALID_K6_API_RENDERABLE_ASSERTION', 'Status assertion');
    sourceRendererInvariant(assertion.operator === 'IN' && Array.isArray(assertion.expected)
        && assertion.expected.length > 0
        && new Set(assertion.expected).size === assertion.expected.length
        && assertion.expected.every((value) => Number.isSafeInteger(value)
          && value >= 100 && value <= 599),
    'INVALID_K6_API_RENDERABLE_ASSERTION', 'Status assertion is invalid');
    return;
  }
  if (assertion.kind === 'JSON_PATH_EXISTS') {
    exactFields(assertion, ['schemaVersion', 'assertionId', 'kind', 'operator', 'path'],
      'INVALID_K6_API_RENDERABLE_ASSERTION', 'JSON path exists assertion');
    sourceRendererInvariant(assertion.operator === 'EXISTS' && JSON_PATH.test(assertion.path),
      'INVALID_K6_API_RENDERABLE_ASSERTION', 'JSON path exists assertion is invalid');
    return;
  }
  exactFields(assertion,
    ['schemaVersion', 'assertionId', 'kind', 'operator', 'path', 'expected'],
    'INVALID_K6_API_RENDERABLE_ASSERTION', 'JSON path equals assertion');
  sourceRendererInvariant(assertion.operator === 'EQUALS' && JSON_PATH.test(assertion.path),
    'INVALID_K6_API_RENDERABLE_ASSERTION', 'JSON path equals assertion is invalid');
  assertBoundedJson(assertion.expected, '$.assertion.expected', 0, limits);
}

export function validateThreshold(threshold) {
  exactFields(threshold, ['schemaVersion', 'thresholdId', 'metric', 'operator', 'value'],
    'INVALID_K6_API_RENDERABLE_THRESHOLD', 'Threshold');
  sourceRendererInvariant(threshold.schemaVersion === K6_API_THRESHOLD_SCHEMA_VERSION
      && THRESHOLD_ID.test(threshold.thresholdId)
      && K6_API_THRESHOLD_METRICS.includes(threshold.metric)
      && ['LESS_THAN_OR_EQUAL', 'GREATER_THAN_OR_EQUAL'].includes(threshold.operator)
      && typeof threshold.value === 'number' && Number.isFinite(threshold.value),
  'INVALID_K6_API_RENDERABLE_THRESHOLD', 'Threshold is invalid');
  if (threshold.metric === 'HTTP_REQUEST_DURATION_MS') {
    sourceRendererInvariant(Number.isSafeInteger(threshold.value)
        && threshold.value >= 1 && threshold.value <= 86_400_000
        && threshold.operator === 'LESS_THAN_OR_EQUAL',
    'INVALID_K6_API_RENDERABLE_THRESHOLD', 'Duration threshold is invalid');
  } else {
    sourceRendererInvariant(threshold.value >= 0 && threshold.value <= 1,
      'INVALID_K6_API_RENDERABLE_THRESHOLD', 'Rate threshold is invalid');
  }
}
