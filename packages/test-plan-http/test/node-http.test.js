import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createReadOnlyTestPlanNodeHttpServer } from '../src/index.js';
import { createFixture } from './test-helpers.js';

const PLAN_ID = 'tp-approval-platform-1234567890ab';

test('Node HTTP adapter serves Test Plan JSON with hardened headers', async () => {
  const fixture = createFixture();
  const server = createReadOnlyTestPlanNodeHttpServer({ transport: fixture.transport });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/v1/projects/approval-platform/test-plans/${PLAN_ID}/coverage`,
      {
        headers: {
          authorization: 'Bearer token-12345678',
          accept: 'application/json',
          'x-request-id': 'req:test-plan-http',
        },
      },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-request-id'), 'req:test-plan-http');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    const body = await response.json();
    assert.equal(body.data.planId, PLAN_ID);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('Node HTTP adapter rejects plan write requests', async () => {
  const fixture = createFixture({ maxBodyBytes: 1024 });
  const server = createReadOnlyTestPlanNodeHttpServer({ transport: fixture.transport });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/v1/projects/approval-platform/test-plans/${PLAN_ID}`,
      {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer token-12345678',
          'content-type': 'application/json',
        },
        body: '{}',
      },
    );
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, 'REQUEST_BODY_NOT_ALLOWED');
  } finally {
    server.close();
    await once(server, 'close');
  }
});
