export const TEST_PLAN_RECORD_SCHEMA_VERSION = 'test-plan-record/v1';
export const TEST_PLAN_HISTORY_EVENT_SCHEMA_VERSION = 'test-plan-history-event/v1';
export const TEST_PLAN_REVIEW_DECISION_SCHEMA_VERSION = 'test-plan-review-decision/v1';

export const PLAN_RECORD_STATUSES = Object.freeze([
  'DRAFT',
  'REVIEWING',
  'APPROVED',
  'FROZEN',
  'SUPERSEDED',
  'ARCHIVED',
]);

export const PLAN_HISTORY_EVENT_TYPES = Object.freeze([
  'PLAN_CREATED',
  'PLAN_CONTENT_REPLACED',
  'PLAN_STATUS_TRANSITIONED',
]);

export const PLAN_REVIEW_DECISIONS = Object.freeze([
  'APPROVE',
  'REQUEST_CHANGES',
]);

export const PLAN_LIFECYCLE_TRANSITIONS = Object.freeze({
  DRAFT: Object.freeze(['REVIEWING']),
  REVIEWING: Object.freeze(['DRAFT', 'APPROVED']),
  APPROVED: Object.freeze(['DRAFT', 'FROZEN']),
  FROZEN: Object.freeze(['SUPERSEDED']),
  SUPERSEDED: Object.freeze(['ARCHIVED']),
  ARCHIVED: Object.freeze([]),
});
