import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { createOperationalNodeHttpHandler } from '../src/operational-http.js';

test('live and ready probes bypass business authentication', async () => {
  let businessCalls = 0;
  const handler = createOperationalNodeHttpHandler({
    businessHandler(_request, response) { businessCalls += 1; response.statusCode = 418; response.end('business'); },
    readiness: {
      live() { return { schemaVersion: 'service-health/v1', service: 'service-a', status: 'live', uptimeSeconds: 1, checks: [] }; },
      async ready() { return { statusCode: 503, body: { schemaVersion: 'service-health/v1', service: 'service-a', status: 'not_ready', uptimeSeconds: 1, checks: [] } }; },
    },
    requestIdFactory: () => 'generated-id',
  });
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const { port } = server.address();
    const live = await fetch(`http://127.0.0.1:${port}/live`);
    const ready = await fetch(`http://127.0.0.1:${port}/ready`);
    const business = await fetch(`http://127.0.0.1:${port}/v1/projects/a/knowledge`);
    assert.equal(live.status, 200);
    assert.equal(live.headers.get('x-request-id'), 'generated-id');
    assert.equal(ready.status, 503);
    assert.equal(business.status, 418);
    assert.equal(businessCalls, 1);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('operational endpoints reject methods, query strings and bodies', async () => {
  const handler = createOperationalNodeHttpHandler({
    businessHandler() {},
    readiness: { live() { return {}; }, async ready() { return { statusCode: 200, body: {} }; } },
  });
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const { port } = server.address();
    assert.equal((await fetch(`http://127.0.0.1:${port}/live`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`http://127.0.0.1:${port}/live?verbose=true`)).status, 400);
    assert.equal(await getWithBody(port, '/ready', 'x'), 413);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

function getWithBody(port, path, body) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      host: '127.0.0.1', port, path, method: 'GET',
      headers: { 'content-length': String(Buffer.byteLength(body)) },
    }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject);
    request.end(body);
  });
}
