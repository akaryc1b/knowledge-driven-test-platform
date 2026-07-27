import {
  ENFORCEMENT_LEVELS,
  KNOWLEDGE_STATUSES,
  MERGE_STRATEGIES,
  OVERRIDE_POLICIES,
  SCOPE_LEVELS,
} from './constants.js';
import { canonicalize } from './canonical-json.js';
import { invariant } from './errors.js';

/**
 * @typedef {object} KnowledgeContext
 * @property {string} globalId
 * @property {string} projectId
 * @property {string} environmentId
 * @property {string} releaseId
 * @property {string[]} domainPacks
 */

/**
 * @param {unknown} input
 * @returns {KnowledgeContext}
 */
export function validateContext(input) {
  invariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_CONTEXT', 'Knowledge context must be an object');

  const context = /** @type {Record<string, unknown>} */ (input);
  for (const field of ['globalId', 'projectId', 'environmentId', 'releaseId']) {
    invariant(typeof context[field] === 'string' && context[field].trim().length > 0,
      'INVALID_CONTEXT_FIELD', `Context field ${field} must be a non-empty string`, { field });
  }

  invariant(Array.isArray(context.domainPacks),
    'INVALID_DOMAIN_PACKS', 'Context domainPacks must be an array');
  invariant(context.domainPacks.every((item) => typeof item === 'string' && item.length > 0),
    'INVALID_DOMAIN_PACKS', 'Every domain pack ID must be a non-empty string');

  const domainPacks = [...new Set(context.domainPacks)].sort();
  invariant(domainPacks.length === context.domainPacks.length,
    'DUPLICATE_DOMAIN_PACK', 'Context contains duplicate domain pack IDs');

  return {
    globalId: context.globalId,
    projectId: context.projectId,
    environmentId: context.environmentId,
    releaseId: context.releaseId,
    domainPacks,
  };
}

/**
 * @param {unknown} input
 * @param {KnowledgeContext} context
 * @returns {Record<string, unknown>}
 */
export function validateRule(input, context) {
  invariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_RULE', 'Knowledge rule must be an object');
  const rule = /** @type {Record<string, unknown>} */ (input);

  for (const field of ['id', 'boundaryKey', 'name', 'version']) {
    invariant(typeof rule[field] === 'string' && rule[field].trim().length > 0,
      'INVALID_RULE_FIELD', `Rule field ${field} must be a non-empty string`, {
        field,
        ruleId: rule.id,
      });
  }

  invariant(KNOWLEDGE_STATUSES.includes(rule.status),
    'RULE_NOT_PUBLISHED', `Rule ${rule.id} is not PUBLISHED`, { ruleId: rule.id });
  invariant(ENFORCEMENT_LEVELS.includes(rule.enforcement),
    'INVALID_ENFORCEMENT', `Rule ${rule.id} has invalid enforcement`, { ruleId: rule.id });
  invariant(OVERRIDE_POLICIES.includes(rule.overridePolicy),
    'INVALID_OVERRIDE_POLICY', `Rule ${rule.id} has invalid overridePolicy`, { ruleId: rule.id });
  invariant(typeof rule.enabled === 'boolean',
    'INVALID_ENABLED', `Rule ${rule.id} enabled must be boolean`, { ruleId: rule.id });

  const mergeStrategy = rule.mergeStrategy ?? 'replace';
  invariant(MERGE_STRATEGIES.includes(mergeStrategy),
    'INVALID_MERGE_STRATEGY', `Rule ${rule.id} has invalid mergeStrategy`, { ruleId: rule.id });

  invariant(rule.scope && typeof rule.scope === 'object' && !Array.isArray(rule.scope),
    'INVALID_SCOPE', `Rule ${rule.id} scope must be an object`, { ruleId: rule.id });
  const scope = /** @type {Record<string, unknown>} */ (rule.scope);
  invariant(SCOPE_LEVELS.includes(scope.level),
    'INVALID_SCOPE_LEVEL', `Rule ${rule.id} has invalid scope level`, { ruleId: rule.id });
  invariant(typeof scope.key === 'string' && scope.key.length > 0,
    'INVALID_SCOPE_KEY', `Rule ${rule.id} scope key must be non-empty`, { ruleId: rule.id });

  validateScopeBinding(rule.id, scope.level, scope.key, context);
  canonicalize(rule.value, `rule(${rule.id}).value`);

  return {
    ...structuredClone(rule),
    mergeStrategy,
    scope: { level: scope.level, key: scope.key },
  };
}

/**
 * @param {unknown} ruleId
 * @param {unknown} level
 * @param {unknown} key
 * @param {KnowledgeContext} context
 */
function validateScopeBinding(ruleId, level, key, context) {
  const expected = {
    GLOBAL: context.globalId,
    PROJECT: context.projectId,
    ENVIRONMENT: context.environmentId,
    RELEASE: context.releaseId,
  };

  if (level === 'DOMAIN') {
    invariant(context.domainPacks.includes(key),
      'DOMAIN_SCOPE_MISMATCH', `Rule ${ruleId} references an unbound domain pack`, {
        ruleId,
        scopeKey: key,
      });
    return;
  }

  invariant(expected[level] === key,
    'SCOPE_MISMATCH', `Rule ${ruleId} scope does not match execution context`, {
      ruleId,
      level,
      actual: key,
      expected: expected[level],
    });
}
