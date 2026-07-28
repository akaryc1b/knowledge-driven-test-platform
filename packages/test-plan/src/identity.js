import { sha256 } from '@kdtp/knowledge-core';
import { planInvariant } from './errors.js';

const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,255}$/;
const CONTEXT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const KIND_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const STRICT_SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const PLAN_ID_PATTERN = /^tp-[a-z0-9-]+-[a-f0-9]{12}$/;
const INTENT_ID_PATTERN = /^intent-[a-f0-9]{16}$/;
const OBLIGATION_ID_PATTERN = /^co-[a-f0-9]{16}$/;
const PROVENANCE_ID_PATTERN = /^pv-[a-f0-9]{16}$/;
const INVENTORY_ID_PATTERN = /^target-inventory-[a-z0-9-]+-[a-f0-9]{12}$/;
const EXEMPTION_ID_PATTERN = /^exemption-[a-f0-9]{16}$/;

export function validateProjectId(input) {
  planInvariant(typeof input === 'string' && PROJECT_ID_PATTERN.test(input),
    'INVALID_PROJECT_ID', 'projectId must be a lowercase project identifier', { projectId: input });
  return input;
}

export function validateNonEmptyString(input, field, maxLength = 512) {
  planInvariant(typeof input === 'string' && input.trim().length > 0 && input.length <= maxLength,
    'INVALID_PLANNING_FIELD', `${field} must be a non-empty string of at most ${maxLength} characters`, {
      field,
    });
  return input;
}

export function validateContextId(input, field) {
  planInvariant(typeof input === 'string' && CONTEXT_ID_PATTERN.test(input),
    'INVALID_PLANNING_CONTEXT', `${field} is not a valid stable context identifier`, { field, value: input });
  return input;
}

export function validateIdentifier(input, field) {
  planInvariant(typeof input === 'string' && IDENTIFIER_PATTERN.test(input),
    'INVALID_PLANNING_IDENTITY', `${field} is not a valid stable identifier`, { field, value: input });
  return input;
}

export function validateKind(input, field) {
  planInvariant(typeof input === 'string' && KIND_PATTERN.test(input),
    'INVALID_PLANNING_KIND', `${field} must be a lowercase kind identifier`, { field, value: input });
  return input;
}

export function validateSemver(input, field) {
  planInvariant(typeof input === 'string' && STRICT_SEMVER_PATTERN.test(input),
    'INVALID_PLANNING_VERSION', `${field} must use strict MAJOR.MINOR.PATCH SemVer`, {
      field,
      value: input,
    });
  return input;
}

export function validateDigest(input, field) {
  planInvariant(typeof input === 'string' && DIGEST_PATTERN.test(input),
    'INVALID_PLANNING_DIGEST', `${field} must be a lowercase SHA-256 digest`, {
      field,
      value: input,
    });
  return input;
}

export function validateUtcTimestamp(input, field) {
  planInvariant(typeof input === 'string',
    'INVALID_PLANNING_TIMESTAMP', `${field} must be a canonical UTC timestamp`, { field });
  const time = Date.parse(input);
  planInvariant(Number.isFinite(time) && new Date(time).toISOString() === input,
    'INVALID_PLANNING_TIMESTAMP', `${field} must be a canonical UTC timestamp`, {
      field,
      value: input,
    });
  return input;
}

export function projectSlug(projectId) {
  return validateProjectId(projectId)
    .replace(/[._]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function deriveTargetInventoryId(payload) {
  return `target-inventory-${projectSlug(payload.projectId)}-${sha256(payload).slice(0, 12)}`;
}

export function validateTargetInventoryId(input) {
  planInvariant(typeof input === 'string' && INVENTORY_ID_PATTERN.test(input),
    'INVALID_TARGET_INVENTORY_ID', 'Target inventory ID is invalid', { inventoryId: input });
  return input;
}

export function derivePlanId(projectId, inputFingerprint) {
  validateDigest(inputFingerprint, 'inputFingerprint');
  return `tp-${projectSlug(projectId)}-${inputFingerprint.slice(0, 12)}`;
}

export function validatePlanId(input) {
  planInvariant(typeof input === 'string' && PLAN_ID_PATTERN.test(input),
    'INVALID_PLAN_ID', 'Test plan ID is invalid', { planId: input });
  return input;
}

export function deriveIntentId(payload) {
  return `intent-${sha256(payload).slice(0, 16)}`;
}

export function validateIntentId(input) {
  planInvariant(typeof input === 'string' && INTENT_ID_PATTERN.test(input),
    'INVALID_TEST_INTENT_ID', 'Test intent ID is invalid', { intentId: input });
  return input;
}

export function deriveCoverageObligationId(payload) {
  return `co-${sha256(payload).slice(0, 16)}`;
}

export function validateCoverageObligationId(input) {
  planInvariant(typeof input === 'string' && OBLIGATION_ID_PATTERN.test(input),
    'INVALID_COVERAGE_OBLIGATION_ID', 'Coverage obligation ID is invalid', {
      obligationId: input,
    });
  return input;
}

export function deriveProvenanceId(payload) {
  return `pv-${sha256(payload).slice(0, 16)}`;
}

export function validateProvenanceId(input) {
  planInvariant(typeof input === 'string' && PROVENANCE_ID_PATTERN.test(input),
    'INVALID_PROVENANCE_ID', 'Provenance ID is invalid', { provenanceId: input });
  return input;
}

export function deriveExemptionId(payload) {
  return `exemption-${sha256(payload).slice(0, 16)}`;
}

export function validateExemptionId(input) {
  planInvariant(typeof input === 'string' && EXEMPTION_ID_PATTERN.test(input),
    'INVALID_EXEMPTION_ID', 'Exemption ID is invalid', { exemptionId: input });
  return input;
}
