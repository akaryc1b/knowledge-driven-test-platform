import { sha256 } from '@kdtp/knowledge-core';
import { executionInvariant } from './errors.js';

const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,255}$/;
const KIND_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const STRICT_SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const ADAPTER_ID_PATTERN = /^adapter-[a-z0-9-]+-[a-f0-9]{12}$/;
const REQUEST_ID_PATTERN = /^exec-[a-z0-9-]+-[a-f0-9]{16}$/;
const RESULT_ID_PATTERN = /^result-[a-f0-9]{16}$/;
const EVIDENCE_ID_PATTERN = /^evidence-[a-f0-9]{16}$/;
const FAILURE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;
const MEDIA_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:;[A-Za-z0-9=._ -]+)?$/;

export function validateProjectId(input) {
  executionInvariant(typeof input === 'string' && PROJECT_ID_PATTERN.test(input),
    'INVALID_EXECUTION_PROJECT_ID', 'projectId must be a lowercase project identifier', {
      projectId: input,
    });
  return input;
}

export function validateIdentifier(input, field) {
  executionInvariant(typeof input === 'string' && IDENTIFIER_PATTERN.test(input),
    'INVALID_EXECUTION_IDENTITY', `${field} is not a valid stable identifier`, {
      field,
      value: input,
    });
  return input;
}

export function validateKind(input, field) {
  executionInvariant(typeof input === 'string' && KIND_PATTERN.test(input),
    'INVALID_EXECUTION_KIND', `${field} must be a lowercase kind identifier`, {
      field,
      value: input,
    });
  return input;
}

export function validateSemver(input, field) {
  executionInvariant(typeof input === 'string' && STRICT_SEMVER_PATTERN.test(input),
    'INVALID_EXECUTION_VERSION', `${field} must use strict MAJOR.MINOR.PATCH SemVer`, {
      field,
      value: input,
    });
  return input;
}

export function validateDigest(input, field) {
  executionInvariant(typeof input === 'string' && DIGEST_PATTERN.test(input),
    'INVALID_EXECUTION_DIGEST', `${field} must be a lowercase SHA-256 digest`, {
      field,
      value: input,
    });
  return input;
}

export function validateUtcTimestamp(input, field) {
  executionInvariant(typeof input === 'string',
    'INVALID_EXECUTION_TIMESTAMP', `${field} must be a canonical UTC timestamp`, { field });
  const time = Date.parse(input);
  executionInvariant(Number.isFinite(time) && new Date(time).toISOString() === input,
    'INVALID_EXECUTION_TIMESTAMP', `${field} must be a canonical UTC timestamp`, {
      field,
      value: input,
    });
  return input;
}

export function validateNonEmptyString(input, field, maxLength = 512) {
  executionInvariant(typeof input === 'string' && input.trim().length > 0
      && input.length <= maxLength,
  'INVALID_EXECUTION_FIELD', `${field} must be a non-empty string of at most ${maxLength} characters`, {
    field,
  });
  return input;
}

export function validateFailureCode(input) {
  executionInvariant(typeof input === 'string' && FAILURE_CODE_PATTERN.test(input),
    'INVALID_EXECUTION_FAILURE_CODE', 'Execution failure code is invalid', { code: input });
  return input;
}

export function validateMediaType(input) {
  executionInvariant(typeof input === 'string' && MEDIA_TYPE_PATTERN.test(input),
    'INVALID_EXECUTION_MEDIA_TYPE', 'Artifact mediaType is invalid', { mediaType: input });
  return input;
}

export function projectSlug(projectId) {
  return validateProjectId(projectId)
    .replace(/[._]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function deriveAdapterId(payload) {
  return `adapter-${String(payload.adapterType).replace(/[^a-z0-9]+/g, '-')}-${sha256(payload).slice(0, 12)}`;
}

export function validateAdapterId(input) {
  executionInvariant(typeof input === 'string' && ADAPTER_ID_PATTERN.test(input),
    'INVALID_EXECUTION_ADAPTER_ID', 'Execution adapter ID is invalid', { adapterId: input });
  return input;
}

export function deriveExecutionRequestId(projectId, payload) {
  return `exec-${projectSlug(projectId)}-${sha256(payload).slice(0, 16)}`;
}

export function validateExecutionRequestId(input) {
  executionInvariant(typeof input === 'string' && REQUEST_ID_PATTERN.test(input),
    'INVALID_EXECUTION_REQUEST_ID', 'Execution request ID is invalid', { requestId: input });
  return input;
}

export function deriveExecutionResultId(payload) {
  return `result-${sha256(payload).slice(0, 16)}`;
}

export function validateExecutionResultId(input) {
  executionInvariant(typeof input === 'string' && RESULT_ID_PATTERN.test(input),
    'INVALID_EXECUTION_RESULT_ID', 'Execution result ID is invalid', { resultId: input });
  return input;
}

export function deriveExecutionEvidenceId(payload) {
  return `evidence-${sha256(payload).slice(0, 16)}`;
}

export function validateExecutionEvidenceId(input) {
  executionInvariant(typeof input === 'string' && EVIDENCE_ID_PATTERN.test(input),
    'INVALID_EXECUTION_EVIDENCE_ID', 'Execution evidence ID is invalid', { evidenceId: input });
  return input;
}
