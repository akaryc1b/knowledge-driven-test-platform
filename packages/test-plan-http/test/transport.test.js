import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpBoundaryError,
  InMemoryFixedWindowRateLimiter,
} from '@kdtp/governance-http';
import { ReadOnlyTestPlanHttpTransport } from '../src/index.js';
import { createFixture, request } from './test-helpers.js';

const PLAN_ID = 'tp-approval-platform-1234567890ab';

test('transport authenticates and dispatches Test Plan list and detail routes', async () => {
  const fixture = createFixture();
  const list = await fixture.transport.dispatch(request({
    url: '/v1/projects/approval-platform/test-plans?status=FROZEN&limit=10',
  }));
  assert.equal(list.status, 200);
  assert.equal(list.body.requestId, 'req:test-plan');
  assert.equal(list.headers['x-content-type-options'], 'nosniff');
  assert.equal(list.headers['cache-control'], 'no-store');
  assert.deepEqual(fixture.calls[0], ['listPlans', {
    projectId: 'approval-platform',
    actor: 'reader',
    query: { status: 'FROZEN', limit: '10' },
  }]);

  const detail = await fixture.transport.dispatch(request({
    url: `/v1/projects/approval-platform/test-plans/${PLAN_ID}`,
  }));
  assert.equal(detail.status, 200);
  assert.deepEqual(fixture.calls[1], ['getPlan', {
    projectId: 'approval-platform', actor: 'reader', planId: PLAN_ID,
  }]);
});

test('transport exposes stable authentication, method, route and body errors', async () => {
  const fixture = createFixture();
  const missing = await fixture.transport.dispatch(request({ headers: { accept: 'application/json' } }));
  assert.equal(missing.status, 401);
  assert.equal(missing.headers['www-authenticate'], 'Bearer');
  const method = await fixture.transport.dispatch(request({ method: 'DELETE' }));
  assert.equal(method.status, 405);
  assert.equal(method.headers.allow, 'GET');
  const route = await fixture.transport.dispatch(request({ url: '/v1/unknown' }));
  assert.equal(route.status, 404);
  const body = await fixture.transport.dispatch(request({ body: '{}' }));
  assert.equal(body.status, 413);
});

test('transport rate limits without exposing bearer credentials', async () => {
  const limiter = new InMemoryFixedWindowRateLimiter({ limit: 1, windowMs: 60_000, clock: () => 1000 });
  const fixture = createFixture({ rateLimiter: limiter, clock: () => 1000 });
  assert.equal((await fixture.transport.dispatch(request())).status, 200);
  const limited = await fixture.transport.dispatch(request());
  assert.equal(limited.status, 429);
  assert.equal(limited.headers['ratelimit-limit'], '1');
  assert.equal(JSON.stringify(limited).includes('token-12345678'), false);
});

test('transport sanitizes authentication and handler internal failures', async () => {
  const authFailure = createFixture({
    authentication: {
      async authenticate() {
        throw new HttpBoundaryError('AUTH_BACKEND_FAILURE', 'private key leaked', 500);
      },
    },
  });
  const authResponse = await authFailure.transport.dispatch(request());
  assert.equal(authResponse.status, 500);
  assert.equal(JSON.stringify(authResponse.body).includes('private key'), false);

  const handlerFailure = createFixture({
    service: { async listPlans() { throw new Error('database password leaked'); } },
  });
  const handlerResponse = await handlerFailure.transport.dispatch(request());
  assert.equal(handlerResponse.status, 500);
  assert.equal(JSON.stringify(handlerResponse.body).includes('password'), false);
});

test('transport validates authentication and handler adapters at construction', () => {
  assert.throws(() => new ReadOnlyTestPlanHttpTransport({ handlers: {}, authentication: {} }));
});
