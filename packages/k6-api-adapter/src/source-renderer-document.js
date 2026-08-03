import {
  compareThreshold,
  hasJsonAssertions,
  renderOperation,
} from './source-renderer-operation.js';
import { formatNumber, quote } from './source-renderer-shared.js';

export function renderSourceDocument(context) {
  const lines = [
    "import { check, group } from 'k6';",
    "import http from 'k6/http';",
    '',
  ];
  const thresholdLines = renderOptions(context.operations);
  if (thresholdLines.length > 0) lines.push(...thresholdLines, '');
  if (context.operations.some(hasJsonAssertions)) lines.push(...renderJsonHelpers(), '');
  lines.push('export default function k6ApiGeneratedSource() {');
  for (const group of context.groups) {
    lines.push(`  group(${quote(`group:${group.groupId}:${group.targetId}`)}, () => {`);
    for (const operation of group.operations) {
      lines.push(...renderOperation(group, operation).map((line) => `    ${line}`));
    }
    lines.push('  });');
  }
  lines.push('}', '');
  return lines.join('\n');
}

function renderOptions(operations) {
  const thresholdMap = new Map();
  for (const operation of operations) {
    for (const threshold of [...operation.thresholds].sort(compareThreshold)) {
      const { metricKey, expression } = renderThreshold(operation, threshold);
      const values = thresholdMap.get(metricKey) ?? [];
      values.push(expression);
      thresholdMap.set(metricKey, values);
    }
  }
  if (thresholdMap.size === 0) return [];
  const lines = ['export const options = Object.freeze({', '  thresholds: Object.freeze({'];
  for (const key of [...thresholdMap.keys()].sort()) {
    const expressions = [...new Set(thresholdMap.get(key))].sort().map(quote).join(', ');
    lines.push(`    ${quote(key)}: Object.freeze([${expressions}]),`);
  }
  lines.push('  }),', '});');
  return lines;
}

function renderThreshold(operation, threshold) {
  if (threshold.metric === 'HTTP_REQUEST_DURATION_MS') {
    return {
      metricKey: `http_req_duration{operation_id:${operation.operationId}}`,
      expression: `p(95)<=${formatNumber(threshold.value)}`,
    };
  }
  const minimum = threshold.metric === 'CHECK_FAILURE_RATE'
    ? 1 - threshold.value : threshold.value;
  return {
    metricKey: `checks{operation_id:${operation.operationId}}`,
    expression: `rate>=${formatNumber(minimum)}`,
  };
}

function renderJsonHelpers() {
  return [
    'function parseJson(response) {',
    '  try {',
    '    return response.json();',
    '  } catch {',
    '    return undefined;',
    '  }',
    '}',
    '',
    'function readJsonPath(value, segments) {',
    '  let current = value;',
    '  for (const segment of segments) {',
    '    if (current === null || current === undefined',
    '        || !Object.prototype.hasOwnProperty.call(current, segment)) {',
    '      return Object.freeze({ found: false, value: undefined });',
    '    }',
    '    current = current[segment];',
    '  }',
    '  return Object.freeze({ found: true, value: current });',
    '}',
    '',
    'function deepEqual(left, right) {',
    '  if (Object.is(left, right)) return true;',
    '  if (Array.isArray(left) && Array.isArray(right)) {',
    '    return left.length === right.length',
    '      && left.every((value, index) => deepEqual(value, right[index]));',
    '  }',
    '  if (!left || !right || typeof left !== \'object\' || typeof right !== \'object\') {',
    '    return false;',
    '  }',
    '  const leftKeys = Object.keys(left).sort();',
    '  const rightKeys = Object.keys(right).sort();',
    '  return deepEqual(leftKeys, rightKeys)',
    '    && leftKeys.every((key) => deepEqual(left[key], right[key]));',
    '}',
  ];
}
