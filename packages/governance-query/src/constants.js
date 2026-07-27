export const QUERY_RESPONSE_SCHEMA_VERSION = 'governance-query-response/v1';
export const QUERY_PAGE_SCHEMA_VERSION = 'governance-query-page/v1';

export const KNOWLEDGE_SORT_FIELDS = Object.freeze([
  'updatedAt',
  'createdAt',
  'id',
  'version',
  'name',
  'status',
  'riskLevel',
]);

export const SNAPSHOT_SORT_FIELDS = Object.freeze([
  'createdAt',
  'snapshotId',
  'environmentId',
  'releaseId',
]);

export const SORT_DIRECTIONS = Object.freeze(['asc', 'desc']);
export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;
