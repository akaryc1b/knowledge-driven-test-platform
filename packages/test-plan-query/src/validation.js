import { PLAN_RECORD_STATUSES } from '@kdtp/test-plan-registry';
import { validateSemver } from '@kdtp/test-plan';
import {
  PLAN_QUERY_DEFAULT_DIRECTION,
  PLAN_QUERY_DEFAULT_SORT,
  PLAN_QUERY_DIRECTIONS,
  PLAN_QUERY_SORT_FIELDS,
} from './constants.js';
import { planQueryInvariant } from './errors.js';

const LIST_QUERY_FIELDS = new Set([
  'status', 'snapshotId', 'catalogVersion', 'environmentId', 'releaseId',
  'sortBy', 'direction', 'limit', 'cursor',
]);
const CONTEXT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;

export function normalizePlanListQuery(input = {}) {
  planQueryInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_PLAN_QUERY', 'Plan list query must be an object');
  assertOnlyFields(input, LIST_QUERY_FIELDS);
  const filter = {};
  if (input.status !== undefined && input.status !== '') {
    planQueryInvariant(PLAN_RECORD_STATUSES.includes(input.status),
      'INVALID_PLAN_QUERY_FILTER', 'Plan status filter is invalid', { status: input.status });
    filter.status = input.status;
  }
  if (input.snapshotId !== undefined && input.snapshotId !== '') {
    planQueryInvariant(/^kb-[a-z0-9-]+-[a-f0-9]{12}$/.test(input.snapshotId),
      'INVALID_PLAN_QUERY_FILTER', 'snapshotId filter is invalid');
    filter.snapshotId = input.snapshotId;
  }
  if (input.catalogVersion !== undefined && input.catalogVersion !== '') {
    filter.catalogVersion = validateSemver(input.catalogVersion, 'catalogVersion');
  }
  if (input.environmentId !== undefined && input.environmentId !== '') {
    filter.environmentId = validateContext(input.environmentId, 'environmentId');
  }
  if (input.releaseId !== undefined && input.releaseId !== '') {
    filter.releaseId = validateContext(input.releaseId, 'releaseId');
  }
  const sortBy = input.sortBy ?? PLAN_QUERY_DEFAULT_SORT;
  const direction = input.direction ?? PLAN_QUERY_DEFAULT_DIRECTION;
  planQueryInvariant(PLAN_QUERY_SORT_FIELDS.includes(sortBy),
    'INVALID_PLAN_QUERY_SORT', 'Plan sort field is invalid', { sortBy });
  planQueryInvariant(PLAN_QUERY_DIRECTIONS.includes(direction),
    'INVALID_PLAN_QUERY_SORT', 'Plan sort direction is invalid', { direction });
  const cursor = input.cursor === undefined || input.cursor === '' ? null : input.cursor;
  if (cursor !== null) {
    planQueryInvariant(typeof cursor === 'string' && cursor.length <= 2048,
      'INVALID_CURSOR', 'Cursor must be a string no longer than 2048 characters');
  }
  return {
    filter,
    sortBy,
    direction,
    limit: input.limit,
    cursor,
  };
}

export function normalizePlanRequestId(input) {
  planQueryInvariant(typeof input === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(input),
    'INVALID_REQUEST_ID', 'Request ID is invalid');
  return input;
}

function validateContext(input, field) {
  planQueryInvariant(typeof input === 'string' && CONTEXT_ID_PATTERN.test(input),
    'INVALID_PLAN_QUERY_FILTER', `${field} filter is invalid`, { field });
  return input;
}

function assertOnlyFields(input, allowed) {
  for (const key of Object.keys(input)) {
    planQueryInvariant(allowed.has(key), 'INVALID_PLAN_QUERY', `Unknown plan query field ${key}`, {
      field: key,
    });
  }
}
