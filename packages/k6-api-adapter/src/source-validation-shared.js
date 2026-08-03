import { createHash } from 'node:crypto';
import { canonicalStringify } from '@kdtp/knowledge-core';
import { sourceValidationInvariant } from './errors.js';

export const SOURCE_RESULT_FIELDS = Object.freeze([
  'schemaVersion', 'sourceIdentity', 'generationRequestDigest',
  'renderingPolicyDigest', 'generatorDescriptorDigest', 'specDigest',
  'bundleDigest', 'compilationEvidenceDigest', 'sourceDigest',
  'sourceByteLength', 'sourceLineCount', 'moduleImports', 'operationCount',
  'assertionCount', 'thresholdCount', 'safetyBoundary', 'source', 'resultDigest',
]);
export const DIGEST = /^[a-f0-9]{64}$/;
export const CREDENTIAL_URI = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/i;
export const ABSOLUTE_FILE_PATH =
  /(?:^|['"\s])(?:[A-Za-z]:\\|\/(?:tmp|var|etc|home|Users|opt|root)(?:\/|['"\s]))/;
export const VOLATILE_TEXT =
  /(?:\bbranch\b|commit[_ -]?sha|refs\/heads|run[_ -]?id|github\.|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/i;
export const SECRET_TEXT =
  /(?:\bauthorization\b|\bcookie\b|\bbearer\b|\bpassword\b|\bsecret\b|api[_-]?key|credential)/i;
export const SOURCE_RESULT_SAFETY_BOUNDARY = Object.freeze({
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

export function validationExactFields(value, fields, code, label) {
  sourceValidationInvariant(value && typeof value === 'object' && !Array.isArray(value),
    code, `${label} must be an object`);
  const expected = [...fields].sort();
  const actual = Object.keys(value).sort();
  sourceValidationInvariant(canonicalStringify(actual) === canonicalStringify(expected),
    code, `${label} fields are not strictly closed`, { expected, actual });
}

export function validationSha256Utf8(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function validationCountLines(source) {
  return (source.match(/\n/g) ?? []).length;
}

export function validationDeepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) validationDeepFreeze(item);
  return Object.freeze(value);
}
