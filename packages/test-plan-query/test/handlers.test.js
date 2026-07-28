import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAN_QUERY_RESPONSE_SCHEMA_VERSION,
  ReadOnlyTestPlanQueryHandlers,
} from '../src/index.js';
import { InMemoryRequestIdentityContext } from '@kdtp/governance-query';
import { createPlanQueryFixture, PROJECT } from './test-helpers.js';

test('handlers resolve identity and return stable plan query envelopes', async () => {
  const fixture = await createPlanQueryFixture();
  const response = await fixture.handlers.listPlans({
    context: { credential: 'reader-token', requestId: 'request-plan-001' },
    projectId: PROJECT,
    query: { limit: 1 },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.schemaVersion, PLAN_QUERY_RESPONSE_SCHEMA_VERSION);
  assert.equal(response.body.requestId, 'request-plan-001');
  assert.equal(response.body.data.items.length, 1);
});

test('handlers map authentication, authorization and not-found failures', async () => {
  const fixture = await createPlanQueryFixture();
  const unauthenticated = await fixture.handlers.listPlans({
    context: { credential: 'unknown', requestId: 'request-plan-002' },
    projectId: PROJECT,
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.body.error.code, 'UNAUTHENTICATED');

  const forbidden = await fixture.handlers.listPlans({
    context: { credential: 'forbidden-token', requestId: 'request-plan-003' },
    projectId: PROJECT,
  });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body.error.code, 'PLAN_QUERY_FORBIDDEN');

  const missing = await fixture.handlers.getPlan({
    context: { credential: 'reader-token', requestId: 'request-plan-004' },
    projectId: PROJECT,
    params: { planId: 'tp-approval-platform-000000000000' },
  });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, 'PLAN_NOT_FOUND');
});

test('handlers reject invalid request IDs and sanitize unexpected failures', async () => {
  const fixture = await createPlanQueryFixture();
  const invalid = await fixture.handlers.listPlans({
    context: { credential: 'reader-token', requestId: 'contains spaces' },
    projectId: PROJECT,
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'INVALID_REQUEST_ID');

  const methods = ['listPlans', 'getPlan', 'getCoverage', 'getProvenance', 'getTimeline'];
  const broken = Object.fromEntries(methods.map((method) => [method, async () => {
    throw new Error('database password leaked');
  }]));
  const handlers = new ReadOnlyTestPlanQueryHandlers({
    service: broken,
    identityContext: new InMemoryRequestIdentityContext([{ credential: 'token', actor: 'reader' }]),
  });
  const response = await handlers.listPlans({
    context: { credential: 'token', requestId: 'request-plan-005' },
    projectId: PROJECT,
  });
  assert.equal(response.status, 500);
  assert.equal(response.body.error.code, 'PLAN_QUERY_INTERNAL_ERROR');
  assert.equal(JSON.stringify(response.body).includes('password'), false);
});
