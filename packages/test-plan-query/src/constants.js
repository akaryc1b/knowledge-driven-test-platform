export const PLAN_QUERY_RESPONSE_SCHEMA_VERSION = 'test-plan-query-response/v1';
export const PLAN_QUERY_PAGE_SCHEMA_VERSION = 'test-plan-query-page/v1';

export const PLAN_QUERY_SORT_FIELDS = Object.freeze([
  'createdAt',
  'updatedAt',
  'planId',
  'status',
  'revision',
]);

export const PLAN_QUERY_DIRECTIONS = Object.freeze(['asc', 'desc']);
export const PLAN_QUERY_DEFAULT_SORT = 'createdAt';
export const PLAN_QUERY_DEFAULT_DIRECTION = 'desc';
