import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  formatNumber,
  quote,
  renderJsLiteral,
  variableName,
} from './source-renderer-shared.js';

export function renderOperation(group, operation) {
  const responseVariable = variableName('response', operation.operationId);
  const jsonVariable = variableName('json', operation.operationId);
  const bodyVariable = variableName('body', operation.operationId);
  const lines = [];
  if (operation.requestBodyArtifact !== null) {
    lines.push(`const ${bodyVariable} = ${quote(canonicalStringify(operation.requestBodyArtifact))};`);
  }
  lines.push(`const ${responseVariable} = http.request(`);
  lines.push(`  ${quote(operation.method)},`);
  lines.push(`  ${quote(operation.pathTemplate)},`);
  lines.push(`  ${operation.requestBodyArtifact === null ? 'null' : bodyVariable},`);
  lines.push(...renderRequestParams(group, operation).map((line) => `  ${line}`));
  lines.push(');');
  if (hasJsonAssertions(operation)) lines.push(`const ${jsonVariable} = parseJson(${responseVariable});`);
  lines.push(`check(${responseVariable}, {`);
  for (const assertion of [...operation.assertions].sort(compareAssertion)) {
    lines.push(`  ${quote(checkName(assertion))}: ${renderCheck(assertion,
      responseVariable, jsonVariable)},`);
  }
  lines.push('}, Object.freeze({');
  lines.push(`  ${quote('group_id')}: ${quote(group.groupId)},`);
  lines.push(`  ${quote('operation_id')}: ${quote(operation.operationId)},`);
  lines.push('}));');
  return lines;
}

function renderRequestParams(group, operation) {
  const headers = {};
  if (hasJsonAssertions(operation)) headers.Accept = 'application/json';
  if (operation.requestBodyArtifact !== null) {
    headers['Content-Type'] = operation.requestBodyArtifact.mediaType;
  }
  const tags = {
    capability_id: operation.capability.capabilityId,
    capability_version: operation.capability.version,
    group_id: group.groupId,
    operation_id: operation.operationId,
    source_intent_id: operation.sourceIntentId,
    source_operation_id: operation.sourceOperationId,
    target_id: operation.targetId,
  };
  if (operation.requestBodyArtifact !== null) {
    tags.body_artifact_digest = operation.requestBodyArtifact.digest;
    tags.body_artifact_id = operation.requestBodyArtifact.artifactId;
  }
  for (const tag of [...operation.tags].sort()) {
    tags[`intent_tag_${sha256(tag).slice(0, 12)}`] = tag;
  }
  const lines = ['Object.freeze({'];
  if (Object.keys(headers).length > 0) {
    lines.push('  headers: Object.freeze({');
    for (const key of Object.keys(headers).sort()) {
      lines.push(`    ${quote(key)}: ${quote(headers[key])},`);
    }
    lines.push('  }),');
  }
  lines.push('  tags: Object.freeze({');
  for (const key of Object.keys(tags).sort()) {
    lines.push(`    ${quote(key)}: ${quote(tags[key])},`);
  }
  lines.push('  }),', '}),');
  return lines;
}

function renderCheck(assertion, responseVariable, jsonVariable) {
  if (assertion.kind === 'STATUS_CODE_IN') {
    return `(response) => ${renderJsLiteral([...assertion.expected].sort((a, b) => a - b))}`
      + '.includes(response.status)';
  }
  const path = renderJsLiteral(jsonPathSegments(assertion.path));
  if (assertion.kind === 'JSON_PATH_EXISTS') {
    return `() => readJsonPath(${jsonVariable}, ${path}).found`;
  }
  return `() => { const match = readJsonPath(${jsonVariable}, ${path}); `
    + `return match.found && deepEqual(match.value, ${renderJsLiteral(assertion.expected)}); }`;
}

function checkName(assertion) {
  if (assertion.kind === 'STATUS_CODE_IN') {
    return `status-code-in:${[...assertion.expected].sort((a, b) => a - b).join(',')}`
      + `:${assertion.assertionId}`;
  }
  if (assertion.kind === 'JSON_PATH_EXISTS') {
    return `json-path-exists:${assertion.path}:${assertion.assertionId}`;
  }
  return `json-path-equals:${assertion.path}:${sha256(assertion.expected).slice(0, 12)}`
    + `:${assertion.assertionId}`;
}

export function compareAssertion(left, right) {
  const sortKey = (assertion) => {
    const path = assertion.path ?? '';
    const expected = Object.hasOwn(assertion, 'expected')
      ? canonicalStringify(assertion.expected) : '';
    return `${assertion.kind}\u0000${path}\u0000${expected}\u0000${assertion.assertionId}`;
  };
  return sortKey(left).localeCompare(sortKey(right));
}

export function compareThreshold(left, right) {
  return `${left.metric}\u0000${left.operator}\u0000${formatNumber(left.value)}\u0000${left.thresholdId}`
    .localeCompare(`${right.metric}\u0000${right.operator}\u0000${formatNumber(right.value)}\u0000${right.thresholdId}`);
}

export function hasJsonAssertions(operation) {
  return operation.assertions.some((assertion) => assertion.kind !== 'STATUS_CODE_IN');
}

function jsonPathSegments(path) {
  const segments = [];
  const matcher = /\.([A-Za-z_][A-Za-z0-9_]*)|\[([0-9]+)\]/g;
  let match;
  while ((match = matcher.exec(path)) !== null) segments.push(match[1] ?? Number(match[2]));
  return segments;
}
