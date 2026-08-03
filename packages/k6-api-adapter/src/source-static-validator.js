import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  K6_API_HTTP_METHODS,
  K6_API_SOURCE_ALLOWED_MODULES,
  K6_API_SOURCE_RESULT_SCHEMA_VERSION,
  K6_API_SOURCE_STATIC_VALIDATOR_ID,
  K6_API_SOURCE_STATIC_VALIDATOR_VERSION,
} from './constants.js';
import { sourceValidationInvariant } from './errors.js';
import {
  ABSOLUTE_FILE_PATH,
  CREDENTIAL_URI,
  DIGEST,
  SECRET_TEXT,
  SOURCE_RESULT_FIELDS,
  SOURCE_RESULT_SAFETY_BOUNDARY,
  VOLATILE_TEXT,
  validationCountLines,
  validationDeepFreeze,
  validationExactFields,
  validationSha256Utf8,
} from './source-validation-shared.js';

const SOURCE_IDENTITY_FIELDS = Object.freeze([
  'generatorId', 'generatorVersion', 'generatorConfigurationDigest',
  'specDigest', 'bundleDigest', 'compilationEvidenceDigest',
  'sourceFormatVersion', 'canonicalRenderingPolicyDigest',
  'allowedModulesDigest', 'identityDigest',
]);

const EXPECTED_HELPERS = Object.freeze([
  'deepEqual', 'k6ApiGeneratedSource', 'parseJson', 'readJsonPath',
]);

export const K6_API_SOURCE_STATIC_CHECK_IDS = Object.freeze([
  'result-contract-integrity',
  'source-identity-integrity',
  'raw-utf8-source-integrity',
  'fixed-module-imports',
  'fixed-top-level-structure',
  'operation-count-integrity',
  'assertion-count-integrity',
  'threshold-count-integrity',
  'path-only-http-targets',
  'forbidden-execution-primitives',
  'forbidden-sensitive-material',
  'non-execution-safety-boundary',
]);

const FORBIDDEN_PATTERNS = Object.freeze([
  ['K6_API_SOURCE_DYNAMIC_IMPORT_FORBIDDEN', /\bimport\s*\(/],
  ['K6_API_SOURCE_REQUIRE_FORBIDDEN', /\brequire\s*\(/],
  ['K6_API_SOURCE_EVAL_FORBIDDEN', /\beval\s*\(/],
  ['K6_API_SOURCE_FUNCTION_CONSTRUCTOR_FORBIDDEN', /\b(?:new\s+)?Function\s*\(/],
  ['K6_API_SOURCE_WEBASSEMBLY_FORBIDDEN', /\bWebAssembly\b/],
  ['K6_API_SOURCE_NODE_API_FORBIDDEN', /\bnode:|\bchild_process\b|\bprocess\b/],
  ['K6_API_SOURCE_EXTERNAL_RUNTIME_FORBIDDEN', /\bDeno\b|\bBun\b/],
  ['K6_API_SOURCE_FETCH_FORBIDDEN', /\bfetch\s*\(/],
  ['K6_API_SOURCE_FILE_READ_FORBIDDEN', /\bopen\s*\(/],
  ['K6_API_SOURCE_ENVIRONMENT_ACCESS_FORBIDDEN', /\b__ENV\b/],
  ['K6_API_SOURCE_TEMPLATE_LITERAL_FORBIDDEN', /`|\$\{/],
  ['K6_API_SOURCE_ASYNC_FORBIDDEN', /\basync\b|\bawait\b/],
  ['K6_API_SOURCE_GENERATOR_FORBIDDEN', /\bfunction\s*\*/],
  ['K6_API_SOURCE_CLASS_FORBIDDEN', /\bclass\s+[A-Za-z_$]/],
  ['K6_API_SOURCE_PROMISE_FORBIDDEN', /\bPromise\b/],
  ['K6_API_SOURCE_TIMER_FORBIDDEN', /\bsetTimeout\b|\bsetInterval\b/],
  ['K6_API_SOURCE_BROWSER_FORBIDDEN', /\bbrowser\b|\bWebSocket\b|\bgrpc\b/],
]);

export function validateK6ApiSourceStatically(result) {
  validateResultIntegrity(result);
  validateSourceText(result.source, result);
  const reportWithoutDigest = {
    validatorId: K6_API_SOURCE_STATIC_VALIDATOR_ID,
    validatorVersion: K6_API_SOURCE_STATIC_VALIDATOR_VERSION,
    sourceIdentity: result.sourceIdentity.identityDigest,
    sourceDigest: result.sourceDigest,
    sourceByteLength: result.sourceByteLength,
    sourceLineCount: result.sourceLineCount,
    moduleImports: [...result.moduleImports],
    operationCount: result.operationCount,
    assertionCount: result.assertionCount,
    thresholdCount: result.thresholdCount,
    checks: K6_API_SOURCE_STATIC_CHECK_IDS.map((checkId) => ({ checkId, status: 'PASS' })),
  };
  return validationDeepFreeze({
    ...reportWithoutDigest,
    reportDigest: sha256(reportWithoutDigest),
  });
}

export function computeK6ApiSourceStaticValidationReportDigest(report) {
  validationExactFields(report, [
    'validatorId', 'validatorVersion', 'sourceIdentity', 'sourceDigest',
    'sourceByteLength', 'sourceLineCount', 'moduleImports', 'operationCount',
    'assertionCount', 'thresholdCount', 'checks', 'reportDigest',
  ], 'INVALID_K6_API_SOURCE_STATIC_VALIDATION_REPORT', 'Static validation report');
  const { reportDigest: _reportDigest, ...withoutDigest } = report;
  return sha256(withoutDigest);
}

function validateResultIntegrity(result) {
  validationExactFields(result, SOURCE_RESULT_FIELDS, 'INVALID_K6_API_SOURCE_RESULT', 'Source Result');
  sourceValidationInvariant(result.schemaVersion === K6_API_SOURCE_RESULT_SCHEMA_VERSION,
    'K6_API_SOURCE_RESULT_SCHEMA_MISMATCH', 'Source Result schema version is not accepted');
  validationExactFields(result.sourceIdentity, SOURCE_IDENTITY_FIELDS,
    'INVALID_K6_API_SOURCE_IDENTITY', 'Source identity');
  const { identityDigest, ...identityWithoutDigest } = result.sourceIdentity;
  sourceValidationInvariant(DIGEST.test(identityDigest)
      && sha256(identityWithoutDigest) === identityDigest,
  'K6_API_SOURCE_IDENTITY_DIGEST_MISMATCH', 'Source identity digest is invalid');

  for (const [label, digest] of Object.entries({
    generationRequestDigest: result.generationRequestDigest,
    renderingPolicyDigest: result.renderingPolicyDigest,
    generatorDescriptorDigest: result.generatorDescriptorDigest,
    specDigest: result.specDigest,
    bundleDigest: result.bundleDigest,
    compilationEvidenceDigest: result.compilationEvidenceDigest,
    sourceDigest: result.sourceDigest,
    resultDigest: result.resultDigest,
  })) sourceValidationInvariant(typeof digest === 'string' && DIGEST.test(digest),
    'K6_API_SOURCE_INVALID_DIGEST', 'Source Result contains an invalid digest', { label });

  sourceValidationInvariant(result.sourceIdentity.specDigest === result.specDigest
      && result.sourceIdentity.bundleDigest === result.bundleDigest
      && result.sourceIdentity.compilationEvidenceDigest === result.compilationEvidenceDigest
      && result.sourceIdentity.canonicalRenderingPolicyDigest === result.renderingPolicyDigest,
  'K6_API_SOURCE_RESULT_BINDING_MISMATCH',
  'Source Result does not preserve its immutable identity bindings');
  sourceValidationInvariant(canonicalStringify(result.moduleImports)
      === canonicalStringify(K6_API_SOURCE_ALLOWED_MODULES)
      && result.sourceIdentity.allowedModulesDigest === sha256(result.moduleImports),
  'K6_API_SOURCE_IMPORT_ALLOW_LIST_VIOLATION',
  'Source Result module imports do not match the fixed allow-list');

  const { resultDigest, ...resultWithoutDigest } = result;
  sourceValidationInvariant(sha256(resultWithoutDigest) === resultDigest,
    'K6_API_SOURCE_RESULT_DIGEST_MISMATCH', 'Source Result digest is invalid');
  sourceValidationInvariant(typeof result.source === 'string' && result.source.length > 0,
    'INVALID_K6_API_RENDERED_SOURCE', 'Rendered source must be a non-empty string');
  sourceValidationInvariant(validationSha256Utf8(result.source) === result.sourceDigest
      && Buffer.byteLength(result.source, 'utf8') === result.sourceByteLength
      && validationCountLines(result.source) === result.sourceLineCount,
  'K6_API_SOURCE_RAW_BYTES_MISMATCH', 'Source bytes, digest, size or line count changed');
  for (const [label, count] of Object.entries({
    operationCount: result.operationCount,
    assertionCount: result.assertionCount,
    thresholdCount: result.thresholdCount,
  })) sourceValidationInvariant(Number.isSafeInteger(count) && count >= 0,
    'K6_API_SOURCE_INVALID_COUNT', 'Source Result contains an invalid count', { label });
  sourceValidationInvariant(canonicalStringify(result.safetyBoundary)
      === canonicalStringify(SOURCE_RESULT_SAFETY_BOUNDARY),
  'K6_API_SOURCE_SAFETY_BOUNDARY_CHANGED', 'Source Result safety boundary changed');
}

function validateSourceText(source, result) {
  sourceValidationInvariant(!source.startsWith('\uFEFF') && !source.includes('\r')
      && source.endsWith('\n') && !source.endsWith('\n\n'),
  'K6_API_SOURCE_ENCODING_POLICY_VIOLATION',
  'Source must be UTF-8 LF without BOM and contain one trailing newline');
  const lines = source.split('\n');
  sourceValidationInvariant(lines[0] === "import { check, group } from 'k6';"
      && lines[1] === "import http from 'k6/http';"
      && lines[2] === '',
  'K6_API_SOURCE_IMPORT_ALLOW_LIST_VIOLATION',
  'Source imports do not match the fixed canonical declarations');
  const importLines = source.match(/^import\b[^\n]*;$/gm) ?? [];
  sourceValidationInvariant(importLines.length === 2,
    'K6_API_SOURCE_IMPORT_ALLOW_LIST_VIOLATION', 'Source contains additional imports');

  const functions = [...source.matchAll(/^(?:export default )?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)]
    .map((match) => match[1]).sort();
  sourceValidationInvariant(canonicalStringify(functions)
      === canonicalStringify(EXPECTED_HELPERS),
  'K6_API_SOURCE_TOP_LEVEL_STRUCTURE_CHANGED',
  'Source top-level function declarations changed');
  sourceValidationInvariant((source.match(/^export const options = Object\.freeze\(\{$/gm) ?? []).length === 1
      && (source.match(/^export default function k6ApiGeneratedSource\(\) \{$/gm) ?? []).length === 1,
  'K6_API_SOURCE_TOP_LEVEL_STRUCTURE_CHANGED', 'Source export structure changed');

  const operations = [...source.matchAll(/\bhttp\.request\(\n\s+'([A-Z]+)',\n\s+'([^']+)'/g)];
  sourceValidationInvariant(operations.length === result.operationCount,
    'K6_API_SOURCE_OPERATION_COUNT_MISMATCH', 'Source operation count changed');
  for (const [, method, target] of operations) {
    sourceValidationInvariant(K6_API_HTTP_METHODS.includes(method),
      'K6_API_SOURCE_HTTP_METHOD_FORBIDDEN', 'Source contains an unsupported HTTP method');
    sourceValidationInvariant(target.startsWith('/') && !target.includes('://')
        && !target.includes('\\') && !target.includes('\u0000'),
    'K6_API_SOURCE_NETWORK_TARGET_FORBIDDEN',
    'Source HTTP targets must remain relative path templates');
  }
  sourceValidationInvariant((source.match(/^\s{6}'(?:status-code-in|json-path-exists|json-path-equals):/gm)
      ?? []).length === result.assertionCount,
  'K6_API_SOURCE_ASSERTION_COUNT_MISMATCH', 'Source assertion count changed');
  sourceValidationInvariant((source.match(/^\s{4}'(?:checks|http_req_duration)\{operation_id:[^}]+\}':/gm)
      ?? []).length === result.thresholdCount,
  'K6_API_SOURCE_THRESHOLD_COUNT_MISMATCH', 'Source threshold count changed');
  sourceValidationInvariant((source.match(/^\s*\/\//gm) ?? []).length === 0
      && !source.includes('/*'),
  'K6_API_SOURCE_COMMENT_FORBIDDEN', 'Source comments are not part of the canonical contract');

  for (const [code, pattern] of FORBIDDEN_PATTERNS) sourceValidationInvariant(!pattern.test(source),
    code, 'Source violates the independent non-execution static policy');
  for (const [code, pattern] of [
    ['K6_API_SOURCE_NETWORK_TARGET_FORBIDDEN', /\bhttps?:\/\//i],
    ['K6_API_SOURCE_CREDENTIAL_URI_FORBIDDEN', CREDENTIAL_URI],
    ['K6_API_SOURCE_FILE_PATH_FORBIDDEN', ABSOLUTE_FILE_PATH],
    ['K6_API_SOURCE_SECRET_MATERIAL_FORBIDDEN', SECRET_TEXT],
    ['K6_API_SOURCE_VOLATILE_METADATA_FORBIDDEN', VOLATILE_TEXT],
  ]) sourceValidationInvariant(!pattern.test(source), code,
    'Source contains forbidden target, sensitive or volatile material');
}
