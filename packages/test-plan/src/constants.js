export const TEST_PLANNING_REQUEST_SCHEMA_VERSION = 'test-planning-request/v1';
export const TEST_TARGET_INVENTORY_SCHEMA_VERSION = 'test-target-inventory/v1';
export const TEST_INTENT_SCHEMA_VERSION = 'test-intent/v1';
export const TEST_COVERAGE_OBLIGATION_SCHEMA_VERSION = 'test-coverage-obligation/v1';
export const TEST_PLAN_SCHEMA_VERSION = 'test-plan/v1';

export const TEST_PLAN_STATUSES = Object.freeze([
  'DRAFT',
  'REVIEWING',
  'APPROVED',
  'FROZEN',
  'SUPERSEDED',
  'ARCHIVED',
]);

export const COVERAGE_STATUSES = Object.freeze([
  'COVERED',
  'PARTIAL',
  'UNPLANNED',
  'EXEMPT',
]);
