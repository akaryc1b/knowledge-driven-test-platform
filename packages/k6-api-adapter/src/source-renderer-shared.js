import { createHash } from 'node:crypto';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { sourceRendererInvariant } from './errors.js';

export const RESULT_FIELDS = Object.freeze([
  'schemaVersion', 'sourceIdentity', 'generationRequestDigest',
  'renderingPolicyDigest', 'generatorDescriptorDigest', 'specDigest',
  'bundleDigest', 'compilationEvidenceDigest', 'sourceDigest',
  'sourceByteLength', 'sourceLineCount', 'moduleImports', 'operationCount',
  'assertionCount', 'thresholdCount', 'safetyBoundary', 'source', 'resultDigest',
]);
export const RENDER_INPUT_FIELDS = Object.freeze([
  'descriptor', 'generationRequest', 'spec', 'bundle', 'compilationEvidence',
]);
export const DIGEST = /^[a-f0-9]{64}$/;
export const OPERATION_ID = /^k6op-[a-f0-9]{20}$/;
export const CREDENTIAL_URI = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/i;
export const ABSOLUTE_FILE_PATH = /(?:^|['"\s])(?:[A-Za-z]:\\|\/(?:tmp|var|etc|home|Users|opt|root)(?:\/|['"\s]))/;
export const VOLATILE_TEXT = /(?:\bbranch\b|commit[_ -]?sha|refs\/heads|run[_ -]?id|github\.|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/i;
export const SECRET_TEXT = /(?:\bauthorization\b|\bcookie\b|\bbearer\b|\bpassword\b|\bsecret\b|api[_-]?key|credential)/i;
export const SAFETY_BOUNDARY = Object.freeze({
  sourceGenerated: true,
  sourceExecuted: false,
  executionRuntimeStarted: false,
  k6Invoked: false,
  xk6Invoked: false,
  playwrightInvoked: false,
  externalProcessExecuted: false,
  nodeVmUsed: false,
  evalUsed: false,
  dynamicImportUsed: false,
  targetNetworkAccessed: false,
  databaseAccessed: false,
  secretAccessed: false,
  filesystemCredentialAccessed: false,
  temporaryExecutionDirectoryCreated: false,
  containerStarted: false,
  kubernetesResourceCreated: false,
  workerAdded: false,
  queueAdded: false,
  schedulerAdded: false,
  runtimeResultCollected: false,
  allureImplemented: false,
});

export function exactFields(value, fields, code, label) {
  sourceRendererInvariant(value && typeof value === 'object' && !Array.isArray(value),
    code, `${label} must be an object`);
  const expected = [...fields].sort();
  const actual = Object.keys(value).sort();
  sourceRendererInvariant(canonicalStringify(actual) === canonicalStringify(expected),
    code, `${label} fields are not strictly closed`, { expected, actual });
}

export function validateSafeString(value, path, limits) {
  sourceRendererInvariant(typeof value === 'string' && value.length > 0
      && Buffer.byteLength(value, 'utf8') <= limits.maxStringBytes
      && !value.includes('\u0000') && !value.includes('\r')
      && !/\bhttps?:\/\//i.test(value)
      && !CREDENTIAL_URI.test(value)
      && !SECRET_TEXT.test(value)
      && !VOLATILE_TEXT.test(value)
      && !/^[a-f0-9]{40}$/.test(value),
  'K6_API_SOURCE_UNSAFE_BOUND_STRING', 'Source-bound string is unsafe', { path });
}

export function validateUniqueStrings(values, path, limits, pattern = null) {
  sourceRendererInvariant(Array.isArray(values) && new Set(values).size === values.length,
    'K6_API_SOURCE_INVALID_STRING_SET', 'Source-bound string set is invalid', { path });
  for (const value of values) {
    validateSafeString(value, path, limits);
    sourceRendererInvariant(pattern === null || pattern.test(value),
      'K6_API_SOURCE_INVALID_STRING_SET', 'Source-bound string set contains invalid value',
      { path, value });
  }
}

export function validateDigestFields(values) {
  sourceRendererInvariant(values.every((value) => typeof value === 'string'
      && DIGEST.test(value)),
  'INVALID_K6_API_RENDERABLE_SPEC', 'Spec contains an invalid digest');
}

export function assertBoundedJson(value, path, depth, limits) {
  sourceRendererInvariant(depth <= limits.maxNestingDepth,
    'K6_API_SOURCE_MAX_DEPTH_EXCEEDED', 'Source-bound JSON exceeds nesting limit', { path });
  if (typeof value === 'string') {
    sourceRendererInvariant(Buffer.byteLength(value, 'utf8') <= limits.maxStringBytes,
      'K6_API_SOURCE_STRING_TOO_LARGE', 'Source-bound JSON string exceeds limit', { path });
    validateSafeString(value, path, limits);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertBoundedJson(item, `${path}[${index}]`, depth + 1, limits));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    validateSafeString(key, `${path}.key`, limits);
    assertBoundedJson(item, `${path}.${key}`, depth + 1, limits);
  }
}

export function renderJsLiteral(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map(renderJsLiteral).join(', ')}]`;
  const entries = Object.keys(value).sort()
    .map((key) => `${quote(key)}: ${renderJsLiteral(value[key])}`);
  return `{ ${entries.join(', ')} }`;
}

export function quote(value) {
  let output = "'";
  for (const character of String(value)) {
    const code = character.codePointAt(0);
    if (character === "'") output += "\\'";
    else if (character === '\\') output += '\\\\';
    else if (character === '\n') output += '\\n';
    else if (character === '\r') output += '\\r';
    else if (character === '\t') output += '\\t';
    else if (code < 0x20 || code === 0x2028 || code === 0x2029) {
      output += `\\u${code.toString(16).padStart(4, '0')}`;
    } else output += character;
  }
  return `${output}'`;
}

export function variableName(prefix, immutableId) {
  return `${prefix}_${sha256(immutableId).slice(0, 12)}`;
}

export function formatNumber(value) {
  sourceRendererInvariant(typeof value === 'number' && Number.isFinite(value),
    'K6_API_SOURCE_NON_FINITE_NUMBER', 'Source-bound number must be finite');
  if (Object.is(value, -0)) return '0';
  return Number(value.toPrecision(15)).toString();
}

export function capabilityKey(value) {
  return `${value.capabilityId}@${value.version}`;
}

export function sha256Utf8(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function countLines(source) {
  return (source.match(/\n/g) ?? []).length;
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}
