export const SCOPE_LEVELS = Object.freeze([
  'GLOBAL',
  'DOMAIN',
  'PROJECT',
  'ENVIRONMENT',
  'RELEASE',
]);

export const SCOPE_PRECEDENCE = Object.freeze(
  Object.fromEntries(SCOPE_LEVELS.map((level, index) => [level, index * 10])),
);

export const ENFORCEMENT_LEVELS = Object.freeze(['optional', 'default', 'mandatory']);
export const OVERRIDE_POLICIES = Object.freeze(['allow', 'strengthen', 'deny']);
export const MERGE_STRATEGIES = Object.freeze(['replace', 'deep-merge']);
export const KNOWLEDGE_STATUSES = Object.freeze(['PUBLISHED']);

export const ENFORCEMENT_STRENGTH = Object.freeze({
  optional: 0,
  default: 10,
  mandatory: 20,
});

export const POLICY_STRENGTH = Object.freeze({
  allow: 0,
  strengthen: 10,
  deny: 20,
});
