import {
  ENFORCEMENT_LEVELS,
  KNOWLEDGE_RULE_SCHEMA_VERSION,
  KNOWLEDGE_STATUSES,
  MERGE_STRATEGIES,
  OVERRIDE_POLICIES,
  RISK_LEVELS,
  SCOPE_LEVELS,
} from './constants.js';
import { registryInvariant } from './errors.js';
import { validateKnowledgeId, parseKnowledgeVersion } from './identity.js';
import { cloneJsonValue } from './json-value.js';

const BOUNDARY_KEY_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9][a-z0-9-]*)+$/;
const SCOPE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const ALLOWED_KNOWLEDGE_FIELDS = new Set([
  'schemaVersion',
  'id',
  'boundaryKey',
  'name',
  'description',
  'version',
  'status',
  'scope',
  'enforcement',
  'overridePolicy',
  'mergeStrategy',
  'overrideIntent',
  'enabled',
  'value',
  'owner',
  'source',
  'riskLevel',
  'tags',
  'references',
]);

/**
 * Validate and normalize a knowledge-rule/v1 object independently from an execution context.
 *
 * @param {unknown} input
 * @returns {Record<string, unknown>}
 */
export function validateKnowledgeObject(input) {
  registryInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_KNOWLEDGE_OBJECT', 'Knowledge object must be an object');
  const knowledge = /** @type {Record<string, unknown>} */ (input);
  const unknownFields = Object.keys(knowledge).filter((field) => !ALLOWED_KNOWLEDGE_FIELDS.has(field));
  registryInvariant(unknownFields.length === 0,
    'UNKNOWN_KNOWLEDGE_FIELD', 'Knowledge object contains unsupported fields', { unknownFields });

  registryInvariant(knowledge.schemaVersion === KNOWLEDGE_RULE_SCHEMA_VERSION,
    'UNSUPPORTED_SCHEMA_VERSION',
    `Knowledge object schemaVersion must be ${KNOWLEDGE_RULE_SCHEMA_VERSION}`,
    { schemaVersion: knowledge.schemaVersion });

  validateKnowledgeId(knowledge.id);
  parseKnowledgeVersion(knowledge.version);

  for (const field of ['boundaryKey', 'name', 'owner', 'source']) {
    registryInvariant(typeof knowledge[field] === 'string' && knowledge[field].trim().length > 0,
      'INVALID_KNOWLEDGE_FIELD', `Knowledge field ${field} must be a non-empty string`, {
        field,
        knowledgeId: knowledge.id,
      });
  }

  registryInvariant(BOUNDARY_KEY_PATTERN.test(knowledge.boundaryKey),
    'INVALID_BOUNDARY_KEY', 'boundaryKey must be a lowercase dotted or dashed key', {
      boundaryKey: knowledge.boundaryKey,
    });
  registryInvariant(KNOWLEDGE_STATUSES.includes(knowledge.status),
    'INVALID_KNOWLEDGE_STATUS', `Knowledge ${knowledge.id} has invalid status`, {
      status: knowledge.status,
    });
  registryInvariant(ENFORCEMENT_LEVELS.includes(knowledge.enforcement),
    'INVALID_ENFORCEMENT', `Knowledge ${knowledge.id} has invalid enforcement`);
  registryInvariant(OVERRIDE_POLICIES.includes(knowledge.overridePolicy),
    'INVALID_OVERRIDE_POLICY', `Knowledge ${knowledge.id} has invalid overridePolicy`);
  registryInvariant(typeof knowledge.enabled === 'boolean',
    'INVALID_ENABLED', `Knowledge ${knowledge.id} enabled must be boolean`);
  registryInvariant(RISK_LEVELS.includes(knowledge.riskLevel),
    'INVALID_RISK_LEVEL', `Knowledge ${knowledge.id} has invalid riskLevel`);

  const mergeStrategy = knowledge.mergeStrategy ?? 'replace';
  registryInvariant(MERGE_STRATEGIES.includes(mergeStrategy),
    'INVALID_MERGE_STRATEGY', `Knowledge ${knowledge.id} has invalid mergeStrategy`);

  registryInvariant(knowledge.scope && typeof knowledge.scope === 'object' && !Array.isArray(knowledge.scope),
    'INVALID_SCOPE', `Knowledge ${knowledge.id} scope must be an object`);
  const scope = /** @type {Record<string, unknown>} */ (knowledge.scope);
  registryInvariant(SCOPE_LEVELS.includes(scope.level),
    'INVALID_SCOPE_LEVEL', `Knowledge ${knowledge.id} has invalid scope level`, {
      scopeLevel: scope.level,
    });
  registryInvariant(typeof scope.key === 'string' && SCOPE_KEY_PATTERN.test(scope.key),
    'INVALID_SCOPE_KEY', `Knowledge ${knowledge.id} has invalid scope key`, {
      scopeKey: scope.key,
    });

  if (knowledge.description !== undefined) {
    registryInvariant(typeof knowledge.description === 'string',
      'INVALID_DESCRIPTION', 'Knowledge description must be a string');
  }
  if (knowledge.overrideIntent !== undefined) {
    registryInvariant(knowledge.overrideIntent === 'strengthen',
      'INVALID_OVERRIDE_INTENT', 'Only strengthen override intent is supported');
  }
  if (knowledge.tags !== undefined) {
    registryInvariant(Array.isArray(knowledge.tags) && knowledge.tags.every(isNonEmptyString),
      'INVALID_TAGS', 'Knowledge tags must be an array of non-empty strings');
    registryInvariant(new Set(knowledge.tags).size === knowledge.tags.length,
      'DUPLICATE_TAG', 'Knowledge tags must be unique');
  }
  if (knowledge.references !== undefined) {
    registryInvariant(Array.isArray(knowledge.references) && knowledge.references.every(isNonEmptyString),
      'INVALID_REFERENCES', 'Knowledge references must be an array of non-empty strings');
    registryInvariant(new Set(knowledge.references).size === knowledge.references.length,
      'DUPLICATE_REFERENCE', 'Knowledge references must be unique');
  }

  return {
    ...cloneJsonValue(knowledge),
    mergeStrategy,
    scope: { level: scope.level, key: scope.key },
  };
}

/** @param {unknown} value */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** @param {unknown} input @param {string} field */
export function validateAuditString(input, field) {
  registryInvariant(typeof input === 'string' && input.trim().length > 0 && input.length <= 512,
    'INVALID_AUDIT_FIELD', `${field} must be a non-empty string of at most 512 characters`, {
      field,
    });
  return input;
}

/** @param {unknown} input */
export function validateUtcTimestamp(input) {
  registryInvariant(typeof input === 'string',
    'INVALID_AUDIT_TIMESTAMP', 'Audit timestamp must be a UTC ISO string');
  const time = Date.parse(input);
  registryInvariant(Number.isFinite(time) && new Date(time).toISOString() === input,
    'INVALID_AUDIT_TIMESTAMP', 'Audit timestamp must use canonical UTC ISO format', {
      at: input,
    });
  return input;
}

/** @param {unknown} input */
export function validateExpectedRevision(input) {
  registryInvariant(Number.isSafeInteger(input) && input > 0,
    'INVALID_EXPECTED_REVISION', 'expectedRevision must be a positive integer', {
      expectedRevision: input,
    });
  return input;
}
