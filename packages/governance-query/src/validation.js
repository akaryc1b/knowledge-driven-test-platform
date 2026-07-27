import {
  KNOWLEDGE_SORT_FIELDS,
  SNAPSHOT_SORT_FIELDS,
  SORT_DIRECTIONS,
} from './constants.js';
import { queryInvariant } from './errors.js';
import { validatePageLimit } from './cursor.js';

const TEXT_PATTERN = /^[\p{L}\p{N} ._:@/-]{1,128}$/u;
const STATUS_VALUES = Object.freeze(['DRAFT', 'REVIEWING', 'PUBLISHED', 'DEPRECATED', 'ARCHIVED']);
const RISK_VALUES = Object.freeze(['low', 'medium', 'high', 'critical']);

export function normalizeKnowledgeListQuery(input = {}) {
  queryInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_QUERY', 'Knowledge list query must be an object');
  const filter = {};
  if (input.status !== undefined) {
    queryInvariant(STATUS_VALUES.includes(input.status),
      'INVALID_QUERY_FILTER', 'Knowledge status filter is invalid', { status: input.status });
    filter.status = input.status;
  }
  if (input.riskLevel !== undefined) {
    queryInvariant(RISK_VALUES.includes(input.riskLevel),
      'INVALID_QUERY_FILTER', 'Knowledge riskLevel filter is invalid', {
        riskLevel: input.riskLevel,
      });
    filter.riskLevel = input.riskLevel;
  }
  for (const field of ['id', 'boundaryKey', 'owner']) {
    if (input[field] !== undefined) {
      queryInvariant(typeof input[field] === 'string' && TEXT_PATTERN.test(input[field]),
        'INVALID_QUERY_FILTER', `Knowledge ${field} filter is invalid`, { field });
      filter[field] = input[field];
    }
  }
  if (input.enabled !== undefined) {
    const enabled = input.enabled === true || input.enabled === 'true'
      ? true
      : input.enabled === false || input.enabled === 'false'
        ? false
        : null;
    queryInvariant(enabled !== null,
      'INVALID_QUERY_FILTER', 'Knowledge enabled filter must be boolean');
    filter.enabled = enabled;
  }
  if (input.search !== undefined) {
    queryInvariant(typeof input.search === 'string' && TEXT_PATTERN.test(input.search),
      'INVALID_QUERY_FILTER', 'Knowledge search text is invalid');
    filter.search = input.search.toLocaleLowerCase();
  }
  const sortBy = normalizeSort(input.sortBy, KNOWLEDGE_SORT_FIELDS, 'updatedAt');
  const direction = normalizeDirection(input.direction, 'desc');
  return {
    filter,
    sortBy,
    direction,
    limit: validatePageLimit(input.limit),
    cursor: normalizeCursor(input.cursor),
  };
}

export function normalizeSnapshotListQuery(input = {}) {
  queryInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_QUERY', 'Snapshot list query must be an object');
  const filter = {};
  for (const field of ['environmentId', 'releaseId', 'createdBy']) {
    if (input[field] !== undefined) {
      queryInvariant(typeof input[field] === 'string' && TEXT_PATTERN.test(input[field]),
        'INVALID_QUERY_FILTER', `Snapshot ${field} filter is invalid`, { field });
      filter[field] = input[field];
    }
  }
  const sortBy = normalizeSort(input.sortBy, SNAPSHOT_SORT_FIELDS, 'createdAt');
  const direction = normalizeDirection(input.direction, 'desc');
  return {
    filter,
    sortBy,
    direction,
    limit: validatePageLimit(input.limit),
    cursor: normalizeCursor(input.cursor),
  };
}

export function normalizeRequestId(input) {
  if (input === undefined || input === null || input === '') return null;
  queryInvariant(typeof input === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(input),
    'INVALID_REQUEST_ID', 'requestId is invalid');
  return input;
}

function normalizeSort(input, allowed, fallback) {
  if (input === undefined || input === null || input === '') return fallback;
  queryInvariant(allowed.includes(input),
    'INVALID_QUERY_SORT', 'Query sort field is invalid', { sortBy: input });
  return input;
}

function normalizeDirection(input, fallback) {
  if (input === undefined || input === null || input === '') return fallback;
  queryInvariant(SORT_DIRECTIONS.includes(input),
    'INVALID_QUERY_SORT', 'Query sort direction is invalid', { direction: input });
  return input;
}

function normalizeCursor(input) {
  if (input === undefined || input === null || input === '') return null;
  queryInvariant(typeof input === 'string' && input.length <= 2048,
    'INVALID_CURSOR', 'Cursor must be a string');
  return input;
}
