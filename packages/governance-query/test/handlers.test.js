import test from 'node:test';
import assert from 'node:assert/strict';
import {
  InMemoryRequestIdentityContext,
  ReadOnlyGovernanceQueryHandlers,
} from '../src/index.js';
import { createQueryFixture, PROJECT } from './test-helpers.js';

test('handler resolves identity and returns a stable success envelope', async () => {
  const fixture = await createQueryFixture();
  const response = await fixture.handlers.listKnowledge({
    context: { credential: 'knowledge-token', requestId: 'request-001' },
    projectId: PROJECT,
    query: { limit: 1 },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.schemaVersion, 'governance-query-response/v1');
  assert.equal(response.body.requestId, 'request-001');
  assert.equal(response.body.data.items.length, 1);
});

test('handler maps authentication, authorization and not-found errors', async () => {
  const fixture = await createQueryFixture();
  const unauthenticated = await fixture.handlers.listKnowledge({
    context: { credential: 'unknown' },
    projectId: PROJECT,
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.body.error.code, 'UNAUTHENTICATED');

  const forbidden = await fixture.handlers.listKnowledge({
    context: { credential: 'forbidden-token' },
    projectId: PROJECT,
  });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body.error.code, 'GOVERNANCE_FORBIDDEN');

  const missing = await fixture.handlers.getKnowledge({
    context: { credential: 'knowledge-token' },
    projectId: PROJECT,
    params: { id: 'PROJECT-MISSING-001', version: '1.0.0' },
  });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, 'KNOWLEDGE_NOT_FOUND');
});

test('handler maps invalid input without throwing transport exceptions', async () => {
  const fixture = await createQueryFixture();
  const response = await fixture.handlers.listKnowledge({
    context: { credential: 'knowledge-token', requestId: 'contains spaces' },
    projectId: PROJECT,
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_REQUEST_ID');
});

test('handler sanitizes unexpected service failures', async () => {
  const service = Object.fromEntries([
    'listKnowledge',
    'getKnowledge',
    'getReviewTimeline',
    'listSnapshots',
    'getSnapshot',
  ].map((method) => [method, async () => {
    throw new Error('database password leaked');
  }]));
  const handlers = new ReadOnlyGovernanceQueryHandlers({
    service,
    identityContext: new InMemoryRequestIdentityContext([
      { credential: 'token', actor: 'reader' },
    ]),
  });
  const response = await handlers.listKnowledge({
    context: { credential: 'token' },
    projectId: PROJECT,
  });
  assert.equal(response.status, 500);
  assert.equal(response.body.error.code, 'QUERY_INTERNAL_ERROR');
  assert.equal(response.body.error.message.includes('password'), false);
});
