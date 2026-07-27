import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpBoundaryError,
  InMemoryFixedWindowRateLimiter,
  ReadOnlyGovernanceHttpTransport,
} from '../src/index.js';
import { createFixture, request } from './test-helpers.js';

test('transport authenticates and dispatches a read-only query', async () => {
  const fixture = createFixture();
  const response = await fixture.transport.dispatch(request({
    url: '/v1/projects/approval-platform/knowledge?limit=10&sortBy=id&direction=asc',
  }));
  assert.equal(response.status, 200);
  assert.equal(response.body.requestId, 'req:test');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(fixture.calls[0], ['listKnowledge', {
    projectId: 'approval-platform',
    actor: 'reader',
    query: { limit: '10', sortBy: 'id', direction: 'asc' },
  }]);
});

test('transport returns stable authentication, route and method errors', async () => {
  const fixture = createFixture();
  const missing = await fixture.transport.dispatch(request({ headers: { accept: 'application/json' } }));
  assert.equal(missing.status, 401);
  assert.equal(missing.headers['www-authenticate'], 'Bearer');
  const method = await fixture.transport.dispatch(request({ method: 'DELETE' }));
  assert.equal(method.status, 405);
  assert.equal(method.headers.allow, 'GET');
  const route = await fixture.transport.dispatch(request({ url: '/v1/unknown' }));
  assert.equal(route.status, 404);
});

test('transport enforces JSON content negotiation and zero-body default', async () => {
  const fixture = createFixture();
  assert.equal((await fixture.transport.dispatch(request({ headers: {
    authorization: 'Bearer token-12345678', accept: 'text/html',
  } }))).status, 406);
  assert.equal((await fixture.transport.dispatch(request({ headers: {
    authorization: 'Bearer token-12345678', accept: 'application/json;q=0, text/html',
  } }))).status, 406);
  assert.equal((await fixture.transport.dispatch(request({ headers: {
    authorization: 'Bearer token-12345678', accept: 'application/json;q=2',
  } }))).status, 406);
  assert.equal((await fixture.transport.dispatch(request({ body: 'unexpected' }))).status, 413);
});

test('transport generates request IDs and sanitizes unexpected errors', async () => {
  const fixture = createFixture({
    service: { async listKnowledge() { throw new Error('database password leaked'); } },
  });
  const response = await fixture.transport.dispatch(request({ headers: {
    authorization: 'Bearer token-12345678', accept: 'application/json',
  } }));
  assert.equal(response.status, 500);
  assert.equal(response.body.requestId, 'req:generated');
  assert.equal(JSON.stringify(response.body).includes('password'), false);
});

test('transport applies rate limits without exposing bearer tokens', async () => {
  const rateLimiter = new InMemoryFixedWindowRateLimiter({ limit: 1, windowMs: 60_000, clock: () => 1000 });
  const fixture = createFixture({ rateLimiter, clock: () => 1000 });
  assert.equal((await fixture.transport.dispatch(request())).status, 200);
  const limited = await fixture.transport.dispatch(request());
  assert.equal(limited.status, 429);
  assert.equal(limited.headers['ratelimit-limit'], '1');
  assert.equal(JSON.stringify(limited).includes('token-12345678'), false);
});

test('transport rejects invalid authentication and rate-limit adapters at construction', () => {
  assert.throws(() => new ReadOnlyGovernanceHttpTransport({ handlers: {}, authentication: {} }));
});

test('transport accepts a case-insensitive bearer scheme and sanitizes internal boundary errors', async () => {
  const fixture = createFixture({
    authentication: {
      async authenticate() {
        throw new HttpBoundaryError('AUTH_BACKEND_FAILURE', 'private key leaked', 500);
      },
    },
  });
  const valid = createFixture();
  assert.equal((await valid.transport.dispatch(request({ headers: {
    authorization: 'bearer token-12345678', accept: 'application/json',
  } }))).status, 200);
  const broken = await fixture.transport.dispatch(request());
  assert.equal(broken.status, 500);
  assert.equal(JSON.stringify(broken.body).includes('private key'), false);
});
