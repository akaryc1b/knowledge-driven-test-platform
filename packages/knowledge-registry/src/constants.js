export const KNOWLEDGE_RULE_SCHEMA_VERSION = 'knowledge-rule/v1';
export const REGISTRY_RECORD_SCHEMA_VERSION = 'knowledge-registry-record/v1';

export const KNOWLEDGE_STATUSES = Object.freeze([
  'DRAFT',
  'REVIEWING',
  'PUBLISHED',
  'DEPRECATED',
  'ARCHIVED',
]);

export const SCOPE_LEVELS = Object.freeze([
  'GLOBAL',
  'DOMAIN',
  'PROJECT',
  'ENVIRONMENT',
  'RELEASE',
]);

export const ENFORCEMENT_LEVELS = Object.freeze(['optional', 'default', 'mandatory']);
export const OVERRIDE_POLICIES = Object.freeze(['allow', 'strengthen', 'deny']);
export const MERGE_STRATEGIES = Object.freeze(['replace', 'deep-merge']);
export const RISK_LEVELS = Object.freeze(['low', 'medium', 'high', 'critical']);

export const LIFECYCLE_TRANSITIONS = Object.freeze({
  DRAFT: Object.freeze(['REVIEWING']),
  REVIEWING: Object.freeze(['DRAFT', 'PUBLISHED']),
  PUBLISHED: Object.freeze(['DEPRECATED']),
  DEPRECATED: Object.freeze(['ARCHIVED']),
  ARCHIVED: Object.freeze([]),
});
