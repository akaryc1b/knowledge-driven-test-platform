import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpBoundaryError, matchReadOnlyRoute } from '../src/index.js';

test('router matches all five read-only routes', () => {
  assert.equal(matchReadOnlyRoute('GET', '/v1/projects/p/knowledge').handler, 'listKnowledge');
  assert.equal(matchReadOnlyRoute('GET', '/v1/projects/p/knowledge/PROJECT-X-001/versions/1.0.0').handler, 'getKnowledge');
  assert.equal(matchReadOnlyRoute('GET', '/v1/projects/p/knowledge/PROJECT-X-001/versions/1.0.0/timeline').handler, 'getReviewTimeline');
  assert.equal(matchReadOnlyRoute('GET', '/v1/projects/p/snapshots').handler, 'listSnapshots');
  assert.equal(matchReadOnlyRoute('GET', '/v1/projects/p/snapshots/kb-p-abcdef012345').handler, 'getSnapshot');
});

test('router rejects non-GET methods with Allow header', () => {
  assert.throws(
    () => matchReadOnlyRoute('POST', '/v1/projects/p/knowledge'),
    (error) => error instanceof HttpBoundaryError && error.code === 'METHOD_NOT_ALLOWED' && error.headers.allow === 'GET',
  );
});

test('router rejects unknown and duplicate query parameters', () => {
  assert.throws(
    () => matchReadOnlyRoute('GET', '/v1/projects/p/knowledge?unknown=value'),
    (error) => error.code === 'UNKNOWN_QUERY_PARAMETER',
  );
  assert.throws(
    () => matchReadOnlyRoute('GET', '/v1/projects/p/knowledge?limit=1&limit=2'),
    (error) => error.code === 'DUPLICATE_QUERY_PARAMETER',
  );
});

test('router decodes path parameters and rejects encoded slashes', () => {
  const route = matchReadOnlyRoute('GET', '/v1/projects/approval-platform/knowledge/PROJECT-TEST-001/versions/1.0.0');
  assert.deepEqual(route.params, { id: 'PROJECT-TEST-001', version: '1.0.0' });
  assert.throws(
    () => matchReadOnlyRoute('GET', '/v1/projects/approval%2Fplatform/knowledge'),
    (error) => error.code === 'INVALID_HTTP_PATH',
  );
});
