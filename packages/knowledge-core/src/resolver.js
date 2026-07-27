import {
  ENFORCEMENT_STRENGTH,
  POLICY_STRENGTH,
  SCOPE_PRECEDENCE,
} from './constants.js';
import { jsonEqual } from './canonical-json.js';
import { KnowledgeError, invariant } from './errors.js';
import { deepMerge } from './merge.js';
import { validateContext, validateRule } from './validation.js';

/**
 * Resolve effective project knowledge from five controlled layers.
 *
 * @param {{
 *   context: unknown,
 *   layers: {
 *     global?: unknown[],
 *     domains?: Array<{id: string, rules: unknown[]}>,
 *     project?: unknown[],
 *     environment?: unknown[],
 *     release?: unknown[]
 *   }
 * }} input
 */
export function resolveKnowledge(input) {
  invariant(input && typeof input === 'object',
    'INVALID_RESOLUTION_INPUT', 'Resolution input must be an object');
  const context = validateContext(input.context);
  const layers = input.layers ?? {};
  const candidates = collectCandidates(layers, context);
  assertUniqueRuleIds(candidates);
  assertNoSameLayerConflicts(candidates);

  const byBoundary = new Map();
  for (const candidate of candidates) {
    const list = byBoundary.get(candidate.rule.boundaryKey) ?? [];
    list.push(candidate);
    byBoundary.set(candidate.rule.boundaryKey, list);
  }

  const rules = [];
  const resolution = [];
  for (const boundaryKey of [...byBoundary.keys()].sort()) {
    const ordered = byBoundary.get(boundaryKey).sort(compareCandidates);
    const resolved = resolveBoundary(boundaryKey, ordered);
    rules.push(resolved.rule);
    resolution.push({ boundaryKey, chain: resolved.chain });
  }

  return { context, rules, resolution };
}

/**
 * @param {Record<string, unknown>} layers
 * @param {import('./validation.js').KnowledgeContext} context
 */
function collectCandidates(layers, context) {
  const candidates = [];

  addRules(candidates, layers.global ?? [], 'GLOBAL', context.globalId, context);

  const domains = Array.isArray(layers.domains) ? [...layers.domains] : [];
  domains.sort((left, right) => String(left.id).localeCompare(String(right.id)));
  for (const domain of domains) {
    invariant(domain && typeof domain === 'object' && typeof domain.id === 'string',
      'INVALID_DOMAIN_LAYER', 'Domain layer must include an ID');
    invariant(context.domainPacks.includes(domain.id),
      'UNBOUND_DOMAIN_LAYER', `Domain layer ${domain.id} is not bound by the project`, {
        domainId: domain.id,
      });
    addRules(candidates, domain.rules ?? [], 'DOMAIN', domain.id, context);
  }

  addRules(candidates, layers.project ?? [], 'PROJECT', context.projectId, context);
  addRules(candidates, layers.environment ?? [], 'ENVIRONMENT', context.environmentId, context);
  addRules(candidates, layers.release ?? [], 'RELEASE', context.releaseId, context);
  return candidates;
}

/**
 * @param {Array<Record<string, unknown>>} target
 * @param {unknown} rules
 * @param {string} expectedLevel
 * @param {string} expectedKey
 * @param {import('./validation.js').KnowledgeContext} context
 */
function addRules(target, rules, expectedLevel, expectedKey, context) {
  invariant(Array.isArray(rules),
    'INVALID_LAYER_RULES', `${expectedLevel} rules must be an array`, { expectedLevel });

  for (const input of rules) {
    const rule = validateRule(input, context);
    invariant(rule.scope.level === expectedLevel && rule.scope.key === expectedKey,
      'LAYER_SCOPE_MISMATCH', `Rule ${rule.id} is stored in the wrong layer`, {
        ruleId: rule.id,
        expectedLevel,
        expectedKey,
        actualLevel: rule.scope.level,
        actualKey: rule.scope.key,
      });

    target.push({
      rule,
      precedence: SCOPE_PRECEDENCE[expectedLevel],
      scopeIdentity: `${expectedLevel}:${expectedKey}`,
    });
  }
}

/** @param {Array<Record<string, unknown>>} candidates */
function assertUniqueRuleIds(candidates) {
  const seen = new Set();
  for (const candidate of candidates) {
    invariant(!seen.has(candidate.rule.id),
      'DUPLICATE_RULE_ID', `Duplicate rule ID ${candidate.rule.id}`, { ruleId: candidate.rule.id });
    seen.add(candidate.rule.id);
  }
}

/** @param {Array<Record<string, unknown>>} candidates */
function assertNoSameLayerConflicts(candidates) {
  const seen = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.precedence}:${candidate.rule.boundaryKey}`;
    if (seen.has(key)) {
      const previous = seen.get(key);
      throw new KnowledgeError(
        'SAME_LAYER_CONFLICT',
        `Boundary ${candidate.rule.boundaryKey} has multiple rules at the same precedence`,
        {
          boundaryKey: candidate.rule.boundaryKey,
          firstRuleId: previous.rule.id,
          secondRuleId: candidate.rule.id,
          precedence: candidate.precedence,
        },
      );
    }
    seen.set(key, candidate);
  }
}

function compareCandidates(left, right) {
  return (
    left.precedence - right.precedence ||
    String(left.rule.id).localeCompare(String(right.rule.id))
  );
}

function resolveBoundary(boundaryKey, ordered) {
  let effective = structuredClone(ordered[0].rule);
  const chain = [chainEntry(ordered[0], 'BASE', effective)];

  for (const candidate of ordered.slice(1)) {
    const incoming = candidate.rule;
    const noEffectiveChange = jsonEqual(
      { enabled: effective.enabled, value: effective.value },
      { enabled: incoming.enabled, value: incoming.value },
    );

    if (effective.overridePolicy === 'deny') {
      if (!noEffectiveChange) {
        throw new KnowledgeError('OVERRIDE_DENIED',
          `Boundary ${boundaryKey} is protected by deny policy`, {
            boundaryKey,
            protectedRuleId: effective.id,
            incomingRuleId: incoming.id,
          });
      }
      chain.push(chainEntry(candidate, 'NOOP_PROTECTED', effective));
      continue;
    }

    if (effective.enforcement === 'mandatory' && incoming.enabled === false) {
      throw new KnowledgeError('MANDATORY_RULE_DISABLED',
        `Mandatory boundary ${boundaryKey} cannot be disabled`, {
          boundaryKey,
          protectedRuleId: effective.id,
          incomingRuleId: incoming.id,
        });
    }

    if (effective.overridePolicy === 'strengthen') {
      invariant(incoming.overrideIntent === 'strengthen',
        'STRENGTHEN_INTENT_REQUIRED',
        `Boundary ${boundaryKey} may only be strengthened`, {
          boundaryKey,
          protectedRuleId: effective.id,
          incomingRuleId: incoming.id,
        });
      invariant(incoming.enabled !== false,
        'STRENGTHEN_RULE_DISABLED',
        `Boundary ${boundaryKey} cannot be disabled by a strengthening override`, {
          boundaryKey,
          incomingRuleId: incoming.id,
        });

      effective = applyOverride(effective, incoming, 'deep-merge');
      chain.push(chainEntry(candidate, 'STRENGTHEN', effective));
      continue;
    }

    effective = applyOverride(effective, incoming, incoming.mergeStrategy);
    chain.push(chainEntry(candidate, 'OVERRIDE', effective));
  }

  return { rule: effective, chain };
}

function applyOverride(current, incoming, mergeStrategy) {
  const value = mergeStrategy === 'deep-merge'
    ? deepMerge(current.value, incoming.value)
    : structuredClone(incoming.value);

  const enforcement = ENFORCEMENT_STRENGTH[current.enforcement] >= ENFORCEMENT_STRENGTH[incoming.enforcement]
    ? current.enforcement
    : incoming.enforcement;
  const overridePolicy = POLICY_STRENGTH[current.overridePolicy] >= POLICY_STRENGTH[incoming.overridePolicy]
    ? current.overridePolicy
    : incoming.overridePolicy;

  return {
    ...structuredClone(incoming),
    value,
    enforcement,
    overridePolicy,
  };
}

function chainEntry(candidate, action, effective) {
  return {
    action,
    ruleId: candidate.rule.id,
    version: candidate.rule.version,
    scope: structuredClone(candidate.rule.scope),
    effectiveRuleId: effective.id,
    effectiveEnforcement: effective.enforcement,
    effectiveOverridePolicy: effective.overridePolicy,
  };
}
