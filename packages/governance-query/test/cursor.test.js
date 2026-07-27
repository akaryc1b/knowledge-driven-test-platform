import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QueryError,
  paginate,
  queryFingerprint,
  validatePageLimit,
} from '../src/index.js';

test('cursor pagination returns a query-bound next cursor', () => {
  const items = [
    { key: 'a', value: 1 },
    { key: 'b', value: 2 },
    { key: 'c', value: 3 },
  ];
  const fingerprint = queryFingerprint({ kind: 'sample', filter: {} });
  const first = paginate(items, {
    limit: 2,
    fingerprint,
    itemKey: (item) => item.key,
    itemTuple: (item) => [item.value, item.key],
  });
  assert.deepEqual(first.items.map((item) => item.key), ['a', 'b']);
  assert.equal(first.page.hasMore, true);
  const second = paginate(items, {
    limit: 2,
    cursor: first.page.nextCursor,
    fingerprint,
    itemKey: (item) => item.key,
    itemTuple: (item) => [item.value, item.key],
  });
  assert.deepEqual(second.items.map((item) => item.key), ['c']);
  assert.equal(second.page.nextCursor, null);
});

test('cursor cannot be reused with a different query', () => {
  const items = [{ key: 'a', value: 1 }, { key: 'b', value: 2 }];
  const first = paginate(items, {
    limit: 1,
    fingerprint: queryFingerprint({ filter: 'one' }),
    itemKey: (item) => item.key,
    itemTuple: (item) => [item.value],
  });
  assert.throws(
    () => paginate(items, {
      limit: 1,
      cursor: first.page.nextCursor,
      fingerprint: queryFingerprint({ filter: 'two' }),
      itemKey: (item) => item.key,
      itemTuple: (item) => [item.value],
    }),
    (error) => error instanceof QueryError && error.code === 'CURSOR_QUERY_MISMATCH',
  );
});

test('cursor becomes stale when its anchor is absent', () => {
  const source = [{ key: 'a', value: 1 }, { key: 'b', value: 2 }];
  const fingerprint = queryFingerprint({ kind: 'stale' });
  const first = paginate(source, {
    limit: 1,
    fingerprint,
    itemKey: (item) => item.key,
    itemTuple: (item) => [item.value],
  });
  assert.throws(
    () => paginate(source.slice(1), {
      limit: 1,
      cursor: first.page.nextCursor,
      fingerprint,
      itemKey: (item) => item.key,
      itemTuple: (item) => [item.value],
    }),
    (error) => error instanceof QueryError && error.code === 'CURSOR_STALE',
  );
});

test('page limit rejects unsafe values', () => {
  assert.equal(validatePageLimit(undefined), 25);
  assert.equal(validatePageLimit('100'), 100);
  assert.throws(
    () => validatePageLimit(101),
    (error) => error instanceof QueryError && error.code === 'INVALID_PAGE_LIMIT',
  );
});
