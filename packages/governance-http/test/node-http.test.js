import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createReadOnlyNodeHttpServer } from '../src/index.js';
import { createFixture } from './test-helpers.js';

test('Node HTTP adapter serves JSON with security headers and closes cleanly', async () => {
  const fixture = createFixture();
  const server = createReadOnlyNodeHttpServer({ transport: fixture.transport });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/projects/approval-platform/knowledge`, {
      headers: {
        authorization: 'Bearer token-12345678',
        accept: 'application/json',
        'x-request-id': 'req:http',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-request-id'), 'req:http');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    const body = await response.json();
    assert.equal(body.requestId, 'req:http');
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('Node HTTP adapter rejects request bodies before dispatch', async () => {
  const fixture = createFixture();
  const server = createReadOnlyNodeHttpServer({ transport: fixture.transport });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/projects/approval-platform/knowledge`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-12345678',
        'content-type': 'application/json',
      },
      body: '{}',
    });
    assert.equal(response.status, 413);
    assert.match(response.headers.get('x-request-id'), /^req:/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
