import { sha256 } from '@kdtp/knowledge-core';
import { QueryError, queryInvariant } from './errors.js';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from './constants.js';

export function queryFingerprint(input) {
  return sha256(input);
}

export function paginate(items, options) {
  queryInvariant(Array.isArray(items), 'INVALID_PAGE_SOURCE', 'Pagination source must be an array');
  const limit = validatePageLimit(options?.limit);
  const fingerprint = String(options?.fingerprint ?? '');
  queryInvariant(/^[a-f0-9]{64}$/.test(fingerprint),
    'INVALID_QUERY_FINGERPRINT', 'Query fingerprint must be a SHA-256 digest');
  queryInvariant(typeof options?.itemKey === 'function',
    'INVALID_PAGE_SOURCE', 'Pagination itemKey must be a function');
  queryInvariant(typeof options?.itemTuple === 'function',
    'INVALID_PAGE_SOURCE', 'Pagination itemTuple must be a function');

  let start = 0;
  if (options?.cursor !== undefined && options.cursor !== null && options.cursor !== '') {
    const cursor = decodeCursor(options.cursor);
    queryInvariant(cursor.fingerprint === fingerprint,
      'CURSOR_QUERY_MISMATCH', 'Cursor does not belong to this query');
    const index = items.findIndex((item) => (
      options.itemKey(item) === cursor.key &&
      JSON.stringify(options.itemTuple(item)) === JSON.stringify(cursor.tuple)
    ));
    queryInvariant(index >= 0,
      'CURSOR_STALE', 'Cursor item no longer exists in the current result set', {
        key: cursor.key,
      });
    start = index + 1;
  }

  const pageItems = items.slice(start, start + limit);
  const hasMore = start + pageItems.length < items.length;
  const last = pageItems.at(-1);
  const nextCursor = hasMore && last
    ? encodeCursor({
      version: 1,
      fingerprint,
      key: options.itemKey(last),
      tuple: options.itemTuple(last),
    })
    : null;

  return {
    items: structuredClone(pageItems),
    page: {
      limit,
      hasMore,
      nextCursor,
    },
  };
}

export function validatePageLimit(input) {
  if (input === undefined || input === null || input === '') return DEFAULT_PAGE_LIMIT;
  const value = typeof input === 'string' && /^[0-9]+$/.test(input) ? Number(input) : input;
  queryInvariant(Number.isSafeInteger(value) && value > 0 && value <= MAX_PAGE_LIMIT,
    'INVALID_PAGE_LIMIT', `Page limit must be between 1 and ${MAX_PAGE_LIMIT}`, {
      limit: input,
    });
  return value;
}

export function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(input) {
  queryInvariant(typeof input === 'string' && input.length > 0 && input.length <= 2048,
    'INVALID_CURSOR', 'Cursor must be a non-empty string');
  let value;
  try {
    value = JSON.parse(Buffer.from(input, 'base64url').toString('utf8'));
  } catch {
    throw new QueryError('INVALID_CURSOR', 'Cursor cannot be decoded');
  }
  queryInvariant(value && typeof value === 'object' && !Array.isArray(value),
    'INVALID_CURSOR', 'Cursor payload must be an object');
  queryInvariant(value.version === 1,
    'INVALID_CURSOR', 'Cursor version is unsupported');
  queryInvariant(typeof value.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(value.fingerprint),
    'INVALID_CURSOR', 'Cursor fingerprint is invalid');
  queryInvariant(typeof value.key === 'string' && value.key.length > 0,
    'INVALID_CURSOR', 'Cursor key is invalid');
  queryInvariant(Array.isArray(value.tuple),
    'INVALID_CURSOR', 'Cursor tuple is invalid');
  return value;
}
