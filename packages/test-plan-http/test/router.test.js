import test from 'node:test';
import assert from 'node:assert/strict';
import { matchReadOnlyTestPlanRoute } from '../src/index.js';

const PLAN_ID = 'tp-approval-platform-1234567890ab';

test('router matches all five read-only Test Plan routes', () => {
  const routes = [
    ['/v1/projects/approval-platform/test-plans', 'listPlans'],
    [`/v1/projects/approval-platform/test-plans/${PLAN_ID}`, 'getPlan'],
    [`/v1/projects/approval-platform/test-plans/${PLAN_ID}/coverage`, 'getCoverage'],
    [`/v1/projects/approval-platform/test-plans/${PLAN_ID}/provenance`, 'getProvenance'],
    [`/v1/projects/approval-platform/test-plans/${PLAN_ID}/timeline`, 'getTimeline'],
  ];
  for (const [url, handler] of routes) {
    const route = matchReadOnlyTestPlanRoute('GET', url);
    assert.equal(route.handler, handler);
    assert.equal(route.projectId, 'approval-platform');
    if (handler !== 'listPlans') assert.equal(route.params.planId, PLAN_ID);
  }
});

test('router parses whitelisted filters and rejects duplicates and unknown parameters', () => {
  const route = matchReadOnlyTestPlanRoute(
    'GET',
    '/v1/projects/approval-platform/test-plans?status=FROZEN&sortBy=createdAt&direction=desc&limit=10',
  );
  assert.deepEqual(route.query, {
    status: 'FROZEN', sortBy: 'createdAt', direction: 'desc', limit: '10',
  });
  assert.throws(() => matchReadOnlyTestPlanRoute(
    'GET',
    '/v1/projects/approval-platform/test-plans?status=FROZEN&status=DRAFT',
  ), (error) => error.code === 'DUPLICATE_QUERY_PARAMETER');
  assert.throws(() => matchReadOnlyTestPlanRoute(
    'GET',
    '/v1/projects/approval-platform/test-plans?secret=value',
  ), (error) => error.code === 'UNKNOWN_QUERY_PARAMETER');
});

test('router rejects writes, unknown paths and encoded slash segments', () => {
  assert.throws(() => matchReadOnlyTestPlanRoute(
    'POST',
    '/v1/projects/approval-platform/test-plans',
  ), (error) => error.status === 405 && error.headers.allow === 'GET');
  assert.throws(() => matchReadOnlyTestPlanRoute('GET', '/v1/projects/approval-platform/unknown'),
    (error) => error.status === 404);
  assert.throws(() => matchReadOnlyTestPlanRoute(
    'GET',
    `/v1/projects/approval-platform/test-plans/${PLAN_ID}%2Fcoverage`,
  ), (error) => error.code === 'INVALID_HTTP_PATH');
});
