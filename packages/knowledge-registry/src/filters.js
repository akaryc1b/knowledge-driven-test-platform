import { KNOWLEDGE_STATUSES, SCOPE_LEVELS } from './constants.js';
import { registryInvariant } from './errors.js';
import { compareKnowledgeVersions, validateKnowledgeId } from './identity.js';

/** @param {unknown} input */
export function validateRegistryFilter(input = {}) {
  registryInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_REGISTRY_FILTER', 'Registry filter must be an object');
  const filter = /** @type {Record<string, unknown>} */ (input);
  const allowedFields = new Set(['id', 'status', 'scopeLevel', 'scopeKey']);
  const unknownFields = Object.keys(filter).filter((field) => !allowedFields.has(field));
  registryInvariant(unknownFields.length === 0,
    'INVALID_REGISTRY_FILTER', 'Registry filter contains unsupported fields', { unknownFields });

  if (filter.id !== undefined) validateKnowledgeId(filter.id);
  if (filter.status !== undefined) {
    registryInvariant(KNOWLEDGE_STATUSES.includes(filter.status),
      'INVALID_REGISTRY_FILTER', 'Registry status filter is invalid', { status: filter.status });
  }
  if (filter.scopeLevel !== undefined) {
    registryInvariant(SCOPE_LEVELS.includes(filter.scopeLevel),
      'INVALID_REGISTRY_FILTER', 'Registry scopeLevel filter is invalid', {
        scopeLevel: filter.scopeLevel,
      });
  }
  if (filter.scopeKey !== undefined) {
    registryInvariant(typeof filter.scopeKey === 'string' && filter.scopeKey.length > 0,
      'INVALID_REGISTRY_FILTER', 'Registry scopeKey filter must be a non-empty string');
  }

  return { ...filter };
}

/** @param {Record<string, any>} left @param {Record<string, any>} right */
export function compareRegistryRecords(left, right) {
  return (
    left.knowledge.id.localeCompare(right.knowledge.id) ||
    compareKnowledgeVersions(left.knowledge.version, right.knowledge.version)
  );
}
