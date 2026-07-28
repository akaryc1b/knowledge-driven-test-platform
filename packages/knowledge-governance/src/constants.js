export const GOVERNANCE_ACTIONS = Object.freeze([
  'KNOWLEDGE_CREATE',
  'KNOWLEDGE_EDIT',
  'KNOWLEDGE_SUBMIT',
  'KNOWLEDGE_REVIEW',
  'KNOWLEDGE_PUBLISH',
  'KNOWLEDGE_DEPRECATE',
  'KNOWLEDGE_ARCHIVE',
  'KNOWLEDGE_READ',
  'AUDIT_READ',
  'SNAPSHOT_PERSIST',
  'SNAPSHOT_READ',
  'PLAN_CREATE',
  'PLAN_GENERATE',
  'PLAN_EDIT',
  'PLAN_SUBMIT',
  'PLAN_REVIEW',
  'PLAN_APPROVE',
  'PLAN_FREEZE',
  'PLAN_READ',
  'PLAN_AUDIT_READ',
]);

export const REVIEW_DECISIONS = Object.freeze(['APPROVE', 'REQUEST_CHANGES']);
export const REVIEW_DECISION_SCHEMA_VERSION = 'knowledge-review-decision/v1';
export const SNAPSHOT_ENVELOPE_SCHEMA_VERSION = 'knowledge-snapshot-envelope/v1';

export const DEFAULT_REQUIRED_APPROVALS = Object.freeze({
  low: 1,
  medium: 1,
  high: 1,
  critical: 2,
});
